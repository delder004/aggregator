/**
 * Curated company descriptions for high-traffic companies
 * 
 * These descriptions are manually curated to provide accurate,
 * SEO-friendly summaries of each company's focus in agentic AI for accounting.
 * Descriptions should be 1-2 sentences emphasizing the company's role in
 * AI-powered accounting automation.
 */

export const CURATED_DESCRIPTIONS: Record<string, string> = {
  // AI-Native ERP / Accounting Platforms
  'verity-ai': 'AI-powered audit automation platform that uses machine learning to identify exceptions, anomalies, and compliance risks in financial data with human-like reasoning.',
  'blackline': 'Cloud-based accounting software that automates reconciliation, close management, and compliance workflows with AI-enhanced controls and variance analysis.',
  'daylit': 'Modern accounting platform designed for fractional and outsourced finance teams, combining AI automation with collaborative workflows.',
  'sage': 'Global accounting software vendor offering cloud-based solutions with integrated AI tools for small and medium-sized businesses.',
  'campfire': 'AI-powered accounting platform that automates month-end close processes and financial reconciliation tasks.',
  'digits': 'AI-native accounting platform providing real-time financial visibility and automated accrual accounting workflows.',
  'dualentry': 'AI-powered general ledger platform automating transaction categorization and journal entry generation.',
  'intuit': 'Financial software platform provider offering QuickBooks, TurboTax, and Credit Karma with expanding AI-powered automation features.',
  'tally-prime': 'Indian accounting software with AI-powered features for invoice recognition, GST compliance, and financial reporting.',
  'freeagent': 'Cloud accounting software for freelancers and small businesses with AI-assisted invoicing and expense categorization.',
  'xero': 'Accounting software platform providing cloud-based bookkeeping with AI-powered bank reconciliation and expense categorization.',
  'quickbooks': 'Accounting software for small businesses offering automated categorization and AI-enhanced financial insights.',

  // Audit Automation
  'fieldguide': 'AI agents platform for audit workflows, enabling autonomous execution of audit procedures and evidence collection.',

  // AP/AR Automation
  'tipalti': 'Global payments platform automating accounts payable processes with AI-driven invoice processing and compliance.',
  'trovata': 'AI-powered accounts receivable platform providing cash forecasting and automated collections workflows.',
  'aqilla': 'AI-powered invoice processing platform automating AP workflows from capture through payment.',

  // Compliance & Regulatory
  'logicgate': 'GRC platform with AI features for risk assessment, audit management, and compliance automation.',
  'incliva': 'Compliance automation platform for financial services using AI to streamline regulatory reporting.',

  // Tax Automation
  'hmrc': 'UK tax authority with emerging AI capabilities for tax compliance and digital tax reporting.',

  // FP&A & Reporting
  'rightrev': 'FP&A platform for professional services firms using AI for forecasting and variance analysis.',

  // Supporting Infrastructure
  'optro': 'Cloud audit and compliance platform (formerly AuditBoard) with AI-native automation for SOX compliance and internal audit.',

  // News/Publishing (for completeness, though marked as sources)
  'accounting-today': 'News publication covering accounting, tax, and audit trends including AI and automation adoption.',
  'accountingweb': 'Accounting news and resource site covering technology adoption in accounting practices.',
  'inside-public-accounting': 'News outlet covering accounting firm trends, mergers, and technology adoption in the Big 4 and regional firms.',
  'cpa-practice-advisor': 'Publication for accounting professionals covering technology, regulation, and business trends.',

  // AI Accounting Platforms (High-Coverage)
  'sierra': 'AI-powered accounting platform focused on automating bookkeeping and compliance workflows for growing companies.',
  'parallel': 'AI-native financial operations platform automating accounting and close processes for high-growth companies.',
  'helloleo': 'AI-powered accounting platform providing intelligent document processing and expense categorization automation.',

  // High-Coverage Companies (Missing Descriptions)
  'infinite': 'AI-powered financial operations platform for mid-market and enterprise accounting teams.',
  'finquery': 'Financial reporting and consolidation platform with AI-driven variance analysis and predictive analytics.',
  'withum': 'Accounting and advisory firm providing AI-enhanced tax and audit services.',

  // Other Notable Companies
  'openai': 'AI research company behind GPT models, increasingly used by accounting firms for document analysis and content generation.',
  'anthropic': 'AI safety company behind Claude, used by accounting platforms for reasoning tasks and compliance analysis.',
  'slack': 'Workplace communication platform integrating with accounting tools for collaborative finance workflows.',
  'stripe': 'Payment processing platform with AI-powered financial insights and automated accounting integration.',
  'amazon-web-services': 'Cloud infrastructure provider powering many AI-native accounting platforms.',
  'google': 'Technology company behind foundational AI models and cloud infrastructure used in accounting solutions.',
  'y-combinator': 'Startup accelerator and venture capital firm backing many AI-powered accounting and finance automation companies.',
};

/**
 * Get a curated description for a company if available,
 * otherwise return null to trigger fallback generation.
 */
export function getCuratedDescription(companyId: string): string | null {
  return CURATED_DESCRIPTIONS[companyId] ?? null;
}
