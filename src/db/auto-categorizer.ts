/**
 * Auto-categorizer for uncategorized companies based on their article tags.
 * 
 * For each company without a category, this module:
 * 1. Fetches all articles mentioning that company
 * 2. Aggregates the AI-scored tags from those articles
 * 3. Determines the most relevant category using tag-frequency heuristics
 * 4. Updates the company's category and category_slug
 */

import type { D1Database } from '@cloudflare/workers-types';
import { classifyFreeTextCategory } from '../categories';

interface CompanyTagStats {
  companyId: string;
  companyName: string;
  tags: Record<string, number>;
  totalArticles: number;
}

/**
 * Maps common article tags to category classifiers.
 * Used to inform the category selection when tag frequency is ambiguous.
 */
const TAG_TO_CATEGORY_SIGNALS: Record<string, string> = {
  'audit': 'Audit Automation',
  'tax': 'Tax Automation',
  'bookkeeping': 'Bookkeeping & Close',
  'ap-automation': 'AP & Spend Management',
  'ar-automation': 'AR & Collections',
  'compliance': 'Compliance & Regulatory',
  'financial-reporting': 'FP&A & Reporting',
  'agentic-ai': 'AI-Native ERP',
  'automation': 'Bookkeeping & Close',
  'startup': 'Other',
};

/**
 * Get tag statistics for a single uncategorized company.
 */
async function getCompanyTagStats(
  db: D1Database,
  companyId: string,
  companyName: string,
): Promise<CompanyTagStats | null> {
  try {
    const result = await db
      .prepare(
        `
        SELECT COALESCE(a.tags, '[]') as tags
        FROM article_companies ac
        JOIN articles a ON ac.article_id = a.id
        WHERE ac.company_id = ?
        ORDER BY a.published_at DESC
      `,
      )
      .bind(companyId)
      .all();

    if (!result.results || result.results.length === 0) {
      return null;
    }

    const tagFreq: Record<string, number> = {};
    for (const row of result.results) {
      try {
        const tagsStr = String(row.tags || '[]');
        const tags = JSON.parse(tagsStr) as string[];
        for (const tag of tags) {
          tagFreq[tag] = (tagFreq[tag] || 0) + 1;
        }
      } catch {
        // Silently skip malformed JSON tags
      }
    }

    return {
      companyId,
      companyName,
      tags: tagFreq,
      totalArticles: result.results.length,
    };
  } catch {
    // If the query fails, return null to skip this company
    return null;
  }
}

/**
 * Infer a category string from tag frequency analysis.
 * Returns a free-text category that can be passed to classifyFreeTextCategory().
 */
function inferCategoryFromTags(stats: CompanyTagStats): string {
  if (stats.totalArticles === 0) {
    return 'other';
  }

  // Count relevant tags
  const sorted = Object.entries(stats.tags)
    .sort(([, countA], [, countB]) => countB - countA);

  // Build a candidate category string by combining high-frequency tags
  const candidates: string[] = [];
  for (const [tag, count] of sorted) {
    const signal = TAG_TO_CATEGORY_SIGNALS[tag];
    if (signal && count >= 1) {
      candidates.push(signal);
    }
  }

  if (candidates.length === 0) {
    // Fallback: use the most common tag name directly
    if (sorted.length > 0) {
      return sorted[0][0];
    }
    return 'other';
  }

  // Return the concatenation; classifyFreeTextCategory will parse it
  return candidates.join(' ');
}

/**
 * Auto-categorize a single uncategorized company.
 * Returns { category, categorySlug } or null if categorization fails.
 */
async function categorizeSingleCompany(
  db: D1Database,
  companyId: string,
  companyName: string,
): Promise<{ category: string; categorySlug: string } | null> {
  const stats = await getCompanyTagStats(db, companyId, companyName);
  if (!stats) {
    return null;
  }

  const inferredCategory = inferCategoryFromTags(stats);
  const categorySlug = classifyFreeTextCategory(inferredCategory);

  return {
    category: inferredCategory,
    categorySlug,
  };
}

/**
 * Main entry point: auto-categorize all uncategorized companies.
 * Returns a summary of how many were updated.
 */
export async function autoCategorizUncategorizedCompanies(
  db: D1Database,
): Promise<{ categorized: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let categorized = 0;
  let skipped = 0;

  try {
    // Fetch all uncategorized companies
    const companyResult = await db
      .prepare(
        `
        SELECT id, name
        FROM companies
        WHERE category IS NULL OR category = ''
        ORDER BY article_count DESC
        LIMIT 200
      `,
      )
      .all();

    if (!companyResult.results) {
      return { categorized, skipped, errors: ['Failed to fetch uncategorized companies'] };
    }

    // Process each company
    for (const company of companyResult.results) {
      const companyId = String(company.id);
      const companyName = String(company.name);

      try {
        const categorization = await categorizeSingleCompany(db, companyId, companyName);

        if (!categorization) {
          skipped++;
          continue;
        }

        // Update the company in the database
        await db
          .prepare(
            `
            UPDATE companies
            SET category = ?, category_slug = ?
            WHERE id = ?
          `,
          )
          .bind(categorization.category, categorization.categorySlug, companyId)
          .run();

        categorized++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to categorize ${companyName}: ${msg}`);
        skipped++;
      }
    }

    return { categorized, skipped, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal error in autoCategorizUncategorizedCompanies: ${msg}`);
    return { categorized, skipped, errors };
  }
}
