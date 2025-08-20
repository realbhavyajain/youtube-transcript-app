// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.source === 'site' && request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }

  if (request && request.source === 'site' && request.action === 'extractTranscript') {
    const { videoId } = request;
    handleExtract(videoId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err?.message || 'Unknown error' }));
    return true; // async
  }
});

async function handleExtract(videoId) {
  // First, try direct timedtext API without touching the user's tab
  try {
    const timedText = await fetchTimedTextCaptions(videoId);
    if (timedText && timedText.trim().length > 0) {
      return { transcript: timedText };
    }
  } catch (_) {}

  // If that fails, open a temporary background tab (inactive) to extract
  let tempTabId = null;
  try {
    const newTab = await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}`, active: false });
    tempTabId = newTab.id;

    // Wait for page and player to settle
    await waitForPlayerReady(tempTabId, 12000);

    // Try multiple attempts: click transcript, wait, then extract (DOM-based)
    for (let attempt = 0; attempt < 6; attempt++) {
      await chrome.scripting.executeScript({ target: { tabId: tempTabId }, func: tryOpenTranscriptPanel });
      await delay(1800);
      await chrome.scripting.executeScript({ target: { tabId: tempTabId }, func: openTranscriptViaMenu });
      await delay(3500 + attempt * 1000);

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tempTabId },
        func: readTranscriptText
      });

      if (typeof result === 'string' && result.trim().length > 0) {
        return { transcript: result };
      }
    }

    // Fallback: extract caption track URL from player response and fetch VTT directly
    try {
      const [{ result: trackUrl }] = await chrome.scripting.executeScript({
        target: { tabId: tempTabId },
        func: getCaptionTrackUrlMainWorld,
        world: 'MAIN'
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
    } catch (_) {}
  } finally {
    if (tempTabId !== null) {
      try { await chrome.tabs.remove(tempTabId); } catch (_) {}
    }
  }

  // Final fallback: timedtext again (ASR/etc), in case the first attempt raced too early
  try {
    const timedTextRetry = await fetchTimedTextCaptions(videoId);
    if (timedTextRetry && timedTextRetry.trim().length > 0) {
      return { transcript: timedTextRetry };
    }
  } catch (_) {}

  throw new Error('Transcript not found (make sure the video has captions, then try again)');
}
async function waitForPlayerReady(tabId, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => !!(window.ytInitialPlayerResponse || window._ytInitialPlayerResponse || document.querySelector('video'))
      });
      if (result) return true;
    } catch (_) {}
    await delay(500);
  }
  return false;
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

function getCaptionTrackUrlMainWorld() {
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

async function fetchTimedTextCaptions(videoId) {
  const base = 'https://www.youtube.com/api/timedtext';
  const languages = ['en', 'en-US', 'en-GB', 'hi'];
  const attempts = [];
  for (const lang of languages) {
    attempts.push(`${base}?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}&fmt=vtt`);
    attempts.push(`${base}?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}&fmt=vtt&kind=asr`);
  }
  // A generic auto-caption attempt
  attempts.push(`${base}?v=${encodeURIComponent(videoId)}&lang=en&fmt=vtt&kind=asr`);

  for (const url of attempts) {
    try {
      const resp = await fetch(url, { credentials: 'omit' });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text) continue;
      if (text.startsWith('WEBVTT')) {
        const plain = vttToPlainText(text);
        if (plain.trim()) return plain;
      } else if (text.trim().startsWith('<')) {
        const plain = xmlTimedTextToPlain(text);
        if (plain.trim()) return plain;
      }
    } catch (_) {
      // continue
    }
  }
  return '';
}

function xmlTimedTextToPlain(xml) {
  // Very small XML parser using regex; good enough for YouTube timedtext
  const out = [];
  const textTagRegex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = textTagRegex.exec(xml)) !== null) {
    const raw = m[1] || '';
    const unescaped = decodeHtmlEntities(raw.replace(/\n+/g, ' ').replace(/<[^>]+>/g, ''));
    const cleaned = unescaped.trim();
    if (cleaned) out.push(cleaned);
  }
  return out.join('\n');
}

function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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

