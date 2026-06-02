import {
  addUrlSource,
  addTextSource,
  listNotebooks,
  AuthError,
  ApiError,
  RateLimitError,
  type Notebook,
} from './api';
import { getCachedNotebooks, setCachedNotebooks } from './storage';

export type ClipRequest = {
  action: 'clip';
  notebookId: string;
  url: string;
  title: string;
  bodyText: string;
};

export type ListNotebooksRequest = {
  action: 'listNotebooks';
};

export type ClipResult =
  | { ok: true }
  | { ok: false; error: 'auth' | 'rateLimit' | 'unknown'; message: string };

export type ListNotebooksResult =
  | { ok: true; notebooks: Notebook[] }
  | { ok: false; error: 'auth' | 'unknown'; message: string };

chrome.runtime.onMessage.addListener(
  (
    message: ClipRequest | ListNotebooksRequest,
    _sender,
    sendResponse: (result: ClipResult | ListNotebooksResult) => void
  ) => {
    if (message.action === 'clip') {
      handleClip(message).then(sendResponse);
      return true; // keep channel open for async response
    }
    if (message.action === 'listNotebooks') {
      handleListNotebooks().then(sendResponse);
      return true;
    }
    return false;
  }
);

async function handleClip(req: ClipRequest): Promise<ClipResult> {
  try {
    await addUrlSource(req.notebookId, req.url);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'auth', message: err.message };
    if (err instanceof RateLimitError) {
      // Retry once after 2s
      await new Promise(r => setTimeout(r, 2000));
      try {
        await addUrlSource(req.notebookId, req.url);
        return { ok: true };
      } catch {
        return { ok: false, error: 'rateLimit', message: 'Rate limited — try again shortly' };
      }
    }
    // Only fall back to text for API errors (paywall/restricted content)
    // Network failures and unknown errors are returned directly
    if (!(err instanceof ApiError)) {
      return { ok: false, error: 'unknown', message: 'Failed to add source' };
    }
    try {
      await addTextSource(req.notebookId, req.title, req.bodyText);
      return { ok: true };
    } catch (textErr) {
      if (textErr instanceof AuthError) return { ok: false, error: 'auth', message: (textErr as Error).message };
      return { ok: false, error: 'unknown', message: 'Failed to add source' };
    }
  }
}

async function handleListNotebooks(): Promise<ListNotebooksResult> {
  const cached = await getCachedNotebooks();
  if (cached) return { ok: true, notebooks: cached };

  try {
    const notebooks = await listNotebooks();
    await setCachedNotebooks(notebooks);
    return { ok: true, notebooks };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'auth', message: (err as Error).message };
    return { ok: false, error: 'unknown', message: 'Failed to load notebooks' };
  }
}
