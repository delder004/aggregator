/** Public ingestion token (not a personal/API administration secret). */
export const POSTHOG_TOKEN = 'phc_mo5roHQkwTMVaScb8v4Jv8C4wUKzcJGXapbaNztBLDhg';

// Explicit events only: never capture form contents, search terms, or recordings.
export const POSTHOG_SCRIPT = String.raw`(function () {
  if (location.hostname !== 'agenticaiccounting.com' || navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  var ph = window.posthog = window.posthog || [];
  if (ph.__SV) return;
  ph._i = [];
  ph.init = function (token, config) { ph._i.push([token, config, 'posthog']); };
  ph.capture = function () { ph.push(['capture'].concat(Array.prototype.slice.call(arguments))); };
  ph.__SV = 1;
  function cleanUrl(value) {
    try { var u = new URL(value); return u.origin + u.pathname; } catch (_) { return ''; }
  }
  ph.init('${POSTHOG_TOKEN}', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    cookieless_mode: 'always',
    person_profiles: 'never',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    capture_heatmaps: false,
    capture_performance: false,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    before_send: function (event) {
      if (!event) return null;
      var p = event.properties || {};
      // Strip all URL query/fragment data; search terms and emails can occur there.
      ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$session_entry_url', '$session_entry_referrer', '$session_exit_url'].forEach(function (k) {
        if (p[k]) p[k] = cleanUrl(p[k]);
      });
      delete p.$title;
      Object.keys(p).forEach(function (k) {
        if (/^(\$initial_)?(utm_|gclid|fbclid|msclkid)/.test(k)) delete p[k];
      });
      p.page_type = location.pathname.split('/')[1] || 'home';
      return event;
    }
  });
  var script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://us-assets.i.posthog.com/static/array.js';
  document.head.appendChild(script);
  if (location.pathname === '/search') ph.capture('site_search');
  document.addEventListener('click', function (event) {
    var link = event.target instanceof Element && event.target.closest('a[href]');
    if (!link) return;
    try {
      var target = new URL(link.href);
      if (!/^https?:$/.test(target.protocol)) return;
      if (target.hostname !== location.hostname) {
        ph.capture('outbound_link_clicked', { destination_host: target.hostname, destination_path: target.pathname });
        if (target.hostname === 'buttondown.com' && target.pathname === '/agenticaiccounting') ph.capture('newsletter_link_clicked');
      }
    } catch (_) {}
  });
  document.addEventListener('submit', function (event) {
    if (event.target instanceof HTMLFormElement && new URL(event.target.action).pathname === '/subscribe') {
      ph.capture('newsletter_form_submitted');
    }
  });
})();`;

/** Wrap after the application/cache layer so existing KV and edge HTML gets tracking too. */
export function addPostHog(request: Request, response: Response): Response {
  const url = new URL(request.url);
  if (url.hostname !== 'agenticaiccounting.com' || request.method !== 'GET' ||
      response.status !== 200 || !response.headers.get('content-type')?.includes('text/html') ||
      url.pathname.startsWith('/ops') || url.pathname === '/cron') return response;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new HTMLRewriter().on('head', {
    element(element) {
      element.append('<script defer src="/site-analytics.js"></script>', { html: true });
    },
  }).transform(new Response(response.body, { status: response.status, headers }));
}
