"""Read-only research adapters. Provider task POSTs may incur account charges."""
import base64
import datetime as dt
import urllib.parse
from core import GrowthError, date_range

# Registry doubles as machine-readable discovery. Keep endpoint-specific logic here.
RESEARCH = {
    'volume': dict(path='keywords_data/google_ads/search_volume/live', required=['keywords'], description='Monthly keyword demand and history; competition is PAID ads competition.', max_keywords=1000),
    'ideas': dict(path='dataforseo_labs/google/keyword_ideas/live', required=['keywords'], description='Discover related keyword ideas and demand.', max_keywords=200),
    'trends': dict(path='keywords_data/google_trends/explore/live', required=['keywords'], description='Relative interest over time; not absolute search volume.', max_keywords=5),
    'serp': dict(path='serp/google/organic/live/advanced', required=['keyword'], description='Current organic results, features and ranking evidence.'),
    'competitors': dict(path='dataforseo_labs/google/competitors_domain/live', required=['target'], description='Domains overlapping a target in organic search; estimated data.'),
    'competitor-keywords': dict(path='dataforseo_labs/google/ranked_keywords/live', required=['target'], description='Keywords and ranking pages for a competitor; estimated data.'),
    'backlinks': dict(path='backlinks/referring_domains/live', required=['target'], description='Referring domains for distribution/link research; provider account entitlement may be required.'),
}


def research(client, name, params, refresh=False, dry_run=False):
    spec = RESEARCH[name]
    if not isinstance(params, dict):
        raise GrowthError('Research params must be a JSON object')
    # Only read-only/live endpoints; no callbacks or arbitrary URL destinations.
    allowed = {'keywords', 'keyword', 'target', 'location_code', 'language_code', 'limit', 'depth', 'device', 'date_from', 'date_to', 'time_range'}
    if set(params)-allowed:
        raise GrowthError('Unsupported parameters: ' + ', '.join(sorted(set(params)-allowed)))
    for key in spec['required']:
        if not params.get(key):
            raise GrowthError(name + ' requires ' + key)
    params = dict(params)
    if 'keywords' in params:
        keywords = params['keywords']
        if not isinstance(keywords, list) or any(not isinstance(k, str) or not k.strip() for k in keywords):
            raise GrowthError('keywords must be a nonempty array of strings')
        keywords = list(dict.fromkeys(k.strip() for k in keywords))
        if not keywords or len(keywords) > min(spec.get('max_keywords', 100), client.config.get('max_keywords', 100)):
            raise GrowthError('Keyword count exceeds the configured/provider limit')
        params['keywords'] = keywords
    for field in ('keyword', 'target'):
        if field in params and (not isinstance(params[field], str) or not params[field].strip()):
            raise GrowthError(field + ' must be a nonempty string')
    if name != 'backlinks':
        params.setdefault('location_code', client.config.get('location_code', 2840))
        params.setdefault('language_code', client.config.get('language_code', 'en'))
    if name in ('ideas', 'competitors', 'competitor-keywords', 'backlinks'):
        params.setdefault('limit', 50)
    if name == 'serp':
        params.setdefault('depth', 100)
        params.setdefault('device', 'desktop')
    for field in ('limit', 'depth'):
        if field in params and (type(params[field]) is not int or not 1 <= params[field] <= client.config.get('max_results', 100)):
            raise GrowthError(field + ' must be an integer within max_results')
    if ('date_from' in params) != ('date_to' in params):
        raise GrowthError('Provide both date_from and date_to')
    if 'date_from' in params:
        date_range(params['date_from'], params['date_to'])
    request = dict(provider='dataforseo', endpoint=spec['path'], params=params)
    def fetch():
        token = base64.b64encode((client.secret('DATAFORSEO_LOGIN')+':'+client.secret('DATAFORSEO_PASSWORD')).encode()).decode()
        raw = client.http('https://api.dataforseo.com/v3/'+spec['path'], [params], {'Authorization':'Basic '+token})
        if raw.get('status_code') != 20000 or not raw.get('tasks'):
            raise GrowthError('DataForSEO rejected request; status '+str(raw.get('status_code')), 'provider_error')
        for task in raw['tasks']:
            if task.get('status_code') != 20000:
                raise GrowthError('DataForSEO task failed; status '+str(task.get('status_code')), 'provider_error')
        data = dict(raw=raw, cost_usd=raw.get('cost'), results=[result for t in raw['tasks'] for result in (t.get('result') or [])])
        if name == 'serp':
            items = [item for r in data['results'] for item in (r.get('items') or []) if item.get('type') == 'organic']
            host = urllib.parse.urlsplit(client.config['site_url']).hostname
            matches = [i for i in items if (urllib.parse.urlsplit(i.get('url','')).hostname or '').removeprefix('www.') == host.removeprefix('www.')]
            data['our_ranking'] = dict(status='ranked' if matches else 'not_found_in_results',
                                       rank=matches[0].get('rank_group') if matches else None,
                                       url=matches[0].get('url') if matches else None,
                                       requested_depth=params['depth'], organic_results_returned=len(items))
        return data
    return client.collect('research.'+name, request, fetch, refresh, dry_run,
                          dict(billable=True, estimated=False if name=='serp' else True, note=spec['description'], automatic_retries=False))


