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

  // Try multiple attempts: click transcript, wait, then extract (DOM-based)
  for (let attempt = 0; attempt < 5; attempt++) {
    await chrome.scripting.executeScript({ target: { tabId }, func: tryOpenTranscriptPanel });
    await delay(1500);
    await chrome.scripting.executeScript({ target: { tabId }, func: openTranscriptViaMenu });
    await delay(3000 + attempt * 1000);

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readTranscriptText
    });

    if (typeof result === 'string' && result.trim().length > 0) {
      return { transcript: result };
    }
  }

  // Fallback: extract caption track URL from player response and fetch VTT directly
  try {
    const [{ result: trackUrl }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: getCaptionTrackUrl
    });
    if (trackUrl && typeof trackUrl === 'string') {
      const asVttUrl = appendFmtVtt(trackUrl);
      const resp = await fetch(asVttUrl, { credentials: 'omit' });
      if (resp.ok) {
        const vtt = await resp.text();
        const plain = vttToPlainText(vtt);
        if (plain.trim().length > 0) {
          return { transcript: plain };
        }
      }
    }
  } catch (_) {
    // ignore and fall through
  }

  throw new Error('Transcript not found (make sure the video has captions, then try again)');
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

function openTranscriptViaMenu() {
  // Click the top-level kebab (three-dots) menu and choose Transcript if present
  // Try common containers
  const containers = [
    document.querySelector('#top-level-buttons-computed'),
    document.querySelector('#menu ytd-menu-renderer'),
    document.querySelector('ytd-video-primary-info-renderer'),
  ].filter(Boolean);

  containers.forEach(container => {
    const menuBtn = container.querySelector('button[aria-label*="more" i], button[aria-label*="menu" i], tp-yt-paper-menu-button button');
    if (menuBtn) {
      menuBtn.click();
    }
  });

  // After menu opens, try to click the Transcript item
  const items = document.querySelectorAll('tp-yt-paper-item, ytd-menu-service-item-renderer');
  items.forEach(item => {
    const txt = (item.innerText || '').toLowerCase();
    if (txt.includes('transcript')) {
      item.click();
    }
  });
}

function getCaptionTrackUrl() {
  try {
    const pr = (window.ytInitialPlayerResponse || window._ytInitialPlayerResponse);
    const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(tracks) && tracks.length > 0) {
      let chosen = tracks.find(t => (t.kind !== 'asr') && (String(t.languageCode || '').toLowerCase().startsWith('en') || String(t.name?.simpleText || '').toLowerCase().includes('english')));
      if (!chosen) chosen = tracks.find(t => String(t.languageCode || '').toLowerCase().startsWith('en'));
      if (!chosen) chosen = tracks[0];
      return chosen?.baseUrl || '';
    }
  } catch (e) {
    // no-op
  }
  return '';
}

function appendFmtVtt(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('fmt')) {
      u.searchParams.set('fmt', 'vtt');
    }
    return u.toString();
  } catch (_) {
    // fallback simple concatenation
    return url + (url.includes('?') ? '&' : '?') + 'fmt=vtt';
  }
}

function vttToPlainText(vtt) {
  const lines = String(vtt || '').replace(/\r/g, '').split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // skip blanks
    if (trimmed === 'WEBVTT') continue; // header
    if (/^\d+$/.test(trimmed)) continue; // cue number
    if (/-->/.test(trimmed)) continue; // timing line
    out.push(trimmed);
  }
  return out.join('\n');
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

