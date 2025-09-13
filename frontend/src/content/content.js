class SpeechRecognitionExtension {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.silenceTimer = null;
    this.transcriptText = '';
    this.init();
  }

  init() {
    this.createUI();
    this.initSpeechRecognition();
    this.attachEventListeners();
  }

  createUI() {
    // Create floating button
    this.button = document.createElement('button');
    this.button.id = 'speech-recognition-button';
    this.button.innerHTML = 'BEGIN';
    this.button.title = 'Click to start speech recognition';
    
    // Create output container
    this.output = document.createElement('div');
    this.output.id = 'speech-recognition-output';
    
    document.body.appendChild(this.button);
    document.body.appendChild(this.output);
  }

  initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.showError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.button.classList.add('listening');
      this.button.innerHTML = 'LISTENING';
      this.output.classList.add('show');
      this.startSilenceTimer();
    };

    this.recognition.onresult = (event) => {
      this.resetSilenceTimer();
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      this.displayTranscript(finalTranscript, interimTranscript);

      // Check for stop command
      if (finalTranscript.toLowerCase().includes('end chat')) {
        this.stopListening();
        return;
      }

      this.startSilenceTimer();
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.showError(`Error: ${event.error}`);
      this.stopListening();
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.stopListening();
    };
  }

  attachEventListeners() {
    console.log('🔗 Attaching event listeners...');
    
    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🖱️ Button clicked, current state:', this.isListening ? 'listening' : 'idle');
      
      if (this.isListening) {
        console.log('⏹️ User manually stopped listening');
        this.stopListening();
      } else {
        console.log('▶️ User started listening');
        this.startListening();
      }
    });

    // Enhanced draggable functionality
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    this.button.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.button.offsetLeft;
      startTop = this.button.offsetTop;
      e.preventDefault();
      
      console.log('🖱️ Button drag started at:', { x: startX, y: startY });
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newLeft = startLeft + deltaX;
      const newTop = startTop + deltaY;
      
      // Keep button within viewport bounds
      const maxLeft = window.innerWidth - this.button.offsetWidth;
      const maxTop = window.innerHeight - this.button.offsetHeight;
      
      const boundedLeft = Math.max(0, Math.min(newLeft, maxLeft));
      const boundedTop = Math.max(0, Math.min(newTop, maxTop));
      
      this.button.style.left = boundedLeft + 'px';
      this.button.style.top = boundedTop + 'px';
      this.button.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        console.log('🖱️ Button drag ended at position:', {
          left: this.button.style.left,
          top: this.button.style.top
        });
      }
      isDragging = false;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt + S to toggle speech recognition
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        console.log('⌨️ Keyboard shortcut activated (Alt+S)');
        
        if (this.isListening) {
          this.stopListening();
        } else {
          this.startListening();
        }
      }
    });

    console.log('✅ Event listeners attached successfully');
    console.log('💡 Tip: Use Alt+S as a keyboard shortcut to toggle speech recognition');
  }

  startListening() {
    if (!this.recognition) return;
    
    try {
      this.transcriptText = '';
      this.output.innerHTML = '';
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      this.showError('Failed to start speech recognition');
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    
    this.isListening = false;
    this.button.classList.remove('listening', 'processing');
    this.button.innerHTML = 'BEGIN';
    this.clearSilenceTimer();
    
    // Hide output after 5 seconds
    setTimeout(() => {
      this.output.classList.remove('show');
    }, 5000);
  }

  startSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      console.log('Silence detected - stopping recognition');
      this.stopListening();
    }, 5000); // 5 seconds of silence
  }

  resetSilenceTimer() {
    this.clearSilenceTimer();
    this.startSilenceTimer();
  }

  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  displayTranscript(final, interim) {
    const finalDiv = document.createElement('div');
    finalDiv.className = 'speech-text final';
    finalDiv.textContent = final;

    const interimDiv = document.createElement('div');
    interimDiv.className = 'speech-text';
    interimDiv.textContent = interim;

    this.output.innerHTML = '';
    if (final) this.output.appendChild(finalDiv);
    if (interim) this.output.appendChild(interimDiv);
  }

  showError(message) {
    this.output.innerHTML = `<div style="color: red; font-weight: bold;">${message}</div>`;
    this.output.classList.add('show');
    
    setTimeout(() => {
      this.output.classList.remove('show');
    }, 3000);
  }
}

// Initialize the extension when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SpeechRecognitionExtension();
  });
} else {
  new SpeechRecognitionExtension();
}