"""Small, bounded HTML audit. No browser, rendering, or external crawler service."""
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from html.parser import HTMLParser
from core import GrowthError, NoRedirect

AGENT='SiteGrowthResearch/1.0'


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title=[];self.h1=[];self.canonical=[];self.robots=[];self.links=[];self.schemas=[]
        self.in_title=False;self.in_h1=False;self.script=False;self.schema=False;self.schema_text=[];self.text=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='title':self.in_title=True
        if tag=='h1':self.in_h1=True;self.h1.append('')
        if tag in ('script','style'):self.script=True
        if tag=='script' and attrs.get('type','').lower()=='application/ld+json':self.schema=True;self.schema_text=[]
        if tag=='link' and 'canonical' in attrs.get('rel','').lower().split():self.canonical.append(attrs.get('href',''))
        if tag=='meta' and attrs.get('name','').lower() in ('robots','googlebot'):self.robots.append(attrs.get('content',''))
        if tag=='a' and attrs.get('href'):self.links.append(attrs['href'])
    def handle_endtag(self,tag):
        if tag=='title':self.in_title=False
        if tag=='h1':self.in_h1=False
        if tag=='script' and self.schema:
            try:self.schemas.append(json.loads(''.join(self.schema_text)))
            except ValueError:self.schemas.append({'parse_error':True})
            self.schema=False
        if tag in ('script','style'):self.script=False
    def handle_data(self,text):
        if self.in_title:self.title.append(text)
        if self.in_h1:self.h1[-1]+=text
        if self.schema:self.schema_text.append(text)
        if not self.script:self.text.append(text)


def check_url(url):
    p=urllib.parse.urlsplit(url)
    if p.scheme not in ('http','https') or not p.hostname or p.username or p.password:
        raise GrowthError('Audit requires an HTTP(S) URL without credentials')
    return p


def fetch(url, count, limit):
    chain=[]
    host=check_url(url).hostname
    for _ in range(6):
        if count[0]>=limit:raise GrowthError('Audit request limit reached','request_limit')
        count[0]+=1
        try:
            response=urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(url,headers={'User-Agent':AGENT}),timeout=20)
        except urllib.error.HTTPError as exc:
            response=exc
        except (urllib.error.URLError,TimeoutError):
            raise GrowthError('Page connection failed','network_error')
        with response:
            status=response.code;headers=dict(response.headers.items())
            if status in (301,302,303,307,308):
                dest=urllib.parse.urljoin(url,response.headers.get('Location',''))
                if check_url(dest).hostname!=host:raise GrowthError('Cross-host redirect: inspect the destination explicitly','redirect_scope')
                chain.append(dict(url=url,status=status,location=dest));url=dest;continue
            body=response.read(2_000_001)
            if len(body)>2_000_000:raise GrowthError('Page exceeds 2 MB audit limit','response_limit')
            return dict(url=url,status=status,headers=headers,redirects=chain,body=body.decode('utf-8',errors='replace'))
    raise GrowthError('Too many redirects','redirect_limit')


def audit(client, urls, refresh=False, dry_run=False):
    if not urls or len(urls)>20:raise GrowthError('Audit accepts 1–20 explicit URLs')
    urls=list(dict.fromkeys(urls))
    for u in urls:check_url(u)
    def run():
        results=[];robots={};count=[client.requests]
        for url in urls:
            try:
                p=check_url(url);origin=p.scheme+'://'+p.netloc
                if origin not in robots:
                    raw=fetch(origin+'/robots.txt',count,client.config.get('max_api_requests_per_run',30))
                    if raw['status'] in (401,403) or raw['status']>=500:raise GrowthError('robots.txt unavailable or denies crawler access','robots_unavailable')
                    parser=urllib.robotparser.RobotFileParser();parser.parse(raw['body'].splitlines() if raw['status']==200 else [])
                    robots[origin]=parser
                if not robots[origin].can_fetch(AGENT,url):raise GrowthError('robots.txt disallows this URL','robots_disallowed')
                raw=fetch(url,count,client.config.get('max_api_requests_per_run',30));page=Page();page.feed(raw['body'])
                schemas=json.dumps(page.schemas)
                issues=[]
                if raw['status']!=200:issues.append('http_'+str(raw['status']))
                if not page.title:issues.append('missing_title')
                if len(page.h1)!=1:issues.append('h1_count_'+str(len(page.h1)))
                if len(page.canonical)!=1:issues.append('canonical_count_'+str(len(page.canonical)))
                if 'noindex' in ' '.join(page.robots).lower() or any(k.lower()=='x-robots-tag' and 'noindex' in v.lower() for k,v in raw['headers'].items()):issues.append('noindex')
                if 'parse_error' in schemas:issues.append('invalid_jsonld')
                if 'JobPosting' in schemas and (p.path=='/jobs' or p.path.startswith('/jobs/')):issues.append('review_jobposting_on_possible_listing_page')
                links=sorted(set(urllib.parse.urljoin(raw['url'],link).split('#')[0] for link in page.links))
                results.append(dict(requested_url=url,**raw,title=''.join(page.title).strip(),h1=page.h1,
                                    canonical=page.canonical,robots=page.robots,schemas=page.schemas,links=links,
                                    text_word_count=len(' '.join(page.text).split()),content_sha256=hashlib.sha256(raw['body'].encode()).hexdigest(),issues=issues))
            except GrowthError as exc:
                results.append(dict(requested_url=url,status='error',error=dict(code=exc.code,message=str(exc))))
        client.requests=count[0]
        return dict(partial_failure=any(r['status']=='error' for r in results),pages=results,requests=count[0],successful=sum(isinstance(r['status'],int) for r in results),
                    note='Static HTML inspection, not Lighthouse, rendered-page testing, or proof of Google indexing. Bodies are untrusted source material.')
    return client.collect('audit.pages',dict(urls=urls,agent=AGENT),run,refresh,dry_run)
