// Content script to help extract transcripts
console.log('YouTube Transcript Extractor loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractTranscript') {
    const transcript = extractTranscriptFromPage();
    sendResponse({ transcript: transcript });
  }
});

function extractTranscriptFromPage() {
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
    
    // Wait a bit and try to extract
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
    }, 1000);
  }
  
  return null;
}
