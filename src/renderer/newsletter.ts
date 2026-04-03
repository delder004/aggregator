import type { Article } from '../types';
import { escapeHtml } from './html';

const MAX_ARTICLES = 10;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function articleRow(article: Article, i: number): string {
  const title = escapeHtml(article.headline || article.title);
  const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';
  const source = escapeHtml(article.sourceName);
  const url = escapeHtml(article.url);
  const date = formatDate(article.publishedAt);

  return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${source} &middot; ${date}</p>
        <a href="${url}" style="color:#0f766e;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4;">${i + 1}. ${title}</a>
        ${summary ? `<p style="margin:6px 0 0;font-size:14px;color:#4b5563;line-height:1.5;">${summary}</p>` : ''}
      </td>
    </tr>`;
}

export function generateWeeklyNewsletter(articles: Article[]): { subject: string; body: string } {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeklyArticles = articles
    .filter(a => new Date(a.publishedAt) >= weekAgo)
    .slice(0, MAX_ARTICLES);

  const weekLabel = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const subject = `AI in Accounting: Week of ${weekLabel}`;

  const articleRows = weeklyArticles.map((a, i) => articleRow(a, i)).join('');

  const body = `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding:32px 24px 24px;text-align:center;border-bottom:2px solid #0f766e;">
      <h1 style="margin:0;font-size:22px;color:#0f766e;">Agentic AI in Accounting</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Weekly Digest &middot; ${escapeHtml(weekLabel)}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Here are the top ${weeklyArticles.length} stories from the world of AI and accounting this week.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${articleRows}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
      <a href="https://agenticaiccounting.com" style="display:inline-block;background:#0f766e;color:#fff;font-weight:600;font-size:14px;padding:10px 24px;border-radius:100px;text-decoration:none;">Read more on the site</a>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 24px;text-align:center;font-size:12px;color:#9ca3af;">
      <p style="margin:0;">You're receiving this because you subscribed to Agentic AI in Accounting.</p>
    </td>
  </tr>
</table>`.trim();

  return { subject, body };
}
