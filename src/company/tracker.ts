import type { Article, Company, ScoredArticle, SourceType } from '../types';

/**
 * Company entity manager for tracking accounting AI companies.
 *
 * Provides functions to:
 * - Manage a list of tracked companies in D1
 * - Match articles to companies by name/mention
 * - Link articles to companies via a junction table
 * - Update company stats (article count, last mentioned date)
 * - Seed default accounting AI companies
 */

/**
 * Get all active tracked companies from the database.
 */
export async function getTrackedCompanies(db: D1Database): Promise<Company[]> {
  try {
    const results = await db
      .prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name')
      .all();
    return results.results.map(mapRowToCompany);
  } catch (err) {
    console.error('[CompanyTracker] Error fetching tracked companies:', err);
    return [];
  }
}

/**
 * Insert or update a company in the database.
 */
export async function upsertCompany(
  db: D1Database,
  company: Omit<Company, 'articleCount'>
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO companies (id, name, aliases, website, description, category, funding_stage, logo_url, is_active, added_at, last_mentioned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           aliases = excluded.aliases,
           website = excluded.website,
           description = excluded.description,
           category = COALESCE(excluded.category, companies.category),
           funding_stage = COALESCE(excluded.funding_stage, companies.funding_stage),
           logo_url = COALESCE(excluded.logo_url, companies.logo_url),
           is_active = excluded.is_active,
           last_mentioned_at = COALESCE(excluded.last_mentioned_at, companies.last_mentioned_at)`
      )
      .bind(
        company.id,
        company.name,
        JSON.stringify(company.aliases),
        company.website,
        company.description,
        company.category,
        company.fundingStage,
        company.logoUrl,
        company.isActive ? 1 : 0,
        company.addedAt,
        company.lastMentionedAt
      )
      .run();
  } catch (err) {
    console.error(`[CompanyTracker] Error upserting company "${company.name}":`, err);
  }
}

/**
 * Match an article's title, content snippet, and source name against known company names.
 * Returns an array of matching company IDs.
 */
export function matchArticleToCompanies(
  article: ScoredArticle,
  companies: Company[]
): string[] {
  const matchedIds: string[] = [];
  const searchText = [
    article.title,
    article.contentSnippet || '',
    article.aiSummary || '',
    article.sourceName || '',
  ]
    .join(' ')
    .toLowerCase();

  for (const company of companies) {
    // Check the company name
    if (textContainsCompany(searchText, company.name)) {
      matchedIds.push(company.id);
      continue;
    }

    // Check aliases
    const matched = company.aliases.some((alias) =>
      textContainsCompany(searchText, alias)
    );
    if (matched) {
      matchedIds.push(company.id);
    }
  }

  return matchedIds;
}

/**
 * Check if text contains a company name as a word boundary match.
 * Avoids false positives (e.g., "sage" matching "message").
 */
function textContainsCompany(text: string, companyName: string): boolean {
  const name = companyName.toLowerCase();
  if (name.length < 6) {
    // Short names (e.g., "Sage", "Ramp", "Brex") need word boundary matching
    // to avoid false positives like "sage" matching "message"
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
    return regex.test(text);
  }
  // For longer names, a simple includes check is sufficient
  return text.includes(name);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Link an article to one or more companies in the junction table.
 */
export async function linkArticleToCompanies(
  db: D1Database,
  articleId: string,
  companyIds: string[]
): Promise<void> {
  if (companyIds.length === 0) return;

  try {
    // Use batch for efficiency
    const stmts = companyIds.map((companyId) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO article_companies (article_id, company_id) VALUES (?, ?)'
        )
        .bind(articleId, companyId)
    );
    await db.batch(stmts);
  } catch (err) {
    console.error(
      `[CompanyTracker] Error linking article ${articleId} to companies:`,
      err
    );
  }
}

/**
 * Update a company's article_count and last_mentioned_at from the junction table.
 */
export async function updateCompanyStats(
  db: D1Database,
  companyId: string
): Promise<void> {
  try {
    await db
      .prepare(
        `UPDATE companies SET
           article_count = (
             SELECT COUNT(*) FROM article_companies WHERE company_id = ?
           ),
           last_mentioned_at = (
             SELECT MAX(a.published_at)
             FROM article_companies ac
             JOIN articles a ON a.id = ac.article_id
             WHERE ac.company_id = ?
           )
         WHERE id = ?`
      )
      .bind(companyId, companyId, companyId)
      .run();
  } catch (err) {
    console.error(
      `[CompanyTracker] Error updating stats for company ${companyId}:`,
      err
    );
  }
}

/**
 * Get articles linked to a specific company.
 */
export async function getArticlesForCompany(
  db: D1Database,
  companyId: string,
  limit: number = 20
): Promise<Article[]> {
  try {
    const results = await db
      .prepare(
        `SELECT a.* FROM articles a
         INNER JOIN article_companies ac ON a.id = ac.article_id
         WHERE ac.company_id = ?
         ORDER BY a.published_at DESC
         LIMIT ?`
      )
      .bind(companyId, limit)
      .all();
    return results.results.map(mapRowToArticle);
  } catch (err) {
    console.error(
      `[CompanyTracker] Error fetching articles for company ${companyId}:`,
      err
    );
    return [];
  }
}

/**
 * Seed default accounting AI companies into the database.
 */
export async function seedDefaultCompanies(db: D1Database): Promise<void> {
  const companies: Array<Omit<Company, 'articleCount'>> = [
    {
      id: 'intuit',
      name: 'Intuit',
      aliases: ['QuickBooks', 'QuickBooks AI', 'TurboTax', 'Mailchimp'],
      website: 'https://www.intuit.com',
      description: 'Financial software platform including QuickBooks, TurboTax, and Mailchimp',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'xero',
      name: 'Xero',
      aliases: ['Xero AI'],
      website: 'https://www.xero.com',
      description: 'Cloud-based accounting software for small businesses',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'sage',
      name: 'Sage',
      aliases: ['Sage Intacct', 'Sage AI'],
      website: 'https://www.sage.com',
      description: 'Business management software including accounting and ERP',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'blackline',
      name: 'BlackLine',
      aliases: [],
      website: 'https://www.blackline.com',
      description: 'Cloud-based financial close management and accounting automation',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'vic-ai',
      name: 'Vic.ai',
      aliases: ['Vic AI', 'VicAI'],
      website: 'https://www.vic.ai',
      description: 'AI-powered autonomous accounting platform',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'truewind',
      name: 'Truewind',
      aliases: ['Truewind AI'],
      website: 'https://www.truewind.ai',
      description: 'AI-powered bookkeeping and finance for startups',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'docyt',
      name: 'Docyt',
      aliases: ['Docyt AI'],
      website: 'https://www.docyt.com',
      description: 'AI-powered accounting automation platform',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'botkeeper',
      name: 'Botkeeper',
      aliases: [],
      website: 'https://www.botkeeper.com',
      description: 'Automated bookkeeping powered by AI and machine learning',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'bench',
      name: 'Bench',
      aliases: ['Bench Accounting', 'Bench AI'],
      website: 'https://www.bench.co',
      description: 'Online bookkeeping service with AI-powered features',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'stampli',
      name: 'Stampli',
      aliases: [],
      website: 'https://www.stampli.com',
      description: 'AI-powered accounts payable automation',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'tipalti',
      name: 'Tipalti',
      aliases: [],
      website: 'https://www.tipalti.com',
      description: 'Global payables automation platform',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'floqast',
      name: 'FloQast',
      aliases: [],
      website: 'https://www.floqast.com',
      description: 'Accounting workflow automation for the close process',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'prophix',
      name: 'Prophix',
      aliases: [],
      website: 'https://www.prophix.com',
      description: 'Financial performance management and budgeting platform',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'planful',
      name: 'Planful',
      aliases: ['Host Analytics'],
      website: 'https://www.planful.com',
      description: 'Financial planning and analysis platform',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'digits',
      name: 'Digits',
      aliases: ['Digits AI', 'Digits Financial'],
      website: 'https://www.digits.com',
      description: 'AI-powered finance and accounting tools for businesses',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'puzzle',
      name: 'Puzzle',
      aliases: ['Puzzle Accounting', 'Puzzle AI'],
      website: 'https://www.puzzle.io',
      description: 'AI-native accounting software for startups',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'rillet',
      name: 'Rillet',
      aliases: ['Rillet AI'],
      website: 'https://www.rillet.com',
      description: 'AI-native accounting platform for high-growth companies',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'campfire',
      name: 'Campfire',
      aliases: ['Campfire AI', 'Campfire Accounting'],
      website: 'https://www.campfire.ai',
      description: 'AI-powered accounting platform with ERP-native AI model',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'dualentry',
      name: 'Dual Entry',
      aliases: ['DualEntry', 'Dual Entry AI'],
      website: 'https://dualentry.com',
      description: 'AI-powered general ledger and accounting platform',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'layer',
      name: 'Layer',
      aliases: ['Layer App'],
      website: 'https://www.golayer.io',
      description: 'Collaborative accounting platform for firms and clients',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'ramp',
      name: 'Ramp',
      aliases: ['Ramp Financial'],
      website: 'https://www.ramp.com',
      description: 'Corporate card and spend management platform with AI',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'brex',
      name: 'Brex',
      aliases: [],
      website: 'https://www.brex.com',
      description: 'AI-powered spend platform for businesses',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
    {
      id: 'pilot',
      name: 'Pilot',
      aliases: ['Pilot.com'],
      website: 'https://www.pilot.com',
      description: 'Bookkeeping, CFO, and tax services for startups',
      category: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: new Date().toISOString(),
      lastMentionedAt: null,
    },
  ];

  try {
    // Use batched inserts for efficiency
    const stmts = companies.map((company) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO companies (id, name, aliases, website, description, is_active, article_count, last_mentioned_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`
        )
        .bind(
          company.id,
          company.name,
          JSON.stringify(company.aliases),
          company.website,
          company.description,
          company.isActive ? 1 : 0
        )
    );

    await db.batch(stmts);
    console.log(`[CompanyTracker] Seeded ${companies.length} default companies`);
  } catch (err) {
    console.error('[CompanyTracker] Error seeding default companies:', err);
  }
}

