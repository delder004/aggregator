# Traffic measurement

PostHog organization: Agentic AI Accounting, US Cloud, capped Free plan.
Project: https://us.posthog.com/project/669488
Web dashboard: https://us.posthog.com/project/669488/web
Live events: https://us.posthog.com/project/669488/activity/events
Search Console: https://search.google.com/search-console?resource_id=sc-domain%3Aagenticaiccounting.com

`src/analytics/posthog.ts` injects a deferred script after the application's cache layer. This covers existing KV HTML, edge cache hits, and dynamic pages immediately without regenerating content. Only successful public HTML on the production hostname is instrumented. XML, ops routes, previews, localhost, and failed responses are excluded.

Events:
- `$pageview` / `$pageleave`: traffic, pages, referrers, engagement.
- `outbound_link_clicked`: destination host/path, without query or fragment.
- `site_search`: a search page was viewed; query text is not collected.
- `newsletter_link_clicked`: the current Buttondown newsletter CTA was clicked, NOT a completed subscription.
- `newsletter_form_submitted`: a submission attempt, NOT proof of a successful signup. Authoritative confirmed signups remain in D1 and the Cloudflare engagement conversion events.

Cookieless tracking is enabled in both PostHog project settings and SDK. No persistent visitor cookies, session replay, autocapture of form contents, heatmaps, surveys, or person profiles. Global Privacy Control and Do Not Track suppress SDK loading. URLs are stripped of query strings and fragments, page titles are removed, and campaign identifiers are dropped. Therefore this initial setup supports referrer attribution, but not UTM campaign reporting. The public project ingestion token is intentionally in source; it cannot read analytics or administer the account.

Cookieless identity is approximate and cannot reliably measure returning visitors across days. PostHog notes cookieless mode removes IPs before GeoIP/bot transformations, so use Cloudflare separately for geography and crawler diagnostics. Browser blockers and privacy preferences cause undercounting. Do not compare these totals directly with Cloudflare edge requests or competitor estimates.

Monitoring: use Web Analytics for daily traffic/referrers/top pages and Product Analytics for custom event trends. Check weekly against Search Console impressions/clicks and Cloudflare's confirmed subscription records. No scheduled email reports or external alerts are configured.

Rollback: remove the `addPostHog` wrapper and `/site-analytics.js` endpoint in `src/index.ts`, or disable the project token. No database migration is involved.
