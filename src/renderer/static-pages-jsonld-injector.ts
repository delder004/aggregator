/**
 * Post-process top-level static pages (/about, /faq, /resources) to inject
 * JSON-LD before </body>.
 *
 * As of Cycle 3 (2026-05-11), these three high-trust top-level pages have
 * ZERO structured data — making them invisible to Google's entity-graph
 * understanding of what this site is "about". Adding type-appropriate schema
 * is a small win that compounds for branded queries and AI Overview eligibility.
 *
 * Pattern mirrors `jobs-jsonld-injector.ts` (PR #33): take the pages record,
 * walk keys, inject schema for matching paths before </body>. Defensive: skip
 * pages that already contain application/ld+json (so re-running is idempotent).
 *
 * Integration in pages.ts (1-line wrap, applied at the end of generateAllPages):
 *
 *   import { injectStaticPagesJsonLd } from './static-pages-jsonld-injector';
 *
 *   // Just before `return pages;` at the bottom of generateAllPages:
 *   return injectStaticPagesJsonLd(pages);
 */

const SITE_URL = 'https://agenticaiccounting.com';
const ORG_NAME = 'Agentic AI Accounting';
const ORG_DESCRIPTION =
  'Daily curated news, companies, and jobs in agentic AI for accounting, audit, tax, and bookkeeping. Updated hourly from 110+ sources with AI relevance scoring.';

function organizationNode(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: ORG_NAME,
    url: SITE_URL,
    description: ORG_DESCRIPTION,
    logo: `${SITE_URL}/og.png`,
  };
}

function websiteNode(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    name: ORG_NAME,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

function jsonLdScript(graph: Record<string, unknown>[]): string {
  const payload = { '@context': 'https://schema.org', '@graph': graph };
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function aboutPageJsonLd(): string {
  return jsonLdScript([
    {
      '@type': 'AboutPage',
      '@id': `${SITE_URL}/about`,
      url: `${SITE_URL}/about`,
      name: 'About — Agentic AI Accounting',
      description:
        'About Agentic AI Accounting — the daily news hub for AI in accounting, audit, tax, and bookkeeping. Fully automated, ad-free, no client-side JavaScript.',
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@id': `${SITE_URL}#organization` },
      mainEntity: { '@id': `${SITE_URL}#organization` },
    },
    organizationNode(),
    websiteNode(),
  ]);
}

function resourcesPageJsonLd(): string {
  return jsonLdScript([
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/resources`,
      url: `${SITE_URL}/resources`,
      name: 'Resources — Agentic AI Accounting',
      description:
        'Insights, guides, and essential resources for understanding agentic AI in accounting, audit, tax, and bookkeeping.',
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@id': `${SITE_URL}#organization` },
    },
    organizationNode(),
    websiteNode(),
  ]);
}

/**
 * Extract Q/A pairs from the /faq page markup.
 *
 * The page uses a known structure: <li class="faq-item"><h3>Q</h3><p>A</p>...</li>.
 * If the structure ever changes, the regex falls back to returning [] and the
 * caller emits a WebPage schema instead of an invalid FAQPage.
 */
function extractFaqPairs(html: string): Array<{ q: string; a: string }> {
  const pairs: Array<{ q: string; a: string }> = [];
  const itemRe = /<li[^>]*class="[^"]*faq-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[1];
    const qMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const aMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!qMatch || !aMatch) continue;
    const q = stripTags(qMatch[1]).trim();
    const a = stripTags(aMatch[1]).trim();
    if (q.length >= 5 && q.length <= 300 && a.length >= 10) {
      pairs.push({ q, a: a.slice(0, 1500) });
    }
  }
  return pairs;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function faqPageJsonLd(html: string): string {
  const pairs = extractFaqPairs(html);
  if (pairs.length === 0) {
    // Defensive fallback: structure must have changed. Emit WebPage instead of
    // an empty/invalid FAQPage so Google still has something to anchor on.
    return jsonLdScript([
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/faq`,
        url: `${SITE_URL}/faq`,
        name: 'FAQ — Agentic AI Accounting',
        isPartOf: { '@id': `${SITE_URL}#website` },
        about: { '@id': `${SITE_URL}#organization` },
      },
      organizationNode(),
      websiteNode(),
    ]);
  }

  return jsonLdScript([
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/faq`,
      url: `${SITE_URL}/faq`,
      name: 'FAQ — Agentic AI Accounting',
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@id': `${SITE_URL}#organization` },
      mainEntity: pairs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
    organizationNode(),
    websiteNode(),
  ]);
}

/**
 * For each top-level static page in `pages`, inject the appropriate JSON-LD
 * just before </body>. Pages that already contain JSON-LD are skipped to keep
 * this idempotent (so we never double-stack schemas on re-runs).
 *
 * Pages without a </body> tag are passed through unchanged (defensive).
 */
export function injectStaticPagesJsonLd(
  pages: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...pages };
  const targets: Record<string, (html: string) => string> = {
    '/about': () => aboutPageJsonLd(),
    '/faq': html => faqPageJsonLd(html),
    '/resources': () => resourcesPageJsonLd(),
  };

  for (const [path, builder] of Object.entries(targets)) {
    const html = result[path];
    if (!html) continue;
    if (!html.includes('</body>')) continue;
    if (html.includes('application/ld+json')) continue; // idempotent

    const jsonLd = builder(html);
    result[path] = html.replace('</body>', `${jsonLd}\n</body>`);
  }

  return result;
}
