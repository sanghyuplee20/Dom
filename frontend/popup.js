// Popup script for Accessly browser extension

// Get DOM elements
const currentPageElement = document.getElementById('current-page');
const elementCountElement = document.getElementById('element-count');
const voiceStatusElement = document.getElementById('voice-status');
const toggleSpeechButton = document.getElementById('toggle-speech');
const showNumbersButton = document.getElementById('show-numbers');
const hideNumbersButton = document.getElementById('hide-numbers');
const refreshElementsButton = document.getElementById('refresh-elements');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

let isListening = false;

// Initialize popup
async function initializePopup() {
  console.log('Popup: Starting initialization');
  
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Popup: Got tab info:', tab);
    
    if (tab && tab.id) {
      // Show loading state initially
      currentPageElement.textContent = 'Loading...';
      elementCountElement.textContent = '0';
      voiceStatusElement.textContent = 'Ready';
      
      // First test if content script is responsive
      try {
        console.log('Popup: Testing content script with PING');
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        console.log('Popup: PING response:', pingResponse);
        
        // Now get page info from content script
        console.log('Popup: Sending GET_PAGE_INFO message to tab', tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
        console.log('Popup: Received response from content script:', response);
        
        if (response && response.success) {
          currentPageElement.textContent = response.title || 'Unknown Page';
          elementCountElement.textContent = response.elementCount.toString();
          console.log('Popup: Updated page info successfully');
        } else {
          console.log('Popup: Response was not successful:', response);
          currentPageElement.textContent = 'Error getting page info';
          elementCountElement.textContent = '0';
        }
      } catch (error) {
        console.log('Content script not ready, trying fallback:', error);
        
        // Fallback: Use tab info directly
        currentPageElement.textContent = tab.title || 'Unknown Page';
        elementCountElement.textContent = '0';
        console.log('Popup: Using fallback tab info:', tab.title);
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

// Toggle speech recognition
async function toggleSpeech() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      showError('No active tab found');
      return;
    }
    
    if (isListening) {
      // Stop listening
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SPEECH' });
      isListening = false;
      toggleSpeechButton.innerHTML = '<span>🎤</span><span>Start Voice Commands</span>';
      voiceStatusElement.textContent = 'Ready';
      showSuccess('Voice commands stopped');
    } else {
      // Start listening
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SPEECH' });
      isListening = true;
      toggleSpeechButton.innerHTML = '<span>🔴</span><span>Stop Voice Commands</span>';
      voiceStatusElement.textContent = 'Listening...';
      showSuccess('Voice commands started');
    }
  } catch (error) {
    console.error('Error toggling speech:', error);
    showError('Failed to toggle voice commands');
  }
}

// Show number overlay
async function showNumbers() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      showError('No active tab found');
      return;
    }
    
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_NUMBERS' });
    showSuccess('Number overlay activated');
  } catch (error) {
    console.error('Error showing numbers:', error);
    showError('Failed to show number overlay');
  }
}

// Hide number overlay
async function hideNumbers() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      showError('No active tab found');
      return;
    }
    
    await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_NUMBERS' });
    showSuccess('Number overlay hidden');
  } catch (error) {
    console.error('Error hiding numbers:', error);
    showError('Failed to hide number overlay');
  }
}

// Refresh elements
async function refreshElements() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      showError('No active tab found');
      return;
    }
    
    // Reload the page to refresh elements
    await chrome.tabs.reload(tab.id);
    showSuccess('Page refreshed');
  } catch (error) {
    console.error('Error refreshing elements:', error);
    showError('Failed to refresh page');
  }
}

// Add event listeners
if (toggleSpeechButton) {
  toggleSpeechButton.addEventListener('click', toggleSpeech);
}
if (showNumbersButton) {
  showNumbersButton.addEventListener('click', showNumbers);
}
if (hideNumbersButton) {
  hideNumbersButton.addEventListener('click', hideNumbers);
}
if (refreshElementsButton) {
  refreshElementsButton.addEventListener('click', refreshElements);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  
  switch (message.type) {
    case 'PAGE_INFO_READY':
      console.log('Popup: Received PAGE_INFO_READY message:', message);
      if (currentPageElement) {
        currentPageElement.textContent = message.title || 'Unknown Page';
      }
      if (elementCountElement) {
        elementCountElement.textContent = message.elementCount.toString();
      }
      break;
      
    case 'SPEECH_STATUS_CHANGED':
      isListening = message.isListening;
      if (isListening) {
        if (toggleSpeechButton) {
          toggleSpeechButton.innerHTML = '<span>🔴</span><span>Stop Voice Commands</span>';
        }
        if (voiceStatusElement) {
          voiceStatusElement.textContent = 'Listening...';
        }
      } else {
        if (toggleSpeechButton) {
          toggleSpeechButton.innerHTML = '<span>🎤</span><span>Start Voice Commands</span>';
        }
        if (voiceStatusElement) {
          voiceStatusElement.textContent = 'Ready';
        }
      }
      break;
      
    case 'ELEMENT_COUNT_UPDATED':
      if (elementCountElement) {
        elementCountElement.textContent = message.count.toString();
      }
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup: DOM loaded, initializing...');
  initializePopup();
});

// Also initialize immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  console.log('Popup: DOM still loading, waiting...');
} else {
  console.log('Popup: DOM already loaded, initializing immediately...');
  initializePopup();
}