import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import Client, Store, GrowthError
from providers import research, gsc_collect, posthog
from analysis import import_gsc, report, change_add, impact
from audit import audit

class GrowthTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.store=Store(self.temp.name);self.addCleanup(self.store.db.close)
        self.client=Client(dict(site_url='https://example.com',gsc_property='sc-domain:example.com',posthog_project_id='1',max_api_requests_per_run=3),dict(DATAFORSEO_LOGIN='user',DATAFORSEO_PASSWORD='secret',GSC_ACCESS_TOKEN='secret',POSTHOG_PERSONAL_API_KEY='secret'),self.store)
    def test_store_can_move_with_evidence(self):
        import shutil
        record=self.store.save('test',{},dict(value=1))
        self.store.db.close()
        destination=Path(self.temp.name)/'moved'
        destination.mkdir()
        shutil.move(str(Path(self.temp.name)/'evidence'),destination/'evidence')
        shutil.move(str(Path(self.temp.name)/'growth.sqlite'),destination/'growth.sqlite')
        moved=Store(destination);self.addCleanup(moved.db.close)
        self.assertEqual(moved.get(record['id'])['data']['value'],1)

    def test_cache_avoids_paid_repeat(self):
        self.client.http=Mock(return_value={'status_code':20000,'tasks':[{'status_code':20000,'result':[]}],'cost':0.01})
        a=research(self.client,'volume',{'keywords':['abc']});b=research(self.client,'volume',{'keywords':['abc']})
        self.assertEqual(a['id'],b['id']);self.assertTrue(b['cache_hit']);self.assertEqual(self.client.http.call_count,1)
    def test_failed_serp_is_not_absent_rank_or_cached(self):
        self.client.http=Mock(return_value={'status_code':20000,'tasks':[{'status_code':40101}]})
        for _ in range(2):
            with self.assertRaises(GrowthError):research(self.client,'serp',{'keyword':'abc'})
        self.assertEqual(self.client.http.call_count,2)
        for r in self.store.history():self.assertEqual(r['status'],'error');self.assertIsNone(self.store.get(r['id'])['data'])
    def test_successful_serp_records_actual_depth_and_rank(self):
        self.client.http=Mock(return_value={'status_code':20000,'tasks':[{'status_code':20000,'result':[{'items':[{'type':'organic','url':'https://example.com/a','rank_group':7}]}]}]})
        rank=research(self.client,'serp',{'keyword':'abc'})['data']['our_ranking']
        self.assertEqual(rank['rank'],7);self.assertEqual(rank['organic_results_returned'],1)
    def test_malformed_provider_persisted_as_failure(self):
        self.client.http=Mock(return_value=[])
        with self.assertRaises(GrowthError):research(self.client,'volume',{'keywords':['abc']})
        self.assertEqual(self.store.history()[0]['status'],'error')
    def test_gsc_exact_filters_and_pagination(self):
        row={'keys':['abc'],'clicks':0,'impressions':1,'position':2}
        self.client.http=Mock(side_effect=[{'rows':[row]*25000},{'rows':[]}])
        result=gsc_collect(self.client,'2026-09-01','2026-09-28',['query'],page='https://example.com/a')
        body=self.client.http.call_args_list[1].args[1]
        self.assertEqual(body['startRow'],25000);self.assertEqual(body['dataState'],'final')
        self.assertEqual(body['dimensionFilterGroups'][0]['filters'][0]['expression'],'https://example.com/a')
        self.assertFalse(result['data']['source_exhaustive'])
    def test_posthog_is_inclusive_end_and_not_sessions(self):
        self.client.http=Mock(return_value={'results':[], 'query_status':None})
        result=posthog(self.client,'2026-09-01','2026-09-28')
        self.assertIn('2026-09-29',result['request']['body']['query']['query'])
        self.assertIn('not sessions',result['data']['note'])
    def test_import_uses_chart_not_anonymized_query_totals(self):
        p=Path(self.temp.name)/'export';p.mkdir()
        (p/'Chart.csv').write_text('Date,Clicks,Impressions,CTR,Position\n2026-09-01,3,100,3%,20\n')
        (p/'Queries.csv').write_text('Top queries,Clicks,Impressions,CTR,Position\nabc,1,50,2%,25\n')
        (p/'Filters.csv').write_text('Filter,Value\nSearch type,Web\n')
        record=import_gsc(self.store,p,'https://example.com');result=report(self.store,record['id'])
        self.assertEqual(result['totals']['clicks'],3);self.assertEqual(result['opportunities'][0]['clicks'],1)
        self.assertIsNone(result['opportunities'][0]['market_volume'])
    def evidence(self,start,end,filters=None):
        body=dict(startDate=start,endDate=end,type='web',dimensionFilterGroups=filters or [])
        return self.store.save('gsc.search',dict(property='sc-domain:example.com',body=body),dict(dimensions=['date'],rows=[dict(keys=[start],clicks=1,impressions=100,position=10)]))['id']
    def test_impact_rejects_scope_mismatch_and_avoids_causal_claim(self):
        change_add(self.store,dict(id='c',hypothesis='test',urls=['https://example.com/a'],deployed_at='2026-09-29T12:00:00-07:00',primary_metric='gsc_clicks'))
        a=self.evidence('2026-09-01','2026-09-28');b=self.evidence('2026-10-06','2026-11-02')
        self.assertEqual(impact(self.store,'c',a,b)['conclusion'],'insufficient_evidence')
        bad=self.evidence('2026-10-06','2026-11-02',[{'filters':[{'dimension':'query','expression':'abc'}]}])
        with self.assertRaisesRegex(GrowthError,'scopes differ'):impact(self.store,'c',a,bad)
        early=self.evidence('2026-09-29','2026-10-26')
        with self.assertRaisesRegex(GrowthError,'deployment day'):impact(self.store,'c',a,early)
    def test_failed_audit_is_partial_and_not_cached(self):
        with patch('audit.fetch',side_effect=GrowthError('offline','network_error')) as fetch:
            a=audit(self.client,['https://example.com']);b=audit(self.client,['https://example.com'])
        self.assertEqual(a['status'],'partial_failure');self.assertNotEqual(a['id'],b['id']);self.assertEqual(fetch.call_count,2)
    def test_dry_run_needs_no_credentials_or_network(self):
        self.client.credentials={};self.client.http=Mock(side_effect=AssertionError('network'))
        self.assertEqual(research(self.client,'trends',{'keywords':['a']},dry_run=True)['status'],'planned')
        self.assertEqual(self.store.history(),[])
        with self.assertRaises(GrowthError):research(self.client,'trends',{'keywords':list('abcdef')},dry_run=True)

if __name__=='__main__':unittest.main()
