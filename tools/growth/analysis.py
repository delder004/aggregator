"""Evidence imports, opportunity discovery, and conservative before/after analysis."""
import csv
import datetime as dt
import hashlib
import io
import json
import math
import zipfile
from collections import defaultdict
from pathlib import Path
from core import GrowthError, date, now


def metric(row):
    try:
        clicks, impressions = int(row['Clicks']), int(row['Impressions'])
        position = float(row['Position']) if row.get('Position') else None
        if clicks<0 or impressions<0 or (position is None and impressions) or (position is not None and (not math.isfinite(position) or position<0)):
            raise ValueError()
        return dict(clicks=clicks, impressions=impressions, position=position)
    except (ValueError,KeyError,TypeError):
        raise GrowthError('Invalid GSC metric row', 'invalid_import')


def import_gsc(store, source, site_url):
    path = Path(source)
    names = ['Chart.csv','Queries.csv','Pages.csv','Countries.csv','Devices.csv','Filters.csv']
    if path.is_dir():
        content = {n:(path/n).read_bytes() for n in names if (path/n).exists()}
    else:
        with zipfile.ZipFile(path) as z:
            if sum(i.file_size for i in z.infolist())>20_000_000:
                raise GrowthError('Export exceeds 20 MB')
            content = {n:z.read(n) for n in names if n in z.namelist()}
    if sum(len(b) for b in content.values())>20_000_000:raise GrowthError('Export exceeds 20 MB')
    if not {'Chart.csv','Filters.csv'}.issubset(content):
        raise GrowthError('GSC export must contain Chart.csv and Filters.csv')
    def rows(name):
        return list(csv.DictReader(io.StringIO(content[name].decode('utf-8-sig'))))
    daily = []
    for row in rows('Chart.csv'):
        daily.append(dict(date=str(date(row['Date'])), **metric(row)))
    if not daily or len({r['date'] for r in daily})!=len(daily):
        raise GrowthError('Export has no days or duplicate dates')
    data = dict(daily=daily, filters=rows('Filters.csv'), dimensions={})
    for name,key in [('Queries.csv','Top queries'),('Pages.csv','Top pages'),('Countries.csv','Country'),('Devices.csv','Device')]:
        if name in content:
            data['dimensions'][name.split('.')[0].lower()]=[dict(key=r[key],**metric(r)) for r in rows(name)]
    # Exports don't reliably identify the property. Require an explicit declaration and reject conflicting page rows.
    from urllib.parse import urlsplit
    if any(urlsplit(r['key']).hostname != urlsplit(site_url).hostname for r in data['dimensions'].get('pages',[])):
        raise GrowthError('Export page URLs do not match configured site')
    data['raw_csv'] = {n:b.decode('utf-8-sig') for n,b in content.items()}
    return store.save('gsc.import',dict(site_url=site_url,start=min(r['date'] for r in daily),end=max(r['date'] for r in daily),
                      filters=data['filters'], hashes={n:hashlib.sha256(b).hexdigest() for n,b in content.items()}),data,
                      metadata=dict(timezone='America/Los_Angeles',property_verified=False,note='Property declared by importer; original capture date may precede import. Filters preserved.'))


def summarize(rows):
    impressions=sum(r['impressions'] for r in rows)
    clicks=sum(r['clicks'] for r in rows)
    return dict(observations=len(rows),clicks=clicks,impressions=impressions,
                ctr=clicks/impressions if impressions else None,
                average_position=sum((r['position'] or 0)*r['impressions'] for r in rows)/impressions if impressions else None)


def export_scope(record):
    return [r for r in record['data']['filters'] if r.get('Filter','').lower()!='date']


def series(record, page=None):
    if record['status']!='ok':
        raise GrowthError('Cannot analyze a failed observation')
    if record['kind']=='gsc.import':
        if page:
            raise GrowthError('UI export has no daily page joins. Use gsc --dimensions date --page URL for impact.')
        return record['data']['daily'], dict(site=record['request']['site_url'], filters=export_scope(record), dimension='site')
    if record['kind']=='gsc.search':
        dims=record['data']['dimensions']
        if dims not in (['date'],['date','page']):
            raise GrowthError('Impact requires date or date,page dimensions; query-filtered and page-filtered requests retain their scope.')
        if dims==['date','page'] and not page:
            raise GrowthError('Specify --page for date,page observations; summing pages would inflate site totals')
        rows=[]
        for r in record['data']['rows']:
            if dims==['date','page'] and r['keys'][1]!=page:
                continue
            rows.append(dict(date=r['keys'][0],clicks=r['clicks'],impressions=r['impressions'],position=r.get('position')))
        body=record['request']['body']
        return rows, dict(site=record['request']['property'],type=body['type'],filters=body.get('dimensionFilterGroups',[]),dimension=dims,page=page)
    raise GrowthError('Expected gsc.import or gsc.search')


