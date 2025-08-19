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
      
      if (!tab.url.includes('youtube.com')) {
        throw new Error('Please open a YouTube video first!');
      }
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractTranscript
      });
      
      if (result[0].result) {
        const transcript = result[0].result;
        transcriptText.textContent = transcript;
        transcriptContainer.style.display = 'block';
        exportBtn.style.display = 'block';
        status.textContent = 'Transcript extracted successfully!';
        status.className = 'status success';
      } else {
        throw new Error('No transcript found for this video');
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
      // Find YouTube tab
      const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      
      if (tabs.length === 0) {
        // No YouTube tab open, open one with the video
        const newTab = await chrome.tabs.create({ 
          url: `https://www.youtube.com/watch?v=${videoId}`,
          active: false 
        });
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract transcript
        const result = await chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          function: extractTranscript
        });
        
        if (result[0].result) {
          sendResponse({ transcript: result[0].result });
        } else {
          sendResponse({ error: 'No transcript found' });
        }
        
        // Close the tab
        chrome.tabs.remove(newTab.id);
      } else {
        // Use existing YouTube tab
        const result = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: extractTranscript
        });
        
        if (result[0].result) {
          sendResponse({ transcript: result[0].result });
        } else {
          sendResponse({ error: 'No transcript found' });
        }
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
});

function extractTranscript() {
  // Method 1: Try to find existing transcript
  const transcriptPanel = document.querySelector('ytd-transcript-renderer');
  if (transcriptPanel) {
    const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
    if (segments.length > 0) {
      let transcript = '';
      segments.forEach(segment => {
        const text = segment.querySelector('#content-text');
        if (text) {
          transcript += text.textContent + '\n';
        }
      });
      return transcript.trim();
    }
  }
  
  // Method 2: Try to open transcript panel
  const transcriptButton = document.querySelector('button[aria-label*="transcript"], button[aria-label*="Transcript"]');
  if (transcriptButton) {
    transcriptButton.click();
    
    // Wait for transcript panel to load
    setTimeout(() => {
      const transcriptPanel = document.querySelector('ytd-transcript-renderer');
      if (transcriptPanel) {
        const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
        if (segments.length > 0) {
          let transcript = '';
          segments.forEach(segment => {
            const text = segment.querySelector('#content-text');
            if (text) {
              transcript += text.textContent + '\n';
            }
          });
          return transcript.trim();
        }
      }
    }, 2000);
  }
  
  // Method 3: Try alternative selectors
  const alternativeSegments = document.querySelectorAll('[data-testid="transcript-segment"]');
  if (alternativeSegments.length > 0) {
    let transcript = '';
    alternativeSegments.forEach(segment => {
      const text = segment.querySelector('[data-testid="transcript-segment-text"]');
      if (text) {
        transcript += text.textContent + '\n';
      }
    });
    return transcript.trim();
  }
  
  return null;
}
