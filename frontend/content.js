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
let lastInterimResult = '';
let interimTimeout = null;

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
  recognition.maxAlternatives = 1;
  
  // Optimize for faster response
  if ('webkitSpeechRecognition' in window) {
    // Chrome-specific optimizations
    recognition.serviceURI = 'wss://www.google.com/speech-api/full-duplex/v1/up';
  }
  
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
      const transcript = result[0].transcript.trim();
      
      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Process final results immediately
    if (finalTranscript) {
      console.log('🎯 Accessly: Final transcript:', finalTranscript);
      updateStatus('Processing...', 'processing');
      executeVoiceCommand(finalTranscript);
      return;
    }
    
    // Handle interim results with smart timeout
    if (interimTranscript && interimTranscript.length > 2) {
      const trimmed = interimTranscript.trim();
      lastInterimResult = trimmed;
      
      // Clear any existing timeout
      if (interimTimeout) {
        clearTimeout(interimTimeout);
      }
      
      // Only process immediately for very obvious complete commands (with punctuation)
      if (trimmed.endsWith('.') || trimmed.endsWith('?') || trimmed.endsWith('!')) {
        console.log('🎯 Accessly: Processing punctuated command:', trimmed);
        updateStatus('Processing...', 'processing');
        executeVoiceCommand(trimmed);
        lastInterimResult = '';
        return;
      }
      
      // Set timeout to process command if user stops talking (2 seconds of silence)
      if (trimmed.length > 3) {
        interimTimeout = setTimeout(() => {
          if (lastInterimResult === trimmed && trimmed.length > 3) {
            console.log('🎯 Accessly: Processing command after 2-second silence:', trimmed);
            updateStatus('Processing...', 'processing');
            executeVoiceCommand(trimmed);
            lastInterimResult = '';
          }
        }, 2000); // 2 second timeout as requested
      }
    }
  };
  
  recognition.onend = () => {
    console.log('🎤 Accessly: Speech recognition ended');
    isListening = false;
    updateStatus('Ready', '');
    
    // Clear any pending timeout
    if (interimTimeout) {
      clearTimeout(interimTimeout);
      interimTimeout = null;
    }
    lastInterimResult = '';
    
    // Auto-restart for continuous listening (with delay to prevent rapid cycling)
    if (!isRestarting) {
      isRestarting = true;
      setTimeout(() => {
        if (!isListening && speechRecognition) {
          try {
            console.log('🎤 Accessly: Auto-restarting speech recognition...');
            speechRecognition.start();
          } catch (error) {
            console.log('Could not auto-restart speech recognition:', error);
          }
        }
        isRestarting = false;
      }, 500); // Reduced to 0.5 second delay for faster restart
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
    
    // Restart on recoverable errors for continuous listening
    if ((event.error === 'aborted' || event.error === 'network' || event.error === 'no-speech') && !isRestarting) {
      console.log('🔄 Accessly: Recoverable error, will retry for continuous listening...');
      isRestarting = true;
      setTimeout(() => {
        if (!isListening && speechRecognition) {
          try {
            console.log('🎤 Accessly: Restarting after error...');
            speechRecognition.start();
          } catch (error) {
            console.log('Could not restart after error:', error);
          }
        }
        isRestarting = false;
      }, 2000); // 2 second delay for error recovery
    }
  };
  
  return recognition;
}

// Check if a transcript looks like a complete command (more conservative now)
function isCompleteCommand(transcript) {
  const lowerTranscript = transcript.toLowerCase().trim();
  
  // Only very obvious complete patterns (single word commands)
  const completePatterns = [
    /^(scroll)\s+(up|down)$/,                    // "scroll down" (complete)
    /^(show|hide)\s+numbers$/,                   // "show numbers" (complete)
    /^(refresh|reload)$/,                        // "refresh" (complete)
    /^(back|forward)$/,                          // "back" (complete)
    /^(close|exit)$/                             // "close" (complete)
  ];
  
  return completePatterns.some(pattern => pattern.test(lowerTranscript));
}