def gsc_token(client):
    direct = client.credentials.get('GSC_ACCESS_TOKEN')
    import os
    direct = os.environ.get('GSC_ACCESS_TOKEN') or direct
    if direct:
        return direct
    result = client.http('https://oauth2.googleapis.com/token', dict(
        client_id=client.secret('GSC_CLIENT_ID'), client_secret=client.secret('GSC_CLIENT_SECRET'),
        refresh_token=client.secret('GSC_REFRESH_TOKEN'), grant_type='refresh_token'), form=True)
    if not result.get('access_token'):
        raise GrowthError('Google did not return an access token', 'authentication_error')
    return result['access_token']


def gsc_collect(client, start, end, dimensions, page=None, query=None, country=None, device=None, refresh=False, dry_run=False):
    date_range(start, end)
    allowed = {'date','page','query','country','device','searchAppearance'}
    if len(dimensions) != len(set(dimensions)) or set(dimensions)-allowed:
        raise GrowthError('Invalid or duplicate GSC dimensions')
    filters = []
    for key, value in [('page',page),('query',query),('country',country),('device',device)]:
        if value:
            filters.append(dict(dimension=key, operator='equals', expression=value))
    body = dict(startDate=start, endDate=end, dimensions=dimensions, type='web', dataState='final', rowLimit=25000)
    if filters:
        body['dimensionFilterGroups']=[dict(groupType='and', filters=filters)]
    prop = client.config['gsc_property']
    request = dict(provider='gsc', property=prop, body=body)
    def fetch():
        token = gsc_token(client)
        endpoint = 'https://searchconsole.googleapis.com/webmasters/v3/sites/'+urllib.parse.quote(prop,safe='')+'/searchAnalytics/query'
        rows, responses = [], []
        # Bound extraction; API itself cannot guarantee exhaustive long-tail rows.
        for offset in range(0, 250000, 25000):
            raw = client.http(endpoint, dict(body,startRow=offset), {'Authorization':'Bearer '+token})
            responses.append(raw)
            batch = raw.get('rows',[])
            rows.extend(batch)
            if len(batch)<25000:
                break
        return dict(rows=rows, responses=responses, dimensions=dimensions,
                    truncated=len(rows)>=250000, source_exhaustive=False,
                    note='Only dimensions=[] gives the aggregate for this exact filter. Query breakdowns omit anonymized queries.')
    return client.collect('gsc.search', request, fetch, refresh, dry_run, dict(timezone='America/Los_Angeles', requested_state='final'))


def gsc_inspect(client, url, refresh=False, dry_run=False):
    body = dict(inspectionUrl=url, siteUrl=client.config['gsc_property'], languageCode='en-US')
    return client.collect('gsc.inspect', dict(provider='gsc',body=body),
        lambda: client.http('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', body, {'Authorization':'Bearer '+gsc_token(client)}),
        refresh, dry_run, dict(note='Indexed version, not a live indexing test or indexing request.'))


def posthog(client, start, end, refresh=False, dry_run=False):
    date_range(start,end)
    end_exclusive = str(dt.date.fromisoformat(end)+dt.timedelta(days=1))
    host = urllib.parse.urlsplit(client.config['site_url']).hostname.replace("'", "''")
    # Aggregate only, intentionally no user identifiers/emails. Avoid interpreting cookieless IDs as durable visitors.
    sql = """SELECT toDate(timestamp) AS day, event,
 properties.$pathname AS path, properties.$referring_domain AS referrer,
 count() AS event_count
 FROM events WHERE timestamp >= toDateTime('%s', 'UTC') AND timestamp < toDateTime('%s', 'UTC')
 AND properties.$host = '%s'
 AND event IN ('$pageview','site_search','outbound_link_clicked','newsletter_link_clicked','newsletter_form_submitted','newsletter_subscribed')
 GROUP BY day, event, path, referrer ORDER BY day, event_count DESC LIMIT 10001""" % (start,end_exclusive,host)
    project = str(client.config['posthog_project_id'])
    if not project.isdigit():
        raise GrowthError('posthog_project_id must be numeric')
    region = client.config.get('posthog_region','us')
    if region not in ('us','eu'):
        raise GrowthError('posthog_region must be us or eu')
    body = {'query':{'kind':'HogQLQuery','query':sql}, 'async':False}
    def fetch():
        raw = client.http('https://'+region+'.posthog.com/api/projects/'+project+'/query/', body, {'Authorization':'Bearer '+client.secret('POSTHOG_PERSONAL_API_KEY')})
        if raw.get('error') or (raw.get('query_status') or {}).get('error'):
            raise GrowthError('PostHog query failed', 'provider_error')
        if 'results' not in raw:
            raise GrowthError('PostHog did not return completed results; retry later.', 'incomplete_response')
        return dict(raw=raw, truncated=len(raw['results'])>=10001,
                    note='Events, not sessions. Form submissions and CTA clicks are not confirmed subscriptions. Missing events may mean missing instrumentation.')
    return client.collect('posthog.traffic', dict(provider='posthog', project=project, region=region, start=start,end=end,body=body), fetch, refresh, dry_run, dict(timezone='UTC'))
