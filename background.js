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
  // Find an existing YouTube tab or open one in foreground for reliable loading
  const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  let tabId;
  if (tabs && tabs.length > 0) {
    tabId = tabs[0].id;
    await chrome.tabs.update(tabId, { url: `https://www.youtube.com/watch?v=${videoId}`, active: true });
  } else {
    const newTab = await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}`, active: true });
    tabId = newTab.id;
  }

  // Initial wait for page and player to settle
  await delay(5000);

  // Try multiple attempts: click transcript, wait, then extract
  for (let attempt = 0; attempt < 3; attempt++) {
    await chrome.scripting.executeScript({ target: { tabId }, func: tryOpenTranscriptPanel });
    await delay(2500 + attempt * 1000);

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readTranscriptText
    });

    if (typeof result === 'string' && result.trim().length > 0) {
      return { transcript: result };
    }
  }

  throw new Error('Transcript not found (ensure the video has captions, then try again)');
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function tryOpenTranscriptPanel() {
  // Try to click any button that opens the transcript panel
  // 1) Direct transcript button
  const directBtn = document.querySelector('button[aria-label*="transcript" i]');
  if (directBtn) directBtn.click();

  // 2) Try the three-dots menu (kebab) → look for transcript item
  const menus = document.querySelectorAll('ytd-menu-renderer, tp-yt-paper-menu-button');
  menus.forEach(m => {
    const btn = m.querySelector('button');
    if (btn && btn.getAttribute('aria-label')) {
      const label = btn.getAttribute('aria-label').toLowerCase();
      if (label.includes('more') || label.includes('menu')) btn.click();
    }
  });

  // Sometimes transcript appears in a dialog; nothing else to do here.
}

function readTranscriptText() {
  const panel = document.querySelector('ytd-transcript-renderer');
  if (panel) {
    const segs = panel.querySelectorAll('ytd-transcript-segment-renderer');
    if (segs.length) {
      return Array.from(segs).map(s => s.querySelector('#content-text')?.textContent || '').join('\n').trim();
    }
  }
  // Fallback: some UIs render transcript items differently
  const altSegs = document.querySelectorAll('[data-testid="transcript-segment"], .ytd-transcript-segment-renderer');
  if (altSegs.length) {
    return Array.from(altSegs).map(s => (s.innerText || '').trim()).filter(Boolean).join('\n').trim();
  }
  return '';
}

