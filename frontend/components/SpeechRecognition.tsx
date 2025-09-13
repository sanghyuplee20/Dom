import React, { useState, useEffect } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import './SpeechRecognition.css';

interface SpeechRecognitionProps {
  onTranscript?: (transcript: string) => void;
  onCommand?: (command: string) => void;
  className?: string;
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({
  onTranscript,
  onCommand,
  className = ''
}) => {
  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    finalTranscript,
    error,
    confidence,
    startListening,
    stopListening,
    reset
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: 'en-US'
  });

  const [isActive, setIsActive] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  // Handle transcript changes
  useEffect(() => {
    console.log('Transcript changed:', { transcript, interimTranscript, finalTranscript });
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, interimTranscript, finalTranscript, onTranscript]);

  // Handle final transcript for commands
  useEffect(() => {
    if (finalTranscript && onCommand) {
      const command = finalTranscript.toLowerCase().trim();
      
      // Check for "show numbers" command
      if (command.includes('show numbers')) {
        setShowNumbers(true);
        onCommand('show_numbers');
        return;
      }
      
      // Check for "hide numbers" command
      if (command.includes('hide numbers')) {
        setShowNumbers(false);
        onCommand('hide_numbers');
        return;
      }
      
      // Pass other commands
      onCommand(command);
    }
  }, [finalTranscript, onCommand]);

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      setIsActive(false);
    } else {
      startListening();
      setIsActive(true);
    }
  };

  const handleReset = () => {
    reset();
    setShowNumbers(false);
  };

  if (!isSupported) {
    return (
      <div className={`speech-recognition-error ${className}`}>
        <div className="error-icon">🎤</div>
        <p>Speech recognition is not supported in this browser.</p>
        <p>Please use Chrome, Edge, or Safari for the best experience.</p>
      </div>
    );
  }

  return (
    <div className={`speech-recognition ${className}`}>
      <div className="speech-controls">
        <button
          className={`mic-button ${isListening ? 'listening' : ''} ${isActive ? 'active' : ''}`}
          onClick={handleToggleListening}
          disabled={!isSupported}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          <div className="mic-icon">
            {isListening ? '🔴' : '🎤'}
          </div>
          <span className="mic-text">
            {isListening ? 'Listening...' : 'Start Voice Command'}
          </span>
        </button>
        
        <button
          className="reset-button"
          onClick={handleReset}
          aria-label="Reset speech recognition"
        >
          🔄 Reset
        </button>
        
        <button
          className="test-button"
          onClick={() => {
            console.log('Current state:', { isListening, isSupported, transcript, error });
            console.log('Speech recognition object:', window.SpeechRecognition || window.webkitSpeechRecognition);
          }}
          aria-label="Debug speech recognition"
        >
          🐛 Debug
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="transcript-container">
        <div className="transcript">
          <div className="transcript-label">Voice Command:</div>
          <div className="transcript-text">
            <span className="final-text">{finalTranscript}</span>
            <span className="interim-text">{interimTranscript}</span>
          </div>
          {confidence > 0 && (
            <div className="confidence">
              Confidence: {Math.round(confidence * 100)}%
            </div>
          )}
          {!transcript && isListening && (
            <div className="listening-indicator">
              🎤 Listening... Speak now!
            </div>
          )}
        </div>
      </div>

      {showNumbers && (
        <div className="numbers-overlay">
          <div className="numbers-indicator">
            🔢 Numbers overlay is active
          </div>
        </div>
      )}

      <div className="speech-status">
        <div className={`status-indicator ${isListening ? 'listening' : 'idle'}`}>
          <div className="status-dot"></div>
          <span>{isListening ? 'Listening for commands...' : 'Ready to listen'}</span>
        </div>
      </div>

      <div className="help-text">
        <p>Try saying:</p>
        <ul>
          <li>"Click the login button"</li>
          <li>"Type my email address"</li>
          <li>"Scroll down"</li>
          <li>"Show numbers"</li>
        </ul>
      </div>
    </div>
  );
};

export default SpeechRecognition;
