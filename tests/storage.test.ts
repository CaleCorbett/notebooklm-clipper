import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSync: Record<string, unknown> = {};
const mockLocal: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: vi.fn(async (key: string) => ({ [key]: mockSync[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(mockSync, obj); }),
    },
    local: {
      get: vi.fn(async (keys: string[]) =>
        Object.fromEntries(keys.map(k => [k, mockLocal[k]]))),
      set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(mockLocal, obj); }),
    },
  },
});

import { getLastNotebookId, setLastNotebookId, getCachedNotebooks, setCachedNotebooks } from '../src/storage';

beforeEach(() => {
  Object.keys(mockSync).forEach(k => delete mockSync[k]);
  Object.keys(mockLocal).forEach(k => delete mockLocal[k]);
});

describe('getLastNotebookId', () => {
  it('returns undefined when nothing stored', async () => {
    expect(await getLastNotebookId()).toBeUndefined();
  });
  it('returns stored id', async () => {
    await setLastNotebookId('nb-123');
    expect(await getLastNotebookId()).toBe('nb-123');
  });
});

describe('getCachedNotebooks', () => {
  it('returns null when nothing cached', async () => {
    expect(await getCachedNotebooks()).toBeNull();
  });
  it('returns notebooks when cache is fresh', async () => {
    const notebooks = [{ id: 'nb-1', title: 'Test' }];
    await setCachedNotebooks(notebooks);
    expect(await getCachedNotebooks()).toEqual(notebooks);
  });
  it('returns null when cache is stale (> 5 min)', async () => {
    const notebooks = [{ id: 'nb-1', title: 'Test' }];
    await setCachedNotebooks(notebooks);
    mockLocal['notebooksCachedAt'] = Date.now() - 6 * 60 * 1000;
    expect(await getCachedNotebooks()).toBeNull();
  });
});