def report(store, ident=None):
    if ident:
        record=store.get(ident)
    else:
        candidates=[r for r in store.history(limit=1000) if r['kind'] in ('gsc.import','gsc.search') and r['status']=='ok']
        if not candidates:
            raise GrowthError('No GSC evidence. Import an export or run gsc first.', 'missing_data')
        record=store.get(candidates[0]['id'])
    if record['status']!='ok':raise GrowthError('Cannot report failed or partial evidence')
    if record['kind']=='gsc.import':
        data=record['data']; daily=data['daily']; queries=data['dimensions'].get('queries',[]); pages=data['dimensions'].get('pages',[])
        totals=summarize(daily); window=dict(start=min(r['date'] for r in daily),end=max(r['date'] for r in daily))
    elif record['kind']=='gsc.search':
        dims=record['data']['dimensions']; body=record['request']['body']; window=dict(start=body['startDate'],end=body['endDate'])
        raw=record['data']['rows']; daily=[];queries=[];pages=[];totals=None
        if dims==['date']:
            daily=[dict(date=r['keys'][0],clicks=r['clicks'],impressions=r['impressions'],position=r.get('position')) for r in raw]
            totals=summarize(daily)
        elif dims==[]:
            totals=summarize([dict(clicks=r['clicks'],impressions=r['impressions'],position=r.get('position')) for r in raw])
        elif dims in (['query'],['page']):
            normalized=[dict(key=r['keys'][0],clicks=r['clicks'],impressions=r['impressions'],position=r.get('position')) for r in raw]
            if dims==['query']:queries=normalized
            else:pages=normalized
        else:
            raise GrowthError('Report supports aggregate, date, query, or page dimensions. Read joined evidence directly with evidence show.')
    else:
        raise GrowthError('Report expects GSC evidence')
    opportunities=[]
    for row in queries:
        if row['impressions']<3 or row['position'] is None:continue
        lane='near_page_one' if row['position']<=30 else 'content_relevance'
        opportunities.append(dict(**row,lane=lane,confidence='low' if row['impressions']<30 else 'exploratory',
                                  market_volume=None, next_step='Verify intent and query-to-page mapping; collect keyword demand and inspect competing pages.'))
    opportunities.sort(key=lambda r:(r['lane']!='near_page_one',-r['impressions']))
    comparison=None
    if daily:
        end=date(window['end']);recent=[r for r in daily if end-dt.timedelta(days=27)<=date(r['date'])<=end]
        previous=[r for r in daily if end-dt.timedelta(days=55)<=date(r['date'])<=end-dt.timedelta(days=28)]
        comparison=dict(current=summarize(recent),previous=summarize(previous),
                        complete_calendar_windows=(date(window['start'])<=end-dt.timedelta(days=55)),
                        caveat='Position changes can reflect query mix; this comparison is descriptive, not causal.')
    return dict(source_id=record['id'],source_captured_at=record['captured_at'],request=record['request'],window=window,totals=totals,
                comparison_28_days=comparison,opportunities=opportunities,top_pages=sorted(pages,key=lambda r:-r['impressions'])[:20],
                limitations=['GSC impressions are not market search volume.','Dimension rows do not necessarily sum to site totals.',
                             'Average position is not a fixed SERP rank.','Low counts cannot establish traffic uplift or conversion effectiveness.'])


def change_add(store, payload):
    required=['id','hypothesis','urls','deployed_at','primary_metric']
    if any(not payload.get(k) for k in required):
        raise GrowthError('Change requires '+', '.join(required))
    if not isinstance(payload['urls'],list) or any(not isinstance(u,str) or not u.startswith('https://') for u in payload['urls']):
        raise GrowthError('urls must be an array of HTTPS URLs')
    stamp=dt.datetime.fromisoformat(payload['deployed_at'].replace('Z','+00:00'))
    if stamp.tzinfo is None:raise GrowthError('deployed_at must include a timezone')
    import sqlite3
    try:
        store.db.execute('INSERT INTO changes VALUES (?,?,?)',(payload['id'],now(),json.dumps(payload)))
        store.db.commit()
    except sqlite3.IntegrityError:
        raise GrowthError('Change ID already exists; use a new ID for a new deployment')
    return payload


def impact(store, change_id, before_id, after_id, page=None):
    found=store.db.execute('SELECT data FROM changes WHERE id=?',(change_id,)).fetchone()
    if not found:raise GrowthError('Unknown change ID','not_found')
    change=json.loads(found['data'])
    before,after=store.get(before_id),store.get(after_id)
    a,scope_a=series(before,page);b,scope_b=series(after,page)
    if scope_a!=scope_b:raise GrowthError('Before/after scopes differ; collect identical property, dimensions and filters')
    if not a or not b:raise GrowthError('No comparable rows','missing_data')
    # GSC dates are PT; do not compare a UTC deployment date to PT days.
    from zoneinfo import ZoneInfo
    deployed=dt.datetime.fromisoformat(change['deployed_at'].replace('Z','+00:00')).astimezone(ZoneInfo('America/Los_Angeles')).date()
    def bounds(record):
        r=record['request']
        return (r['body']['startDate'],r['body']['endDate']) if record['kind']=='gsc.search' else (r['start'],r['end'])
    astart,aend=bounds(before);bstart,bend=bounds(after)
    if date(aend)>=deployed or date(bstart)<=deployed:
        raise GrowthError('Use a pre-deployment window and a post-deployment window excluding the deployment day (Pacific Time)')
    if (date(aend)-date(astart))!=(date(bend)-date(bstart)):
        raise GrowthError('Before/after calendar windows must have equal length')
    if (date(bstart)-date(astart)).days%7:
        raise GrowthError('Before/after windows must align on weekdays')
    if page and page not in change['urls']:
        raise GrowthError('Page is not included in the change manifest')
    first,second=summarize(a),summarize(b)
    return dict(change=change,source_ids=[before_id,after_id],scope=scope_a,before=first,after=second,
                delta=dict(clicks=second['clicks']-first['clicks'],impressions=second['impressions']-first['impressions']),
                conclusion='insufficient_evidence' if min(first['clicks'],second['clicks'])<30 else 'descriptive_only',
                caveats=['No causal claim: no randomized or matched control is applied.',
                         'Sitewide results include unrelated changes; prefer a page-filtered cohort.',
                         'The 30-click guard is a conservative heuristic, not a significance test.',
                         'Source revisions, holidays, market demand and concurrent changes can affect results.'])
