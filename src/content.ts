import { extractPageInfo } from './extract';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'extractPage') return false;

  const info = extractPageInfo(document, location.href);
  sendResponse(info);
  return false; // synchronous response
});
