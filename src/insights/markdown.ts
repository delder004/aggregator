/**
 * Minimal Markdown-to-HTML converter.
 * Supports headings, bold, italic, links, unordered/ordered lists, and paragraphs.
 * No external dependencies.
 */

/** Escape HTML special characters to prevent XSS. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert inline markdown syntax (bold, italic, links) to HTML. */
function processInline(text: string): string {
  let result = escapeHtml(text);

  // Links: [text](url) — process before bold/italic to avoid conflicts
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // Bold: **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not inside <strong> tags from bold)
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return result;
}

/**
 * Convert a Markdown string to HTML.
 *
 * Supported syntax:
 * - `## Heading` and `### Heading`
 * - `**bold**` and `*italic*`
 * - `[text](url)` links
 * - Lines starting with `- ` (unordered lists)
 * - Lines starting with `N. ` (ordered lists)
 * - Double newlines create paragraph breaks
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const outputBlocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ### Heading (check before ## since ### starts with ##)
    if (line.startsWith('### ')) {
      outputBlocks.push(`<h3>${processInline(line.slice(4).trim())}</h3>`);
      i++;
      continue;
    }

    // ## Heading
    if (line.startsWith('## ')) {
      outputBlocks.push(`<h2>${processInline(line.slice(3).trim())}</h2>`);
      i++;
      continue;
    }

    // Unordered list: group consecutive lines starting with "- "
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(`<li>${processInline(lines[i].slice(2).trim())}</li>`);
        i++;
      }
      outputBlocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list: group consecutive lines starting with "N. "
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const content = lines[i].replace(/^\d+\.\s/, '');
        items.push(`<li>${processInline(content.trim())}</li>`);
        i++;
      }
      outputBlocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph: collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('## ') &&
      !lines[i].startsWith('### ') &&
      !lines[i].startsWith('- ') &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(processInline(lines[i].trim()));
      i++;
    }
    if (paraLines.length > 0) {
      outputBlocks.push(`<p>${paraLines.join(' ')}</p>`);
    }
  }

  return outputBlocks.join('\n');
}
