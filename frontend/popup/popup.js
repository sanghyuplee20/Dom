// Popup script for Accessly browser extension

// Get DOM elements
const currentPageElement = document.getElementById('current-page');
const elementCountElement = document.getElementById('element-count');
const voiceStatusElement = document.getElementById('voice-status');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

let isListening = false;

// Initialize popup
async function initializePopup() {
  try {
    // Clear any existing error messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.id) {
      currentPageElement.textContent = tab.title || 'Unknown Page';
      
      // Debug: Log the actual URL
      console.log('Current tab URL:', tab.url);
      console.log('Tab title:', tab.title);
      
      // Only block actual Chrome internal pages
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url === 'chrome://newtab/' || tab.url === 'about:blank')) {
        console.log('Blocking Chrome page:', tab.url);
        elementCountElement.textContent = 'N/A';
        showError('Please navigate to a regular website (like google.com) to use voice commands. Chrome pages don\'t support extensions.');
        return;
      }
      
      console.log('Allowing regular website:', tab.url);
      
      // Get page info from content script
      try {
        // Check if content script is already loaded
        try {
          const checkResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
          if (!checkResponse || !checkResponse.success) {
            throw new Error('Content script not loaded');
          }
        } catch (error) {
          console.log('Content script not loaded, injecting...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            // Wait a moment for content script to initialize
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (injectError) {
            console.log('Content script injection failed:', injectError);
          }
        }
        
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
        console.log('GET_PAGE_INFO response:', response);
        if (response && response.success) {
          elementCountElement.textContent = response.elementCount.toString();
        } else {
          elementCountElement.textContent = '0';
        }
        
        // Check voice status
        try {
          const voiceResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VOICE_STATUS' });
          if (voiceResponse && voiceResponse.success) {
            isListening = voiceResponse.isListening;
            if (isListening) {
              toggleSpeechButton.innerHTML = '<span>🔴</span><span>Voice Commands Active</span>';
              voiceStatusElement.textContent = 'Listening...';
            } else {
              toggleSpeechButton.innerHTML = '<span>🎤</span><span>Start Voice Commands</span>';
              voiceStatusElement.textContent = 'Ready';
            }
          }
        } catch (voiceError) {
          console.log('Could not get voice status:', voiceError);
        }
      } catch (error) {
        console.log('Content script not ready:', error);
        elementCountElement.textContent = '0';
      }
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize popup');
  }
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
  
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// Show success message
function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';
  
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 3000);
}


// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  
  switch (message.type) {
    case 'SPEECH_STATUS_CHANGED':
      isListening = message.isListening;
      if (isListening) {
        voiceStatusElement.textContent = 'Listening...';
      } else {
        voiceStatusElement.textContent = 'Ready';
      }
      break;
      
    case 'ELEMENT_COUNT_UPDATED':
      elementCountElement.textContent = message.count.toString();
      break;
      
    case 'COMMAND_EXECUTED':
      showSuccess(`Command executed: ${message.command}`);
      break;
      
    case 'ERROR':
      showError(message.error);
      break;
  }
});

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);