/**
 * Map a D1 row to a Company object.
 */
function mapRowToCompany(row: Record<string, unknown>): Company {
  let aliases: string[] = [];
  try {
    aliases = JSON.parse((row.aliases as string) || '[]');
  } catch {
    aliases = [];
  }

  return {
    id: row.id as string,
    name: row.name as string,
    aliases,
    website: (row.website as string) || null,
    description: (row.description as string) || null,
    category: (row.category as string) || null,
    fundingStage: (row.funding_stage as string) || null,
    logoUrl: (row.logo_url as string) || null,
    isActive: row.is_active === 1,
    addedAt: (row.added_at as string) || new Date().toISOString(),
    articleCount: (row.article_count as number) || 0,
    lastMentionedAt: (row.last_mentioned_at as string) || null,
  };
}

/**
 * Map a D1 row to an Article object.
 */
function mapRowToArticle(row: Record<string, unknown>): Article {
  let tags: string[] = [];
  try {
    tags = JSON.parse((row.tags as string) || '[]');
  } catch {
    tags = [];
  }
  let companyMentions: string[] = [];
  try {
    companyMentions = JSON.parse((row.company_mentions as string) || '[]');
  } catch {
    companyMentions = [];
  }

  return {
    id: row.id as string,
    url: row.url as string,
    title: row.title as string,
    sourceType: row.source_type as SourceType,
    sourceName: row.source_name as string,
    author: (row.author as string) || null,
    publishedAt: row.published_at as string,
    fetchedAt: row.fetched_at as string,
    contentSnippet: (row.content_snippet as string) || null,
    imageUrl: (row.image_url as string) || null,
    relevanceScore: row.relevance_score as number | null,
    qualityScore: row.quality_score as number | null,
    aiSummary: (row.ai_summary as string) || null,
    tags,
    isPublished: row.is_published === 1,
    socialScore: row.social_score as number | null,
    commentCount: row.comment_count as number | null,
    companyMentions,
  };
}
