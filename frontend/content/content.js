// Content script for Accessly browser extension
// Prevent multiple injections
if (window.accesslyContentScriptLoaded) {
  console.log('🎤 Accessly: Content script already loaded, skipping...');
} else {
  window.accesslyContentScriptLoaded = true;

console.log('🎤 Accessly: Content script loaded');

let speechInterface = null;
let isListening = false;
let speechRecognition = null;
let isRestarting = false;

// Initialize speech recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.error('❌ Accessly: Speech recognition not supported');
    return null;
  }
  
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onstart = () => {
    console.log('🎤 Accessly: Speech recognition started');
    isListening = true;
    updateStatus('Listening', 'listening');
  };
  
  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      
      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    if (finalTranscript) {
      console.log('🎯 Accessly: Final transcript:', finalTranscript);
      updateStatus('Processing...', 'processing');
      executeVoiceCommand(finalTranscript);
      // Status will be updated back to listening after command execution
      setTimeout(() => {
        if (isListening) {
          updateStatus('Listening', 'listening');
        }
      }, 1000);
    }
  };
  
  recognition.onend = () => {
    console.log('🎤 Accessly: Speech recognition ended');
    isListening = false;
    updateStatus('Ready', '');
    
    // Only restart if it ended normally (not due to error) and not already restarting
    if (!isRestarting) {
      isRestarting = true;
      setTimeout(() => {
        if (!isListening && !isRestarting) {
          try {
            console.log('🎤 Accessly: Restarting speech recognition...');
            speechRecognition.start();
          } catch (error) {
            console.log('Could not restart speech recognition:', error);
          }
        }
        isRestarting = false;
      }, 1000); // Increased delay to prevent rapid restart loops
    }
  };
  
  recognition.onerror = (event) => {
    console.error('❌ Accessly: Speech recognition error:', event.error);
    isListening = false;
    updateStatus('Error', 'error');
    
    // Don't restart on certain errors that indicate permanent issues
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      console.log('❌ Accessly: Microphone permission denied, not restarting');
      updateStatus('Permission Denied', 'error');
      return;
    }
    
    // Only restart on recoverable errors and not already restarting
    if ((event.error === 'aborted' || event.error === 'network' || event.error === 'no-speech') && !isRestarting) {
      console.log('🔄 Accessly: Recoverable error, will retry...');
      isRestarting = true;
      setTimeout(() => {
        if (!isListening && !isRestarting) {
          try {
            speechRecognition.start();
          } catch (error) {
            console.log('Could not restart after error:', error);
          }
        }
        isRestarting = false;
      }, 3000); // Longer delay for error recovery
    }
  };
  
  return recognition;
}

