export class AuthError extends Error {
  constructor(msg = 'Not signed in to NotebookLM') { super(msg); this.name = 'AuthError'; }
}
export class RateLimitError extends Error {
  constructor() { super('Rate limited'); this.name = 'RateLimitError'; }
}
export class ApiError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ApiError'; }
}

export interface Notebook {
  id: string;
  title: string;
}

const BATCHEXECUTE_URL =
  'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute';

let cachedAtToken: string | null = null;

async function getAtToken(): Promise<string> {
  if (cachedAtToken) return cachedAtToken;
  const resp = await fetch('https://notebooklm.google.com/', { credentials: 'include' });
  if (resp.status === 401 || (resp.redirected && resp.url.includes('accounts.google.com'))) {
    throw new AuthError();
  }
  const html = await resp.text();
  const match = html.match(/"SNlM0e":"([^"]+)"/);
  if (!match) throw new AuthError('Could not extract session token — are you signed in?');
  cachedAtToken = match[1];
  return cachedAtToken;
}

export function invalidateAtToken(): void {
  cachedAtToken = null;
}

function parseRpcResponse(text: string): unknown {
  const jsonStart = text.indexOf('[');
  if (jsonStart === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(jsonStart)) as unknown[][];
    const dataJson = parsed[0]?.[2];
    if (typeof dataJson === 'string') return JSON.parse(dataJson);
    return dataJson ?? null;
  } catch {
    return null;
  }
}

async function rpcCall(rpcId: string, params: unknown[]): Promise<unknown> {
  const at = await getAtToken();
  const paramsJson = JSON.stringify(params);
  const fReq = JSON.stringify([[[rpcId, paramsJson, null, 'generic']]]);
  const body = new URLSearchParams({ 'f.req': fReq, at });

  const resp = await fetch(
    `${BATCHEXECUTE_URL}?rpcids=${rpcId}&rt=c`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  );

  if (resp.status === 401) { invalidateAtToken(); throw new AuthError(); }
  if (resp.status === 429) throw new RateLimitError();
  if (!resp.ok) throw new ApiError(`HTTP ${resp.status}`);

  return parseRpcResponse(await resp.text());
}

export async function listNotebooks(): Promise<Notebook[]> {
  const data = await rpcCall('wXbhsf', [null, null, [1]]) as unknown[][] | null;
  if (!data?.[0]) return [];
  return (data[0] as unknown[][]).map((nb) => ({
    id: nb[0] as string,
    title: (nb[1] as string) ?? 'Untitled',
  }));
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com';
  } catch {
    return false;
  }
}

export async function addUrlSource(notebookId: string, url: string): Promise<void> {
  const params = isYouTubeUrl(url)
    ? [
        [[null, null, null, null, null, null, null, [url], null, null, 1]],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ]
    : [
        [[null, null, [url], null, null, null, null, null]],
        notebookId,
        [2],
        null,
        null,
      ];
  await rpcCall('izAoDd', params);
}

export async function addTextSource(
  notebookId: string,
  title: string,
  content: string
): Promise<void> {
  const params = [
    [[null, [title, content], null, null, null, null, null, null]],
    notebookId,
    [2],
    null,
    null,
  ];
  await rpcCall('izAoDd', params);
}