// Create the elaborate floating interface (original design)
function createMinimalInterface() {
  if (speechInterface) return speechInterface;
  
  speechInterface = document.createElement('div');
  speechInterface.id = 'accessly-speech-interface';
  speechInterface.innerHTML = `
    <button class="accessly-mic-button" aria-label="Start/Stop Voice Command">
      <span class="accessly-mic-icon">🎤</span>
      <span class="accessly-mic-text">Start Voice Command</span>
    </button>
  `;
  
  // Add styles for elaborate interface
  const style = document.createElement('style');
  style.textContent = `
    #accessly-speech-interface {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    
    .accessly-mic-button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .accessly-mic-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .accessly-mic-button.listening {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
      animation: accessly-pulse 2s infinite;
    }
    
    .accessly-mic-icon {
      font-size: 16px;
    }
    
    .accessly-mic-text {
      flex: 1;
      text-align: left;
    }
    
    
    @keyframes accessly-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(speechInterface);
  
  // Add event listeners
  const micButton = speechInterface.querySelector('.accessly-mic-button');
  
  micButton?.addEventListener('click', toggleListening);
  
  return speechInterface;
}

// Toggle listening state
function toggleListening() {
  if (!speechRecognition) {
    speechRecognition = initSpeechRecognition();
  }
  
  if (!speechRecognition) return;
  
  
  if (isListening) {
    speechRecognition.stop();
    updateStatus('Stopped', '');
  } else {
    try {
      speechRecognition.start();
      updateStatus('Starting...', 'listening');
    } catch (error) {
      console.error('❌ Accessly: Error starting speech recognition:', error);
      updateStatus('Click to retry', 'error');
    }
  }
}

// Hide interface
function hideInterface() {
  if (speechInterface) {
    speechInterface.remove();
    speechInterface = null;
  }
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
    updateStatus('Starting...', 'listening');
  } catch (error) {
    console.error('❌ Accessly: Error starting speech recognition:', error);
    updateStatus('Click to retry', 'error');
  }
}

// Update status indicator
function updateStatus(text, state) {
  if (!speechInterface) return;
  
  const micButton = speechInterface.querySelector('.accessly-mic-button');
  const micText = speechInterface.querySelector('.accessly-mic-text');
  
  if (micButton && micText) {
    if (state === 'listening') {
      micButton.classList.add('listening');
      micText.textContent = 'Listening...';
    } else {
      micButton.classList.remove('listening');
      micText.textContent = 'Start Voice Command';
    }
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


// Execute voice command through agentic workflow
async function executeVoiceCommand(command) {
  console.log('🎯 Accessly: Executing command through agentic workflow:', command);
  
  const lowerCommand = command.toLowerCase().trim();
  
  // Handle special local commands first
  if (lowerCommand.includes('show numbers')) {
    showNumberOverlay();
    return;
  }
  
  if (lowerCommand.includes('hide numbers')) {
    hideNumberOverlay();
    return;
  }
  
  // Send command to backend agentic workflow
  try {
    updateStatus('Processing...', 'processing');
    
    const response = await fetch('http://localhost:8000/process-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: command,
        page_context: {
          url: window.location.href,
          title: document.title,
          elements: [], // We'll add DOM elements later if needed
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          scroll_position: {
            x: window.scrollX,
            y: window.scrollY
          },
          timestamp: new Date().toISOString()
        },
        client_id: 'browser-extension',
        session_id: 'voice-session',
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🤖 Accessly: Backend response:', result);
    
    // Handle the new backend response format
    if (result.command_type === 'action_sequence' && result.actions && result.actions.length > 0) {
      console.log('🎬 Accessly: Executing action sequence with', result.total_actions, 'actions');
      await executeActionSequence(result.actions);
      updateStatus('Actions completed', '');
    } else if (result.command_type === 'show_numbers') {
      console.log('🔢 Accessly: Showing numbers overlay');
      showNumberOverlay();
      updateStatus('Numbers shown', '');
    } else if (result.command_type === 'action_sequence' && result.total_actions === 0) {
      console.log('❌ Accessly: Backend returned 0 actions - debugging needed');
      updateStatus('Backend returned 0 actions', 'error');
    } else {
      console.log('❌ Accessly: Backend could not process command:', result.error_message || 'Unknown response format');
      updateStatus('Command not understood', 'error');
    }
    
  } catch (error) {
    console.error('❌ Accessly: Error communicating with backend:', error);
    
    // Fallback to local processing if backend is unavailable
    console.log('🔄 Accessly: Falling back to local processing...');
    executeLocalCommand(command);
  }
}

// Execute action sequence returned by backend
async function executeActionSequence(actions) {
  console.log('🎬 Accessly: Executing action sequence with', actions.length, 'actions');
  
  // Sort actions by sequence_order
  const sortedActions = actions.sort((a, b) => a.sequence_order - b.sequence_order);
  
  for (const action of sortedActions) {
    console.log('🎯 Accessly: Executing action:', action.action, 'on', action.target);
    
    try {
      await executeBackendAction(action);
      
      // Wait between actions if specified
      if (action.wait_time && action.wait_time > 0) {
        await new Promise(resolve => setTimeout(resolve, action.wait_time * 1000));
      }
    } catch (error) {
      console.error('❌ Accessly: Error executing action:', action.action, error);
      // Continue with next action even if one fails
    }
  }
}

// Execute individual action returned by backend
async function executeBackendAction(action) {
  console.log('🎬 Accessly: Executing backend action:', action.action);
  
  switch (action.action) {
    case 'click':
      let element = null;
      if (action.selector) {
        element = document.querySelector(action.selector);
      } else if (action.xpath) {
        element = document.evaluate(action.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } else if (action.target) {
        element = findElementByText(action.target);
      }
      
      if (element) {
        element.click();
        console.log('✅ Accessly: Clicked element via backend:', element);
      } else {
        console.log('❌ Accessly: Element not found for click:', action.target || action.selector);
        throw new Error('Element not found');
      }
      break;
      
    case 'type':
      console.log('🔍 Accessly: Type action details:', {
        selector: action.selector,
        target: action.target,
        text: action.text
      });
      
      let inputElement = null;
      if (action.selector) {
        console.log('🔍 Accessly: Trying selector:', action.selector);
        inputElement = document.querySelector(action.selector);
        console.log('🔍 Accessly: Selector result:', inputElement);
      } else {
        console.log('🔍 Accessly: Using fallback findInputElement');
        inputElement = findInputElement();
        console.log('🔍 Accessly: Fallback result:', inputElement);
      }
      
      // Try multiple Google search selectors if the backend selector failed
      if (!inputElement) {
        const googleSelectors = [
          'input[name="q"]',
          'input[title="Search"]',
          'textarea[name="q"]',
          'input[type="search"]',
          '.gLFyf', // Google's search input class
          '#APjFqb' // Google's search input ID
        ];
        
        for (const selector of googleSelectors) {
          inputElement = document.querySelector(selector);
          if (inputElement) {
            console.log('✅ Accessly: Found input with selector:', selector);
            break;
          }
        }
      }
      
      if (inputElement && action.text) {
        inputElement.focus();
        inputElement.value = action.text;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Also trigger search if it's Google
        if (window.location.hostname.includes('google.com')) {
          // Try to find and click search button or press Enter
          setTimeout(() => {
            const searchButton = document.querySelector('input[type="submit"][value="Google Search"], button[aria-label="Google Search"], .FPdoLc input[type="submit"]');
            if (searchButton) {
              searchButton.click();
              console.log('✅ Accessly: Clicked Google search button');
            } else {
              // Fallback: press Enter
              inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
              console.log('✅ Accessly: Pressed Enter to search');
            }
          }, 100);
        }
        
        console.log('✅ Accessly: Typed text via backend:', action.text);
      } else {
        console.log('❌ Accessly: Input element not found or no text specified');
        console.log('❌ Accessly: Available input elements:', document.querySelectorAll('input, textarea'));
        throw new Error('Input element not found');
      }
      break;
      
    case 'scroll':
      const amount = action.coordinates?.y || 300;
      window.scrollBy(0, amount);
      console.log('✅ Accessly: Scrolled via backend:', amount, 'pixels');
      break;
      
    case 'navigate':
      if (action.text) {
        window.location.href = action.text;
        console.log('✅ Accessly: Navigated via backend:', action.text);
      }
      break;
      
    case 'wait':
      // Wait is handled in the sequence loop
      console.log('⏱️ Accessly: Waiting', action.wait_time, 'seconds');
      break;
      
    default:
      console.log('❓ Accessly: Unknown backend action:', action.action);
      throw new Error('Unknown action type');
  }
}

// Fallback local command processing (enhanced logic)
function executeLocalCommand(command) {
  console.log('🔄 Accessly: Processing locally:', command);
  
  const lowerCommand = command.toLowerCase().trim();
  
  // Handle search commands
  if (lowerCommand.includes('search')) {
    const searchTerm = extractSearchTerm(lowerCommand);
    if (searchTerm) {
      handleSearchCommand(searchTerm);
      return;
    }
  }
  
  // Handle navigation commands
  if (lowerCommand.includes('go to') || lowerCommand.includes('navigate to') || lowerCommand.includes('open')) {
    const url = extractNavigationUrl(lowerCommand);
    if (url) {
      window.location.href = url;
      console.log('✅ Accessly: Navigating to:', url);
      updateStatus('Navigating', '');
      return;
    }
  }
  
  // Handle click commands
  if (lowerCommand.includes('click')) {
    const targetText = extractTargetText(lowerCommand, 'click');
    const element = findElementByText(targetText);
    if (element) {
      element.click();
      console.log('✅ Accessly: Clicked element locally:', element);
      updateStatus('Clicked', '');
    } else {
      console.log('❌ Accessly: Could not find element to click:', targetText);
      updateStatus('Element not found', 'error');
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
      console.log('✅ Accessly: Typed text locally:', targetText);
      updateStatus('Typed', '');
    } else {
      console.log('❌ Accessly: Could not find input element to type into');
      updateStatus('Input not found', 'error');
    }
    return;
  }
  
  // Handle scroll commands
  if (lowerCommand.includes('scroll')) {
    if (lowerCommand.includes('down')) {
      window.scrollBy(0, 300);
      console.log('✅ Accessly: Scrolled down locally');
      updateStatus('Scrolled', '');
    } else if (lowerCommand.includes('up')) {
      window.scrollBy(0, -300);
      console.log('✅ Accessly: Scrolled up locally');
      updateStatus('Scrolled', '');
    }
    return;
  }
  
  console.log('❓ Accessly: Unknown local command:', command);
  updateStatus('Unknown command', 'error');
}

// Extract search term from command
function extractSearchTerm(command) {
  const searchPatterns = [
    /search\s+(.+)/i,
    /search\s+for\s+(.+)/i,
    /look\s+for\s+(.+)/i,
    /find\s+(.+)/i
  ];
  
  for (const pattern of searchPatterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Handle search commands
function handleSearchCommand(searchTerm) {
  console.log('🔍 Accessly: Handling search for:', searchTerm);
  
  // Try to find a search input field
  const searchInputs = document.querySelectorAll('input[type="search"], input[name*="search"], input[id*="search"], input[placeholder*="search"], input[aria-label*="search"]');
  
  if (searchInputs.length > 0) {
    const searchInput = searchInputs[0];
    searchInput.focus();
    searchInput.value = searchTerm;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Try to find and click search button
    setTimeout(() => {
      const searchButtons = document.querySelectorAll('button[type="submit"], button[aria-label*="search"], button[title*="search"], input[type="submit"]');
      for (const button of searchButtons) {
        if (button.offsetParent !== null) { // Check if visible
          button.click();
          console.log('✅ Accessly: Executed search locally');
          updateStatus('Searched', '');
          return;
        }
      }
      
      // If no button found, try pressing Enter
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      console.log('✅ Accessly: Executed search with Enter key');
      updateStatus('Searched', '');
    }, 100);
  } else {
    // If no search field, try Google search
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
    window.location.href = googleUrl;
    console.log('✅ Accessly: Redirecting to Google search');
    updateStatus('Searching on Google', '');
  }
}

// Extract navigation URL from command
function extractNavigationUrl(command) {
  // Common website mappings
  const siteMap = {
    'youtube': 'https://www.youtube.com',
    'youtube.com': 'https://www.youtube.com',
    'google': 'https://www.google.com',
    'google.com': 'https://www.google.com',
    'gmail': 'https://mail.google.com',
    'gmail.com': 'https://mail.google.com',
    'facebook': 'https://www.facebook.com',
    'twitter': 'https://www.twitter.com',
    'instagram': 'https://www.instagram.com',
    'linkedin': 'https://www.linkedin.com',
    'github': 'https://www.github.com',
    'stackoverflow': 'https://stackoverflow.com',
    'reddit': 'https://www.reddit.com',
    'netflix': 'https://www.netflix.com',
    'amazon': 'https://www.amazon.com',
    'naver': 'https://www.naver.com',
    'naver.com': 'https://www.naver.com'
  };
  
  const navigationPatterns = [
    /(?:go to|navigate to|open)\s+(.+)/i,
    /(.+\.com)/i,
    /(.+)/i
  ];
  
  for (const pattern of navigationPatterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      const target = match[1].trim().toLowerCase();
      
      // Check if it's a known site
      if (siteMap[target]) {
        return siteMap[target];
      }
      
      // Check if it looks like a URL
      if (target.includes('.')) {
        return target.startsWith('http') ? target : `https://${target}`;
      }
    }
  }
  
  return null;
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
        console.log('📨 Accessly: Responding to PING');
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
        // Interface always stays visible - no toggle
        if (!speechInterface) {
          createMinimalInterface();
          startContinuousListening();
        }
        sendResponse({ success: true, visible: true });
        break;
        
      case 'GET_PAGE_INFO':
        console.log('📨 Accessly: Handling GET_PAGE_INFO request');
        const elements = document.querySelectorAll('button, a, input, textarea, [role="button"]');
        const pageInfo = {
          success: true,
          url: window.location.href,
          title: document.title,
          elementCount: elements.length
        };
        console.log('📨 Accessly: Sending page info:', pageInfo);
        sendResponse(pageInfo);
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
  
  // Create the floating interface and start continuous listening
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
  
  // Also try to send page info to any listening popup
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'PAGE_INFO_READY',
      url: window.location.href,
      title: document.title,
      elementCount: document.querySelectorAll('button, a, input, textarea, [role="button"]').length
    }).catch(error => {
      console.log('Could not send page info:', error);
    });
  }, 1000);
}

// Wait for the page to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Clean up resources when page is about to unload (using pagehide instead of unload)
window.addEventListener('pagehide', () => {
  console.log('🎤 Accessly: Page unloading, cleaning up...');
  if (speechRecognition && isListening) {
    try {
      speechRecognition.stop();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  isListening = false;
  isRestarting = false;
});

} // End of the else block for preventing multiple injections
