// Speech interface for content script
// Creates a floating speech recognition interface on web pages

export function createSpeechInterface() {
  let isListening = false;
  let speechRecognition: any = null;
  let speechInterface: HTMLElement | null = null;
  
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
      updateInterface();
    };
    
    recognition.onresult = (event: any) => {
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
        // Send command to content script
        chrome.runtime.sendMessage({
          type: 'EXECUTE_COMMAND',
          command: finalTranscript
        });
      }
      
      updateTranscriptDisplay(finalTranscript, interimTranscript);
    };
    
    recognition.onend = () => {
      console.log('🎤 Accessly: Speech recognition ended');
      isListening = false;
      updateInterface();
    };
    
    recognition.onerror = (event: any) => {
      console.error('❌ Accessly: Speech recognition error:', event.error);
      isListening = false;
      updateInterface();
      showError(event.error);
    };
    
    return recognition;
  }
  
  // Create the floating interface
  function createInterface() {
    if (speechInterface) return speechInterface;
    
    speechInterface = document.createElement('div');
    speechInterface.id = 'accessly-speech-interface';
    speechInterface.innerHTML = `
      <div class="accessly-container">
        <div class="accessly-header">
          <span class="accessly-title">🎤 Accessly</span>
          <button class="accessly-close" aria-label="Close Accessly">×</button>
        </div>
        <div class="accessly-content">
          <button class="accessly-mic-button" aria-label="Start/Stop Voice Command">
            <span class="accessly-mic-icon">🎤</span>
            <span class="accessly-mic-text">Start Voice Command</span>
          </button>
          <div class="accessly-transcript">
            <div class="accessly-transcript-label">Voice Command:</div>
            <div class="accessly-transcript-text"></div>
          </div>
          <div class="accessly-status"></div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #accessly-speech-interface {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        backdrop-filter: blur(10px);
      }
      
      .accessly-container {
        padding: 16px;
      }
      
      .accessly-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .accessly-title {
        font-weight: 600;
        color: #333;
        font-size: 14px;
      }
      
      .accessly-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .accessly-close:hover {
        color: #333;
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
      
      .accessly-transcript {
        margin-top: 12px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 6px;
        min-height: 40px;
      }
      
      .accessly-transcript-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
        font-weight: 500;
      }
      
      .accessly-transcript-text {
        font-size: 14px;
        color: #333;
        line-height: 1.4;
      }
      
      .accessly-status {
        margin-top: 8px;
        font-size: 12px;
        color: #666;
        text-align: center;
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
    const closeButton = speechInterface.querySelector('.accessly-close');
    
    micButton?.addEventListener('click', toggleListening);
    closeButton?.addEventListener('click', hideInterface);
    
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
    } else {
      speechRecognition.start();
    }
  }
  
  // Update interface state
  function updateInterface() {
    if (!speechInterface) return;
    
    const micButton = speechInterface.querySelector('.accessly-mic-button');
    const micText = speechInterface.querySelector('.accessly-mic-text');
    const status = speechInterface.querySelector('.accessly-status');
    
    if (micButton && micText) {
      if (isListening) {
        micButton.classList.add('listening');
        micText.textContent = 'Listening...';
      } else {
        micButton.classList.remove('listening');
        micText.textContent = 'Start Voice Command';
      }
    }
    
    if (status) {
      status.textContent = isListening ? 'Speak now...' : 'Ready to listen';
    }
  }
  
  // Update transcript display
  function updateTranscriptDisplay(final: string, interim: string) {
    if (!speechInterface) return;
    
    const transcriptText = speechInterface.querySelector('.accessly-transcript-text');
    if (transcriptText) {
      transcriptText.innerHTML = `
        <span style="color: #333; font-weight: 500;">${final}</span>
        <span style="color: #666; font-style: italic;">${interim}</span>
      `;
    }
  }
  
  // Show error message
  function showError(error: string) {
    if (!speechInterface) return;
    
    const status = speechInterface.querySelector('.accessly-status');
    if (status) {
      status.textContent = `Error: ${error}`;
      status.style.color = '#e74c3c';
      
      setTimeout(() => {
        status.textContent = 'Ready to listen';
        status.style.color = '#666';
      }, 3000);
    }
  }
  
  // Hide interface
  function hideInterface() {
    if (speechInterface) {
      speechInterface.remove();
      speechInterface = null;
    }
  }
  
  // Show interface
  function showInterface() {
    createInterface();
  }
  
  return {
    toggleListening,
    showInterface,
    hideInterface,
    isListening: () => isListening
  };
}
