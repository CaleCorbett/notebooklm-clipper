import { setLastNotebookId, getLastNotebookId } from '../storage';
import { isYouTubeUrl } from '../api';
import type { Notebook } from '../api';
import type {
  ClipRequest,
  ListNotebooksRequest,
  ListNotebooksResult,
  ClipResult,
} from '../background';

// ── DOM refs ────────────────────────────────────────────────────────────────
const stateAuth    = document.getElementById('state-auth')!;
const stateEmpty   = document.getElementById('state-empty')!;
const stateMain    = document.getElementById('state-main')!;
const stateLoading = document.getElementById('state-loading')!;

const favicon      = document.getElementById('favicon') as HTMLImageElement;
const pageTitleEl  = document.getElementById('page-title')!;
const pageUrlEl    = document.getElementById('page-url')!;
const ytBadge      = document.getElementById('yt-badge')!;

const pickerLabel  = document.getElementById('picker-label')!;
const select       = document.getElementById('notebook-select') as HTMLSelectElement;

const clipSection  = document.getElementById('clip-section')!;
const clipBtn      = document.getElementById('clip-btn') as HTMLButtonElement;
const clipText     = document.getElementById('clip-text')!;
const clipIcon     = document.getElementById('clip-icon')!;

const successBanner = document.getElementById('success-banner')!;
const successText   = document.getElementById('success-text')!;

const errorBanner  = document.getElementById('error-banner')!;
const errorText    = document.getElementById('error-text')!;
const retryBtn     = document.getElementById('retry-btn') as HTMLButtonElement;

// ── State ───────────────────────────────────────────────────────────────────
function showOnly(el: HTMLElement) {
  [stateAuth, stateEmpty, stateMain, stateLoading].forEach(s => s.classList.add('hidden'));
  el.classList.remove('hidden');
}

function setClipLoading(loading: boolean) {
  clipBtn.disabled = loading;
  clipIcon.textContent = loading ? '' : '＋';
  clipText.textContent = loading ? 'Adding…' : 'Add to Notebook';
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.id = 'btn-spinner';
    clipBtn.prepend(spinner);
  } else {
    document.getElementById('btn-spinner')?.remove();
  }
}

function showSuccess(notebookTitle: string) {
  clipSection.classList.add('hidden');
  errorBanner.classList.add('hidden');
  successText.textContent = `Added to ${notebookTitle}`;
  successBanner.classList.remove('hidden');
  pickerLabel.textContent = 'Saved to';
}

function showError(message: string) {
  errorText.textContent = message;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// isYouTubeUrl imported from ../api

function populateSelect(notebooks: Notebook[], lastId?: string) {
  select.innerHTML = '';
  notebooks.forEach(nb => {
    const opt = document.createElement('option');
    opt.value = nb.id;
    opt.textContent = nb.title;
    if (nb.id === lastId) opt.selected = true;
    select.appendChild(opt);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  showOnly(stateLoading);

  const result = await chrome.runtime.sendMessage<ListNotebooksRequest, ListNotebooksResult>(
    { action: 'listNotebooks' }
  );

  if (!result.ok) {
    if (result.error === 'auth') { showOnly(stateAuth); return; }
    showOnly(stateMain);
    showError(result.message);
    return;
  }

  if (result.notebooks.length === 0) { showOnly(stateEmpty); return; }

  const lastId = await getLastNotebookId();
  populateSelect(result.notebooks, lastId);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url ?? '';
  const title = tab.title ?? 'Untitled';

  pageTitleEl.textContent = title;
  pageUrlEl.textContent = url.replace(/^https?:\/\//, '');
  favicon.src = tab.favIconUrl ?? '';
  favicon.onerror = () => { favicon.style.display = 'none'; };
  ytBadge.classList.toggle('hidden', !isYouTubeUrl(url));

  showOnly(stateMain);

  async function doClip() {
    hideError();
    setClipLoading(true);

    const notebookId = select.value;
    const notebookTitle = select.options[select.selectedIndex]?.text ?? '';

    let bodyText = '';
    try {
      const extracted = await chrome.tabs.sendMessage<
        { action: string },
        { title: string; url: string; bodyText: string }
      >(tab.id!, { action: 'extractPage' });
      bodyText = extracted.bodyText;
    } catch {
      // Content script not available on restricted pages — bodyText stays empty
    }

    const clipResult = await chrome.runtime.sendMessage<ClipRequest, ClipResult>({
      action: 'clip',
      notebookId,
      url,
      title,
      bodyText,
    });

    setClipLoading(false);

    if (clipResult.ok) {
      await setLastNotebookId(notebookId);
      showSuccess(notebookTitle);
    } else {
      const msg = clipResult.error === 'auth'
        ? 'Sign in to NotebookLM first'
        : clipResult.message;
      showError(msg);
    }
  }

  clipBtn.addEventListener('click', doClip);
  retryBtn.addEventListener('click', doClip);
}

init();
