import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function fakeRpcResponse(rpcId: string, data: unknown): Response {
  const dataJson = JSON.stringify(data);
  const body = `)]}'\n\n100\n[["wrb.fr","${rpcId}","${dataJson.replace(/"/g, '\\"')}",null,null,null,"generic"]]`;
  return new Response(body, { status: 200 });
}

function authErrorResponse(): Response {
  return new Response('', { status: 401 });
}

function rateLimitResponse(): Response {
  return new Response('', { status: 429 });
}

let api: typeof import('../src/api');

beforeEach(async () => {
  vi.resetModules();
  mockFetch.mockReset();
  api = await import('../src/api');
});

describe('listNotebooks', () => {
  it('returns parsed notebooks', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<html>"SNlM0e":"tok123"</html>', { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(
      fakeRpcResponse('wXbhsf', [
        [['nb-1', 'My Research'], ['nb-2', 'Work Notes']],
      ])
    );
    const notebooks = await api.listNotebooks();
    expect(notebooks).toEqual([
      { id: 'nb-1', title: 'My Research' },
      { id: 'nb-2', title: 'Work Notes' },
    ]);
  });

  it('throws AuthError when not signed in', async () => {
    mockFetch.mockResolvedValueOnce(authErrorResponse());
    await expect(api.listNotebooks()).rejects.toThrow(api.AuthError);
  });
});

describe('addUrlSource', () => {
  it('calls batchexecute for a regular page', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<html>"SNlM0e":"tok123"</html>', { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(
      fakeRpcResponse('izAoDd', [[['src-1', 'https://example.com']]])
    );
    await api.addUrlSource('nb-1', 'https://example.com');
    const [, batchCall] = mockFetch.mock.calls;
    const body = (batchCall[1] as RequestInit).body as string;
    expect(body).toContain('izAoDd');
    expect(body).toContain('https://example.com');
  });

  it('uses YouTube param shape for youtube.com URLs', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<html>"SNlM0e":"tok123"</html>', { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(
      fakeRpcResponse('izAoDd', [[['src-2', 'https://youtube.com/watch?v=abc']]])
    );
    await api.addUrlSource('nb-1', 'https://youtube.com/watch?v=abc');
    const [, batchCall] = mockFetch.mock.calls;
    const body = (batchCall[1] as RequestInit).body as string;
    const fReq = JSON.parse(new URLSearchParams(body).get('f.req')!);
    const params = JSON.parse(fReq[0][0][1]);
    expect(params[0][0][7]).toContain('https://youtube.com/watch?v=abc');
  });

  it('throws RateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<html>"SNlM0e":"tok123"</html>', { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(rateLimitResponse());
    await expect(api.addUrlSource('nb-1', 'https://example.com')).rejects.toThrow(api.RateLimitError);
  });
});

describe('addTextSource', () => {
  it('calls batchexecute with title and content', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<html>"SNlM0e":"tok123"</html>', { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(
      fakeRpcResponse('izAoDd', [[['src-3', 'My Title']]])
    );
    await api.addTextSource('nb-1', 'My Title', 'Body content here');
    const [, batchCall] = mockFetch.mock.calls;
    const body = (batchCall[1] as RequestInit).body as string;
    const fReq = JSON.parse(new URLSearchParams(body).get('f.req')!);
    const params = JSON.parse(fReq[0][0][1]);
    expect(params[0][0][1]).toEqual(['My Title', 'Body content here']);
  });
});

describe('YouTube URL detection (via param shape)', () => {
  const ytUrls = [
    'https://www.youtube.com/watch?v=abc',
    'https://youtube.com/watch?v=abc',
    'https://youtu.be/abc',
    'https://m.youtube.com/watch?v=abc',
  ];
  const nonYtUrls = [
    'https://example.com',
    'https://youtubelike.com',
    'https://notebooklm.google.com',
  ];

  for (const url of ytUrls) {
    it(`detects ${url} as YouTube`, async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('<html>"SNlM0e":"tok"</html>', { status: 200 }))
        .mockResolvedValueOnce(fakeRpcResponse('izAoDd', [[]]));
      await api.addUrlSource('nb-1', url);
      const [, batchCall] = mockFetch.mock.calls;
      const body = (batchCall[1] as RequestInit).body as string;
      const fReq = JSON.parse(new URLSearchParams(body).get('f.req')!);
      const params = JSON.parse(fReq[0][0][1]);
      expect(params[0][0][7]).toBeDefined();
      expect(params[0][0][2]).toBeUndefined();
    });
  }

  for (const url of nonYtUrls) {
    it(`does not detect ${url} as YouTube`, async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('<html>"SNlM0e":"tok"</html>', { status: 200 }))
        .mockResolvedValueOnce(fakeRpcResponse('izAoDd', [[]]));
      await api.addUrlSource('nb-1', url);
      const [, batchCall] = mockFetch.mock.calls;
      const body = (batchCall[1] as RequestInit).body as string;
      const fReq = JSON.parse(new URLSearchParams(body).get('f.req')!);
      const params = JSON.parse(fReq[0][0][1]);
      expect(params[0][0][2]).toBeDefined();
    });
  }
});
