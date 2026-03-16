import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractContent, stripHtml } from './content-extractor';

describe('stripHtml', () => {
  it('should remove basic HTML tags', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(stripHtml(html)).toBe('Hello world');
  });

  it('should remove script tags and their content', () => {
    const html = '<p>Before</p><script>alert("xss")</script><p>After</p>';
    expect(stripHtml(html)).toBe('Before After');
  });

  it('should remove script tags with attributes', () => {
    const html = '<p>Text</p><script type="text/javascript" src="app.js">var x = 1;</script><p>More</p>';
    expect(stripHtml(html)).toBe('Text More');
  });

  it('should remove style tags and their content', () => {
    const html = '<style>.foo { color: red; }</style><p>Content</p>';
    expect(stripHtml(html)).toBe('Content');
  });

  it('should remove nav elements', () => {
    const html = '<nav><a href="/">Home</a><a href="/about">About</a></nav><p>Article text</p>';
    expect(stripHtml(html)).toBe('Article text');
  });

  it('should remove header elements', () => {
    const html = '<header><h1>Site Title</h1></header><p>Body content</p>';
    expect(stripHtml(html)).toBe('Body content');
  });

  it('should remove footer elements', () => {
    const html = '<p>Article body</p><footer>Copyright 2025</footer>';
    expect(stripHtml(html)).toBe('Article body');
  });

  it('should remove SVG content', () => {
    const html = '<p>Text</p><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg><p>More</p>';
    expect(stripHtml(html)).toBe('Text More');
  });

  it('should decode HTML entities', () => {
    const html = '<p>Tom &amp; Jerry &lt;3 &quot;cartoons&quot; &#39;yes&#39;</p>';
    expect(stripHtml(html)).toBe('Tom & Jerry <3 "cartoons" \'yes\'');
  });

  it('should decode &nbsp; entities', () => {
    const html = '<p>Hello&nbsp;world</p>';
    expect(stripHtml(html)).toBe('Hello world');
  });

  it('should collapse multiple whitespace into single spaces', () => {
    const html = '<p>Hello</p>\n\n\n<p>  World  </p>\t\t<p>Test</p>';
    expect(stripHtml(html)).toBe('Hello World Test');
  });

  it('should handle empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('should handle plain text without HTML', () => {
    expect(stripHtml('Just plain text')).toBe('Just plain text');
  });

  it('should handle nested script and style in complex HTML', () => {
    const html = `
      <html>
      <head><style>body { margin: 0; }</style></head>
      <body>
        <nav><ul><li>Menu</li></ul></nav>
        <main>
          <h1>Article Title</h1>
          <p>First paragraph about AI in accounting.</p>
          <p>Second paragraph with more detail.</p>
        </main>
        <script>console.log("tracking");</script>
        <footer><p>Footer content</p></footer>
      </body>
      </html>
    `;
    const result = stripHtml(html);
    expect(result).toContain('Article Title');
    expect(result).toContain('First paragraph about AI in accounting.');
    expect(result).toContain('Second paragraph with more detail.');
    expect(result).not.toContain('margin');
    expect(result).not.toContain('tracking');
    expect(result).not.toContain('Menu');
    expect(result).not.toContain('Footer content');
  });
});

describe('extractContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract text content from an HTML page', async () => {
    const html = `
      <html>
      <body>
        <p>AI is transforming the accounting industry.</p>
      </body>
      </html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    );

    const result = await extractContent('https://example.com/article');
    expect(result).toContain('AI is transforming the accounting industry.');
  });

  it('should truncate content to 3000 characters', async () => {
    const longContent = '<p>' + 'A'.repeat(5000) + '</p>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(longContent, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const result = await extractContent('https://example.com/long');
    expect(result).not.toBeNull();
    expect(result!.length).toBe(3000);
  });

  it('should return content as-is when under 3000 characters', async () => {
    const shortContent = '<p>Short article</p>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(shortContent, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const result = await extractContent('https://example.com/short');
    expect(result).toBe('Short article');
  });

  it('should return null on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    const result = await extractContent('https://example.com/missing');
    expect(result).toBeNull();
  });

  it('should return null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await extractContent('https://example.com/error');
    expect(result).toBeNull();
  });

  it('should return null for non-HTML content types', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data": true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await extractContent('https://example.com/api');
    expect(result).toBeNull();
  });

  it('should return null for empty response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const result = await extractContent('https://example.com/empty');
    expect(result).toBeNull();
  });

  it('should return null for HTML with only whitespace after stripping', async () => {
    const html = '<script>var x = 1;</script><style>.a{}</style>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const result = await extractContent('https://example.com/empty-content');
    expect(result).toBeNull();
  });

  it('should strip scripts and styles from fetched content', async () => {
    const html = `
      <html>
      <head><style>.class { color: red; }</style></head>
      <body>
        <script>window.tracking = true;</script>
        <p>Important article content here.</p>
        <script src="analytics.js"></script>
      </body>
      </html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const result = await extractContent('https://example.com/article');
    expect(result).not.toBeNull();
    expect(result).toContain('Important article content here.');
    expect(result).not.toContain('tracking');
    expect(result).not.toContain('color: red');
  });

  it('should handle abort/timeout gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10);
      });
    });

    const result = await extractContent('https://example.com/slow');
    expect(result).toBeNull();
  });
});
