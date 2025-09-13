// Popup script for Accessly browser extension

// Get DOM elements
const currentPageElement = document.getElementById('current-page') as HTMLElement;
const elementCountElement = document.getElementById('element-count') as HTMLElement;
const voiceStatusElement = document.getElementById('voice-status') as HTMLElement;
const toggleSpeechButton = document.getElementById('toggle-speech') as HTMLButtonElement;
const showNumbersButton = document.getElementById('show-numbers') as HTMLButtonElement;
const hideNumbersButton = document.getElementById('hide-numbers') as HTMLButtonElement;
const refreshElementsButton = document.getElementById('refresh-elements') as HTMLButtonElement;
const errorMessage = document.getElementById('error-message') as HTMLElement;
const successMessage = document.getElementById('success-message') as HTMLElement;

let isListening = false;

// Initialize popup
async function initializePopup() {
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.id) {
      currentPageElement.textContent = tab.title || 'Unknown Page';
      
      // Get page info from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
        if (response) {
          elementCountElement.textContent = response.elementCount.toString();
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
function showError(message: string) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
  
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// Show success message
function showSuccess(message: string) {
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
toggleSpeechButton.addEventListener('click', toggleSpeech);
showNumbersButton.addEventListener('click', showNumbers);
hideNumbersButton.addEventListener('click', hideNumbers);
refreshElementsButton.addEventListener('click', refreshElements);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  
  switch (message.type) {
    case 'SPEECH_STATUS_CHANGED':
      isListening = message.isListening;
      if (isListening) {
        toggleSpeechButton.innerHTML = '<span>🔴</span><span>Stop Voice Commands</span>';
        voiceStatusElement.textContent = 'Listening...';
      } else {
        toggleSpeechButton.innerHTML = '<span>🎤</span><span>Start Voice Commands</span>';
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
