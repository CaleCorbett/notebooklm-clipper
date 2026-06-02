import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractPageInfo, stripHtml } from '../src/extract';

function makeDocument(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('stripHtml', () => {
  it('removes script tags and their content', () => {
    const result = stripHtml('<p>Hello</p><script>alert(1)</script><p>World</p>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('removes style tags and their content', () => {
    const result = stripHtml('<style>.foo{color:red}</style><p>Text</p>');
    expect(result).not.toContain('.foo');
    expect(result).toContain('Text');
  });

  it('removes all remaining HTML tags', () => {
    const result = stripHtml('<p>Hello <strong>world</strong></p>');
    expect(result).toBe('Hello world');
  });

  it('collapses whitespace', () => {
    const result = stripHtml('<p>  Hello   world  </p>');
    expect(result).toBe('Hello world');
  });

  it('truncates to 50000 chars', () => {
    const long = '<p>' + 'a'.repeat(60000) + '</p>';
    expect(stripHtml(long).length).toBeLessThanOrEqual(50000);
  });
});

describe('extractPageInfo', () => {
  it('returns title and href from document', () => {
    const doc = makeDocument('<html><head><title>My Page</title></head><body><p>Content</p></body></html>');
    const info = extractPageInfo(doc, 'https://example.com/my-page');
    expect(info.title).toBe('My Page');
    expect(info.url).toBe('https://example.com/my-page');
  });

  it('falls back to "Untitled" when title is empty', () => {
    const doc = makeDocument('<html><head><title></title></head><body></body></html>');
    const info = extractPageInfo(doc, 'https://example.com');
    expect(info.title).toBe('Untitled');
  });

  it('extracts body text with HTML stripped', () => {
    const doc = makeDocument(
      '<html><head><title>T</title></head><body><p>Hello <em>world</em></p></body></html>'
    );
    const info = extractPageInfo(doc, 'https://example.com');
    expect(info.bodyText).toContain('Hello world');
  });

  it('formats bodyText with source header', () => {
    const doc = makeDocument(
      '<html><head><title>Test Page</title></head><body><p>Content</p></body></html>'
    );
    const info = extractPageInfo(doc, 'https://example.com/test');
    expect(info.bodyText).toMatch(/^Title: Test Page\nSource: https:\/\/example\.com\/test\n/);
  });
});
