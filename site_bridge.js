// site_bridge.js
// Injected into the website domain to bridge window.postMessage <-> extension

window.addEventListener('message', async (event) => {
  if (!event || !event.data || event.source !== window) return;
  const data = event.data;
  if (data.type !== 'YTTE_SITE') return;

  if (data.action === 'ping') {
    chrome.runtime.sendMessage({ source: 'site', action: 'ping' }, (resp) => {
      window.postMessage({ type: 'YTTE_EXT', action: 'ping', ok: !chrome.runtime.lastError && resp?.status === 'ok' }, '*');
    });
  }

  if (data.action === 'extract' && data.videoId) {
    chrome.runtime.sendMessage({ source: 'site', action: 'extractTranscript', videoId: data.videoId }, (resp) => {
      if (chrome.runtime.lastError) {
        window.postMessage({ type: 'YTTE_EXT', action: 'extract', error: chrome.runtime.lastError.message }, '*');
        return;
      }
      window.postMessage({ type: 'YTTE_EXT', action: 'extract', ...resp }, '*');
    });
  }
});

