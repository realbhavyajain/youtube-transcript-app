// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.source === 'site' && request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }

  if (request && request.source === 'site' && request.action === 'extractTranscript') {
    const { videoId } = request;
    handleExtract(videoId).then(result => sendResponse(result)).catch(err => sendResponse({ error: err?.message || 'Unknown error' }));
    return true; // async
  }
});

async function handleExtract(videoId) {
  // Find an existing YouTube tab or open one
  const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  let tabId;
  if (tabs && tabs.length > 0) {
    tabId = tabs[0].id;
    await chrome.tabs.update(tabId, { url: `https://www.youtube.com/watch?v=${videoId}` });
  } else {
    const newTab = await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}`, active: false });
    tabId = newTab.id;
  }
  // Wait briefly for load
  await delay(3000);

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: contentExtract
  });

  if (typeof result === 'string' && result.trim().length > 0) {
    return { transcript: result };
  }
  throw new Error('Transcript not found');
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function contentExtract() {
  // Try existing transcript renderer
  const panel = document.querySelector('ytd-transcript-renderer');
  if (panel) {
    const segs = panel.querySelectorAll('ytd-transcript-segment-renderer');
    if (segs.length) {
      return Array.from(segs).map(s => s.querySelector('#content-text')?.textContent || '').join('\n').trim();
    }
  }
  const btn = document.querySelector('button[aria-label*="transcript" i]');
  if (btn) btn.click();
  return null;
}

