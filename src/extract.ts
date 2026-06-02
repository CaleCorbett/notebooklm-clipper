export interface PageInfo {
  title: string;
  url: string;
  bodyText: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 50_000);
}

export function extractPageInfo(doc: Document, url: string): PageInfo {
  const title = doc.title.trim() || 'Untitled';
  const rawBody = doc.body?.innerHTML ?? '';
  const bodyText = `Title: ${title}\nSource: ${url}\n\n${stripHtml(rawBody)}`;
  return { title, url, bodyText };
}