// Create the minimal floating interface (just a status indicator)
function createMinimalInterface() {
  if (speechInterface) return speechInterface;
  
  speechInterface = document.createElement('div');
  speechInterface.id = 'accessly-speech-interface';
  speechInterface.innerHTML = `
    <div class="accessly-minimal-container">
      <div class="accessly-status-indicator" id="accessly-status-indicator">
        <div class="accessly-status-text">Ready</div>
      </div>
    </div>
  `;
  
  // Add styles for minimal interface
  const style = document.createElement('style');
  style.textContent = `
    #accessly-speech-interface {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .accessly-minimal-container {
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #667eea;
      border-radius: 50px;
      padding: 8px 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    }
    
    .accessly-status-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .accessly-status-text {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
    }
    
    .accessly-status-indicator.listening {
      animation: accessly-pulse 2s infinite;
    }
    
    .accessly-status-indicator.listening .accessly-minimal-container {
      border-color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
    }
    
    .accessly-status-indicator.processing .accessly-minimal-container {
      border-color: #ffa500;
      background: rgba(255, 165, 0, 0.1);
    }
    
    @keyframes accessly-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(speechInterface);
  
  return speechInterface;
}

// Start continuous listening (always on)
function startContinuousListening() {
  console.log('🎤 Accessly: Starting continuous listening...');
  
  if (!speechRecognition) {
    speechRecognition = initSpeechRecognition();
  }
  
  if (!speechRecognition) {
    console.error('❌ Accessly: Speech recognition not available');
    updateStatus('Error', 'error');
    return;
  }
  
  // Start listening immediately
  try {
    speechRecognition.start();
    updateStatus('Listening', 'listening');
  } catch (error) {
    console.error('❌ Accessly: Error starting speech recognition:', error);
    updateStatus('Error', 'error');
  }
}

// Update status indicator
function updateStatus(text, state) {
  if (!speechInterface) return;
  
  const statusIndicator = speechInterface.querySelector('#accessly-status-indicator');
  const statusText = speechInterface.querySelector('.accessly-status-text');
  
  if (statusIndicator && statusText) {
    // Remove all state classes
    statusIndicator.classList.remove('listening', 'processing', 'error');
    
    // Add new state class
    if (state) {
      statusIndicator.classList.add(state);
    }
    
    // Update text
    statusText.textContent = text;
  }
}

// Update status from background script messages
function updateStatusFromBackground(status) {
  switch (status) {
    case 'listening':
      updateStatus('Listening', 'listening');
      isListening = true;
      break;
    case 'ready':
      updateStatus('Ready', '');
      isListening = false;
      break;
    case 'error':
      updateStatus('Error', 'error');
      isListening = false;
      break;
    default:
      updateStatus('Unknown', '');
  }
}

// Hide interface (for popup control)
function hideInterface() {
  if (speechInterface) {
    speechInterface.remove();
    speechInterface = null;
  }
}

// Execute voice command
function executeVoiceCommand(command) {
  console.log('🎯 Accessly: Executing command:', command);
  
  const lowerCommand = command.toLowerCase().trim();
  
  // Handle special commands
  if (lowerCommand.includes('show numbers')) {
    showNumberOverlay();
    return;
  }
  
  if (lowerCommand.includes('hide numbers')) {
    hideNumberOverlay();
    return;
  }
  
  // Handle click commands
  if (lowerCommand.includes('click')) {
    const targetText = extractTargetText(lowerCommand, 'click');
    const element = findElementByText(targetText);
    if (element) {
      element.click();
      console.log('✅ Accessly: Clicked element:', element);
    } else {
      console.log('❌ Accessly: Could not find element to click:', targetText);
    }
    return;
  }
  
  // Handle type commands
  if (lowerCommand.includes('type')) {
    const targetText = extractTargetText(lowerCommand, 'type');
    const inputElement = findInputElement();
    if (inputElement) {
      inputElement.focus();
      inputElement.value = targetText;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('✅ Accessly: Typed text:', targetText);
    } else {
      console.log('❌ Accessly: Could not find input element to type into');
    }
    return;
  }
  
  // Handle scroll commands
  if (lowerCommand.includes('scroll')) {
    if (lowerCommand.includes('down')) {
      window.scrollBy(0, 300);
      console.log('✅ Accessly: Scrolled down');
    } else if (lowerCommand.includes('up')) {
      window.scrollBy(0, -300);
      console.log('✅ Accessly: Scrolled up');
    }
    return;
  }
  
  console.log('❓ Accessly: Unknown command:', command);
}

// Helper functions
function extractTargetText(command, action) {
  const actionIndex = command.indexOf(action);
  if (actionIndex === -1) return '';
  
  const afterAction = command.substring(actionIndex + action.length).trim();
  return afterAction.replace(/\b(the|a|an|button|link|field)\b/g, '').trim();
}

function findElementByText(text) {
  const searchText = text.toLowerCase();
  const elements = document.querySelectorAll('button, a, input, textarea, [role="button"]');
  
  for (const element of elements) {
    const elementText = element.textContent?.toLowerCase() || '';
    const elementTitle = element.getAttribute('title')?.toLowerCase() || '';
    const elementAriaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (elementText.includes(searchText) || 
        elementTitle.includes(searchText) || 
        elementAriaLabel.includes(searchText)) {
      return element;
    }
  }
  
  return null;
}

function findInputElement() {
  const elements = document.querySelectorAll('input, textarea');
  for (const element of elements) {
    if (element.offsetParent !== null) { // Check if visible
      return element;
    }
  }
  return null;
}

// Number overlay functionality
let numberOverlay = null;
let numberedElements = [];

function showNumberOverlay() {
  hideNumberOverlay();
  
  const elements = document.querySelectorAll('button, a, input, textarea, [role="button"]');
  numberedElements = Array.from(elements).slice(0, 9);
  
  numberOverlay = document.createElement('div');
  numberOverlay.id = 'accessly-number-overlay';
  numberOverlay.innerHTML = `
    <div class="accessly-overlay-header">
      <span class="accessly-overlay-title">🔢 Voice Commands Available</span>
      <button class="accessly-overlay-close" aria-label="Close numbers">×</button>
    </div>
    <div class="accessly-overlay-content">
      <p class="accessly-overlay-instruction">Say the number to interact with elements:</p>
      <div class="accessly-overlay-elements"></div>
    </div>
  `;
  
  // Add overlay styles
  const overlayStyle = document.createElement('style');
  overlayStyle.textContent = `
    #accessly-number-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: rgba(255, 255, 255, 0.98);
      border: 2px solid #667eea;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      backdrop-filter: blur(10px);
      overflow-y: auto;
    }
    
    .accessly-overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 14px 14px 0 0;
    }
    
    .accessly-overlay-title {
      font-weight: 600;
      font-size: 16px;
    }
    
    .accessly-overlay-close {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }
    
    .accessly-overlay-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .accessly-overlay-content {
      padding: 20px;
    }
    
    .accessly-overlay-instruction {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 14px;
      text-align: center;
    }
    
    .accessly-overlay-elements {
      display: grid;
      gap: 8px;
    }
    
    .accessly-element-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .accessly-element-item:hover {
      background: #e3f2fd;
      border-color: #667eea;
      transform: translateY(-1px);
    }
    
    .accessly-element-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 50%;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .accessly-element-info {
      flex: 1;
      min-width: 0;
    }
    
    .accessly-element-description {
      font-size: 14px;
      color: #333;
      font-weight: 500;
      margin: 0 0 4px 0;
      word-break: break-word;
    }
    
    .accessly-element-type {
      font-size: 12px;
      color: #666;
      margin: 0;
    }
  `;
  
  document.head.appendChild(overlayStyle);
  document.body.appendChild(numberOverlay);
  
  // Add elements to overlay
  const elementsContainer = numberOverlay.querySelector('.accessly-overlay-elements');
  if (elementsContainer) {
    numberedElements.forEach((element, index) => {
      const elementItem = document.createElement('div');
      elementItem.className = 'accessly-element-item';
      elementItem.innerHTML = `
        <div class="accessly-element-number">${index + 1}</div>
        <div class="accessly-element-info">
          <div class="accessly-element-description">${getElementDescription(element)}</div>
          <div class="accessly-element-type">${element.tagName.toLowerCase()}</div>
        </div>
      `;
      
      elementItem.addEventListener('click', () => {
        element.click();
        hideNumberOverlay();
      });
      
      elementsContainer.appendChild(elementItem);
    });
  }
  
  // Add close button handler
  const closeButton = numberOverlay.querySelector('.accessly-overlay-close');
  closeButton?.addEventListener('click', hideNumberOverlay);
  
  // Add click outside to close
  numberOverlay.addEventListener('click', (e) => {
    if (e.target === numberOverlay) {
      hideNumberOverlay();
    }
  });
}

function hideNumberOverlay() {
  if (numberOverlay) {
    numberOverlay.remove();
    numberOverlay = null;
  }
  numberedElements = [];
}

function getElementDescription(element) {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  const title = element.getAttribute('title');
  if (title) return title;
  
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return placeholder;
  
  const value = element.value;
  if (value) return value;
  
  const textContent = element.textContent?.trim();
  if (textContent && textContent.length <= 50) return textContent;
  
  return element.tagName.toLowerCase();
}

// Listen for messages from popup/background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Accessly: Received message:', message);
  
  try {
    switch (message.type) {
      case 'PING':
        sendResponse({ success: true, message: 'Content script is ready' });
        break;
        
      case 'TOGGLE_SPEECH':
        // For continuous listening, this just shows/hides the interface
        if (!speechInterface) {
          createMinimalInterface();
          startContinuousListening();
        }
        sendResponse({ success: true, isListening: isListening });
        break;
        
      case 'GET_VOICE_STATUS':
        sendResponse({ success: true, isListening: isListening });
        break;
        
      case 'START_VOICE':
        if (!speechInterface) {
          createMinimalInterface();
        }
        if (!isListening) {
          startContinuousListening();
        }
        sendResponse({ success: true, isListening: isListening });
        break;
        
      case 'SHOW_NUMBERS':
        showNumberOverlay();
        sendResponse({ success: true });
        break;
        
      case 'HIDE_NUMBERS':
        hideNumberOverlay();
        sendResponse({ success: true });
        break;
        
      case 'TOGGLE_FLOATING_INTERFACE':
        if (!speechInterface) {
          createMinimalInterface();
          startContinuousListening();
          sendResponse({ success: true, visible: true });
        } else {
          hideInterface();
          sendResponse({ success: true, visible: false });
        }
        break;
        
      case 'GET_PAGE_INFO':
        const elements = document.querySelectorAll('button, a, input, textarea, [role="button"]');
        sendResponse({
          success: true,
          url: window.location.href,
          title: document.title,
          elementCount: elements.length
        });
        break;
        
      default:
        console.log('❓ Accessly: Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('❌ Accessly: Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep message channel open for async response
});

// Initialize the extension when the page loads
function initializeExtension() {
  console.log('🎤 Accessly: Initializing voice-controlled accessibility...');
  console.log('🎤 Accessly: Page URL:', window.location.href);
  console.log('🎤 Accessly: Page title:', document.title);
  
  // Create the minimal floating interface and start listening automatically
  createMinimalInterface();
  startContinuousListening();
  
  // Send ready signal to background script
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    url: window.location.href,
    title: document.title
  }).catch(error => {
    console.log('Could not send ready signal:', error);
  });
}

// Wait for the page to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

} // End of the else block for preventing multiple injections
