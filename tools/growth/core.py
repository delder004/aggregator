"""Local evidence store and bounded HTTP. Standard library only, Python 3.9+."""
import datetime as dt
import hashlib
import json
import os
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class GrowthError(Exception):
    def __init__(self, message, code='invalid_input'):
        super().__init__(message)
        self.code = code


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def date(value):
    try:
        return dt.date.fromisoformat(value)
    except (ValueError, TypeError):
        raise GrowthError('Expected ISO date YYYY-MM-DD')


def date_range(start, end):
    if date(start) > date(end):
        raise GrowthError('start must not be after end')
    return start, end


def load_credentials(path):
    """Explicit JSON file, never execute/shell-source credentials."""
    p = Path(path).expanduser()
    if not p.exists():
        return {}
    if p.stat().st_mode & 0o077:
        raise GrowthError('Credentials file must be private: chmod 600 ' + str(p), 'credentials_permissions')
    result = json.loads(p.read_text())
    if not isinstance(result, dict) or any(not isinstance(v, str) for v in result.values()):
        raise GrowthError('Credentials must be a JSON object of string values')
    return result


class Store:
    def __init__(self, path):
        self.path = Path(path).expanduser().resolve()
        self.path.mkdir(parents=True, exist_ok=True, mode=0o700)
        (self.path / 'evidence').mkdir(exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(str(self.path / 'growth.sqlite'), timeout=20)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS observations (
          id TEXT PRIMARY KEY, captured_at TEXT NOT NULL, kind TEXT NOT NULL,
          status TEXT NOT NULL, request_hash TEXT NOT NULL, artifact TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS observations_lookup ON observations(kind, request_hash, captured_at);
        CREATE TABLE IF NOT EXISTS changes (
          id TEXT PRIMARY KEY, recorded_at TEXT NOT NULL, data TEXT NOT NULL);
        ''')

    def save(self, kind, request, data=None, status='ok', error=None, metadata=None):
        ident = str(uuid.uuid4())
        item = dict(schema_version=1, id=ident, captured_at=now(), kind=kind,
                    status=status, request=request, metadata=metadata or {}, data=data, error=error)
        file = self.path / 'evidence' / (ident + '.json')
        with file.open('x') as f:
            json.dump(item, f, indent=2, ensure_ascii=False, allow_nan=False)
            f.write('\n')
        self.db.execute('INSERT INTO observations VALUES (?,?,?,?,?,?)',
                        (ident, item['captured_at'], kind, status, digest(request), str(file)))
        self.db.commit()
        return dict(item, artifact=str(file))

    def get(self, ident):
        row = self.db.execute('SELECT artifact FROM observations WHERE id=?', (ident,)).fetchone()
        if not row:
            raise GrowthError('Unknown observation ID', 'not_found')
        return dict(json.loads(Path(row['artifact']).read_text()), artifact=row['artifact'])

    def history(self, kind=None, limit=50):
        if kind:
            rows = self.db.execute('SELECT * FROM observations WHERE kind=? ORDER BY captured_at DESC LIMIT ?', (kind, limit))
        else:
            rows = self.db.execute('SELECT * FROM observations ORDER BY captured_at DESC LIMIT ?', (limit,))
        return [dict(r) for r in rows]

    def cached(self, kind, request, hours):
        cutoff = (dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=hours)).isoformat()
        row = self.db.execute("SELECT id FROM observations WHERE kind=? AND request_hash=? AND status='ok' AND captured_at>=? ORDER BY captured_at DESC LIMIT 1", (kind, digest(request), cutoff)).fetchone()
        return self.get(row['id']) if row else None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, config, credentials, store):
        self.config, self.credentials, self.store = config, credentials, store
        self.requests = 0

    def secret(self, key):
        value = os.environ.get(key) or self.credentials.get(key)
        if not value:
            raise GrowthError('Missing credential: ' + key + '. See tools/growth/README.md.', 'missing_credentials')
        return value

    def http(self, url, payload=None, headers=None, form=False):
        if self.requests >= self.config.get('max_api_requests_per_run', 30):
            raise GrowthError('Per-run request limit reached; narrow the date range or increase the explicit config limit.', 'request_limit')
        self.requests += 1
        headers = dict(headers or {})
        body = None
        if payload is not None:
            body = urllib.parse.urlencode(payload).encode() if form else json.dumps(payload).encode()
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
        req = urllib.request.Request(url, data=body, headers=headers)
        try:
            # Never forward API authorization on a redirect.
            with urllib.request.build_opener(NoRedirect()).open(req, timeout=40) as response:
                raw = response.read(20_000_001)
                if len(raw) > 20_000_000:
                    raise GrowthError('Response exceeded 20 MB; request a smaller result.', 'response_limit')
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            # Provider errors can echo tokens and query text; do not persist their bodies.
            raise GrowthError('Provider returned HTTP %s; check credentials, scope, endpoint and quota.' % exc.code, 'http_error')
        except (urllib.error.URLError, TimeoutError):
            raise GrowthError('Provider connection failed or timed out. No automatic retry was made.', 'network_error')
        except (ValueError, UnicodeError):
            raise GrowthError('Provider returned invalid JSON.', 'invalid_response')

    def collect(self, kind, request, fetch, refresh=False, dry_run=False, metadata=None):
        if dry_run:
            return dict(status='planned', kind=kind, request=request, metadata=metadata or {})
        cached = None if refresh else self.store.cached(kind, request, self.config.get('cache_hours', 24))
        if cached:
            return dict(cached, cache_hit=True)
        try:
            data = fetch()
            return self.store.save(kind, request, data, status='partial_failure' if isinstance(data, dict) and data.get('partial_failure') else 'ok', metadata=metadata)
        except (ValueError, TypeError, KeyError, AttributeError):
            record = self.store.save(kind, request, status='error', error=dict(code='invalid_response', message='Unexpected provider response shape'), metadata=metadata)
            raise GrowthError('Unexpected provider response shape. Observation: '+record['id'], 'invalid_response')
        except GrowthError as exc:
            record = self.store.save(kind, request, status='error', error=dict(code=exc.code, message=str(exc)), metadata=metadata)
            raise GrowthError(str(exc) + ' Observation: ' + record['id'], exc.code)
