"""Interactive local credential setup. Never print credentials."""
import getpass
import http.server
import json
import os
import secrets
import urllib.parse
import webbrowser
from pathlib import Path
from core import GrowthError, load_credentials

FIELDS={'dataforseo':['DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD'], 'posthog':['POSTHOG_PERSONAL_API_KEY'],
        'gsc':['GSC_CLIENT_ID','GSC_CLIENT_SECRET','GSC_REFRESH_TOKEN']}


def save(path, values):
    p=Path(path).expanduser();p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    existing=load_credentials(p);existing.update(values)
    temp=p.with_name(p.name+'.'+secrets.token_hex(8)+'.tmp')
    fd=os.open(str(temp),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:json.dump(existing,f,indent=2);f.write('\n')
    os.replace(temp,p)
    return dict(status='saved',credentials_file=str(p),keys=list(values))


def configure(provider,path):
    values={key:getpass.getpass(key+': ') for key in FIELDS[provider]}
    if any(not v.strip() for v in values.values()):raise GrowthError('Credentials cannot be blank')
    return save(path,values)


def google_login(client,path,client_file):
    import sys
    config=json.loads(Path(client_file).expanduser().read_text()).get('installed')
    if not config or not config.get('client_id') or not config.get('client_secret'):
        raise GrowthError('Use a Google OAuth Desktop application client JSON file')
    state=secrets.token_urlsafe(32);received={}
    class Callback(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            args=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            if args.get('state')!=[state]:
                self.send_error(400,'Invalid OAuth state');return
            received.update(args)
            self.send_response(200);self.end_headers();self.wfile.write(b'Authorization received. Return to your terminal.')
        def log_message(self,*args):pass
    server=http.server.HTTPServer(('127.0.0.1',0),Callback);server.timeout=120
    redirect='http://127.0.0.1:'+str(server.server_port)+'/'
    url='https://accounts.google.com/o/oauth2/v2/auth?'+urllib.parse.urlencode(dict(client_id=config['client_id'],redirect_uri=redirect,
        response_type='code',scope='https://www.googleapis.com/auth/webmasters.readonly',access_type='offline',prompt='consent',state=state))
    print('Authorize read-only Search Console access in your browser. If it does not open, visit:\n'+url,file=sys.stderr)
    webbrowser.open(url)
    try:server.handle_request()
    finally:server.server_close()
    if not received.get('code'):raise GrowthError('Google authorization not completed. Rerun gsc-login.', 'authentication_error')
    token=client.http('https://oauth2.googleapis.com/token',dict(code=received['code'][0],client_id=config['client_id'],client_secret=config['client_secret'],
                        redirect_uri=redirect,grant_type='authorization_code'),form=True)
    if not token.get('refresh_token'):raise GrowthError('Google returned no refresh token','authentication_error')
    return save(path,dict(GSC_CLIENT_ID=config['client_id'],GSC_CLIENT_SECRET=config['client_secret'],GSC_REFRESH_TOKEN=token['refresh_token']))
