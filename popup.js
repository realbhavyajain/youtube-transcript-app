document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const transcriptContainer = document.getElementById('transcriptContainer');
  const transcriptText = document.getElementById('transcriptText');
  const exportBtn = document.getElementById('exportBtn');

  // Listen for messages from the website
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      // Website is checking if extension is installed
      sendResponse({ status: 'installed' });
    } else if (request.action === 'extractTranscript') {
      // Website wants to extract transcript
      handleTranscriptRequest(request.videoId, sendResponse);
      return true; // Keep message channel open for async response
    }
  });

  extractBtn.addEventListener('click', async function() {
    extractBtn.disabled = true;
    status.textContent = 'Extracting transcript...';
    status.className = 'status';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) throw new Error('No active tab');

      const videoId = parseYouTubeVideoId(tab.url);
      if (!videoId) {
        throw new Error('Open a YouTube video page first');
      }

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { source: 'site', action: 'extractTranscript', videoId },
          (resp) => resolve(resp || { error: chrome.runtime.lastError?.message || 'Unknown error' })
        );
      });

      if (response && response.transcript) {
        transcriptText.textContent = response.transcript;
        transcriptContainer.style.display = 'block';
        exportBtn.style.display = 'block';
        status.textContent = 'Transcript extracted successfully!';
        status.className = 'status success';
      } else {
        const msg = response?.error || 'No transcript found';
        throw new Error(msg);
      }
    } catch (error) {
      status.textContent = `Error: ${error.message}`;
      status.className = 'status error';
    } finally {
      extractBtn.disabled = false;
    }
  });

  exportBtn.addEventListener('click', function() {
    const transcript = transcriptText.textContent;
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube-transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  async function handleTranscriptRequest(videoId, sendResponse) {
    try {
      chrome.runtime.sendMessage(
        { source: 'site', action: 'extractTranscript', videoId },
        (resp) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          if (!resp) {
            sendResponse({ error: 'No response from background' });
            return;
          }
          sendResponse(resp);
        }
      );
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
});

function parseYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    // Shorts and other formats
    const shorts = /\/shorts\/([\w-]{6,})/.exec(u.pathname);
    if (shorts && shorts[1]) return shorts[1];
  } catch (_) {}
  return '';
}
