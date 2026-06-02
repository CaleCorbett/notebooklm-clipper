export interface Notebook {
  id: string;
  title: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getLastNotebookId(): Promise<string | undefined> {
  const result = await chrome.storage.sync.get('lastNotebookId');
  return result['lastNotebookId'] as string | undefined;
}

export async function setLastNotebookId(id: string): Promise<void> {
  await chrome.storage.sync.set({ lastNotebookId: id });
}

export async function getCachedNotebooks(): Promise<Notebook[] | null> {
  const result = await chrome.storage.local.get(['notebooks', 'notebooksCachedAt']);
  const notebooks = result['notebooks'] as Notebook[] | undefined;
  const cachedAt = result['notebooksCachedAt'] as number | undefined;
  if (!notebooks || !cachedAt) return null;
  if (Date.now() - cachedAt > CACHE_TTL_MS) return null;
  return notebooks;
}

export async function setCachedNotebooks(notebooks: Notebook[]): Promise<void> {
  await chrome.storage.local.set({ notebooks, notebooksCachedAt: Date.now() });
}
