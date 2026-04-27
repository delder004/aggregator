/**
 * One-shot reclassifier for companies stuck in the `other` taxonomy bucket.
 *
 * Migration 032 only had access to `companies.category` (a free-text column),
 * which is NULL for any row that came in via the auto-discovery path. This
 * script pulls those rows, asks Haiku to bucket each one into the controlled
 * vocabulary using `name` + `description` + `website`, and writes the result
 * back to D1.
 *
 * Run from the repo root:
 *   npx tsx --env-file=scripts/.env scripts/reclassify-other-companies.mts
 *
 * Re-running is safe — it only acts on rows still in `other`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Inlined from src/categories.ts so this script can run under plain tsx
// without TS path-extension resolution. Keep in sync with that file.
const CATEGORIES: ReadonlyArray<{ slug: string; label: string; description: string }> = [
  { slug: 'ai-native-erp', label: 'AI-Native ERP', description: 'Ground-up financial systems where the general ledger, close, and reporting are AI-driven by default.' },
  { slug: 'ai-bookkeeping', label: 'AI Bookkeeping & Close', description: 'Automated transaction categorization, reconciliations, accruals, and month-end close for SMBs and finance teams.' },
  { slug: 'ai-firm', label: 'AI-Enabled Accounting Firms', description: 'Service firms — bookkeeping, fractional CFO, tax — running on top of an internal AI stack.' },
  { slug: 'ap-automation', label: 'AP & Spend Management', description: 'Bill capture, approvals, payments, expense management, and spend controls.' },
  { slug: 'ar-automation', label: 'AR & Collections', description: 'Invoice-to-cash automation: invoicing, dunning, collections, cash application.' },
  { slug: 'audit-automation', label: 'AI Audit', description: 'AI for external audit, internal audit, and assurance.' },
  { slug: 'tax-automation', label: 'AI Tax', description: 'Direct tax, indirect tax, sales tax, transfer pricing, and tax research automation.' },
  { slug: 'fpa-reporting', label: 'FP&A & Reporting', description: 'Financial planning, forecasting, consolidation, management reporting.' },
  { slug: 'practice-management', label: 'Practice Management', description: 'Workflow, client portals, document management, and engagement orchestration for accounting/tax practices.' },
  { slug: 'compliance', label: 'Compliance & Regulatory', description: 'SOX, statutory reporting, ESG/CSRD, AML, and regulatory filing automation.' },
  { slug: 'data-extraction', label: 'Document & Data Extraction', description: 'OCR, document understanding, structured-data extraction from invoices, receipts, contracts.' },
  { slug: 'ai-cfo', label: 'AI CFO & Advisory', description: 'Decision-support copilots aimed at CFOs/controllers — cash-flow advisory, scenario planning.' },
  { slug: 'payroll-hr', label: 'Payroll & HR Finance', description: 'Payroll, benefits, contractor payments, HR-finance automation where AI is the differentiator.' },
  { slug: 'infrastructure', label: 'Agent & Data Infrastructure', description: 'Agent frameworks, accounting-data APIs, ledger primitives, and connectors used by other AI-accounting products.' },
  { slug: 'other', label: 'Other', description: 'Companies in adjacent or emerging niches that do not yet fit a primary bucket.' },
];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY (load via --env-file=scripts/.env)');
  process.exit(1);
}

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 20;
const NON_OTHER_SLUGS = CATEGORIES.filter((c) => c.slug !== 'other').map(
  (c) => c.slug
);

interface Row {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  category: string | null;
}

function wrangler(args: string[]): string {
  // Strip the read-only CF API token loaded from scripts/.env so wrangler
  // falls back to the user's OAuth login (which has D1 write permission).
  const env = { ...process.env };
  delete env.CF_API_TOKEN;
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CF_ACCOUNT_ID;
  delete env.CLOUDFLARE_ACCOUNT_ID;
  return execFileSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    env,
  });
}

function fetchOtherCompanies(): Row[] {
  const sql =
    "SELECT id, name, description, website, category FROM companies " +
    "WHERE is_active = 1 AND category_slug = 'other' " +
    'ORDER BY article_count DESC, name';
  const out = wrangler([
    'd1',
    'execute',
    'DB',
    '--remote',
    '--json',
    `--command=${sql}`,
  ]);
  const parsed = JSON.parse(out);
  // wrangler --json wraps results in an array of one element
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  return (block.results ?? []) as Row[];
}

function buildPrompt(batch: Row[]): string {
  const slugList = CATEGORIES.map(
    (c) => `- ${c.slug}: ${c.label} — ${c.description}`
  ).join('\n');

  const rows = batch
    .map((r, i) => {
      const desc = (r.description || '').slice(0, 240);
      const cat = (r.category || '').slice(0, 80);
      const website = r.website || '';
      return `${i + 1}. id=${r.id}\n   name: ${r.name}\n   description: ${desc}\n   raw_category: ${cat}\n   website: ${website}`;
    })
    .join('\n\n');

  return `You are classifying AI-accounting companies into a controlled taxonomy.

Taxonomy (return one slug from this list per company; use "other" only when truly ambiguous):
${slugList}

For each company below, return JSON: an array of {"id": "...", "slug": "..."} matching the input order.

Companies:
${rows}

Respond with ONLY the JSON array, no prose.`;
}

interface Classification {
  id: string;
  slug: string;
}

async function classifyBatch(
  client: Anthropic,
  batch: Row[]
): Promise<Classification[]> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt(batch) }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  // Strip code fences if present
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array, got: ${typeof parsed}`);
  }
  return parsed as Classification[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

function applyUpdates(updates: Classification[]): void {
  const valid = updates.filter(
    (u) =>
      typeof u.id === 'string' &&
      typeof u.slug === 'string' &&
      NON_OTHER_SLUGS.includes(u.slug)
  );
  if (valid.length === 0) {
    console.log('No valid updates to apply.');
    return;
  }
  const stmts = valid
    .map(
      (u) =>
        `UPDATE companies SET category_slug = '${u.slug}' WHERE id = '${escapeSqlString(u.id)}' AND category_slug = 'other';`
    )
    .join('\n');
  const tmpFile = join(tmpdir(), `reclassify-${Date.now()}.sql`);
  writeFileSync(tmpFile, stmts + '\n');
  try {
    const out = wrangler(['d1', 'execute', 'DB', '--remote', `--file=${tmpFile}`]);
    const written = (out.match(/(\d+) rows written/) || ['', '?'])[1];
    console.log(`Applied ${valid.length} UPDATE statements (rows written: ${written})`);
  } finally {
    unlinkSync(tmpFile);
  }
}

async function main(): Promise<void> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  console.log('Fetching companies stuck in `other`...');
  const rows = fetchOtherCompanies();
  console.log(`Found ${rows.length} candidate rows.`);
  if (rows.length === 0) return;

  const batches = chunk(rows, BATCH_SIZE);
  console.log(`Classifying in ${batches.length} batch(es) of up to ${BATCH_SIZE}...`);

  const allUpdates: Classification[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`  batch ${i + 1}/${batches.length} (${batch.length} rows)... `);
    try {
      const result = await classifyBatch(client, batch);
      allUpdates.push(...result);
      console.log(`got ${result.length}`);
    } catch (err) {
      console.error(`failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Tally distribution
  const dist = new Map<string, number>();
  for (const u of allUpdates) dist.set(u.slug, (dist.get(u.slug) ?? 0) + 1);
  console.log('\nProposed distribution:');
  for (const [slug, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug.padEnd(22)} ${n}`);
  }

  // Sample of 8 for sanity check
  console.log('\nSample classifications:');
  for (const u of allUpdates.slice(0, 8)) {
    const row = rows.find((r) => r.id === u.id);
    console.log(`  ${u.slug.padEnd(22)} ${row?.name ?? u.id} — ${row?.description?.slice(0, 60) ?? ''}`);
  }

  console.log('\nApplying updates to D1 (remote)...');
  applyUpdates(allUpdates);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
