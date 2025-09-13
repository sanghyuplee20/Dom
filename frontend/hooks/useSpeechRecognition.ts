import { useState, useEffect, useRef, useCallback } from 'react';

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  confidence: number;
}

export interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  maxAlternatives?: number;
}

export const useSpeechRecognition = (options: SpeechRecognitionOptions = {}) => {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
    maxAlternatives = 1
  } = options;

  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    finalTranscript: '',
    error: null,
    confidence: 0
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  // Check if Speech Recognition is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: true }));
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;
      recognition.maxAlternatives = maxAlternatives;

      // Handle speech recognition results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        console.log('Speech recognition result:', event);
        let interimTranscript = '';
        let finalTranscript = '';
        let confidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          confidence = result[0].confidence;

          console.log(`Result ${i}:`, { transcript, isFinal: result.isFinal, confidence });

          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        console.log('Processed transcripts:', { interimTranscript, finalTranscript });

        setState(prev => ({
          ...prev,
          transcript: finalTranscript + interimTranscript,
          interimTranscript,
          finalTranscript: prev.finalTranscript + finalTranscript,
          confidence
        }));
      };

      // Handle speech recognition start
      recognition.onstart = () => {
        console.log('Speech recognition started - microphone is active');
        setState(prev => ({ ...prev, isListening: true, error: null }));
        isListeningRef.current = true;
      };

      // Handle speech recognition end
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setState(prev => ({ ...prev, isListening: false }));
        isListeningRef.current = false;
      };

      // Handle speech recognition errors
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        let errorMessage = 'Speech recognition error occurred';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech was detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone was found. Please ensure a microphone is connected.';
            break;
          case 'not-allowed':
            errorMessage = 'Permission to use microphone is denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error occurred during speech recognition.';
            break;
          case 'aborted':
            errorMessage = 'Speech recognition was aborted.';
            break;
          case 'language-not-supported':
            errorMessage = 'The selected language is not supported.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }

        setState(prev => ({
          ...prev,
          isListening: false,
          error: errorMessage
        }));
        isListeningRef.current = false;
      };

      // Handle speech recognition sound start/end
      recognition.onsoundstart = () => {
        console.log('🔊 Sound detected - microphone is picking up audio');
      };

      recognition.onsoundend = () => {
        console.log('🔇 Sound ended - no more audio detected');
      };

      recognition.onspeechstart = () => {
        console.log('🗣️ Speech started - speech detected in audio');
      };

      recognition.onspeechend = () => {
        console.log('🤐 Speech ended - no more speech detected');
      };
    } else {
      setState(prev => ({
        ...prev,
        isSupported: false,
        error: 'Speech recognition is not supported in this browser'
      }));
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [continuous, interimResults, lang, maxAlternatives]);

  const startListening = useCallback(async () => {
    console.log('Starting speech recognition...', { 
      hasRecognition: !!recognitionRef.current, 
      isListening: isListeningRef.current 
    });
    
    // Check microphone permissions
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');
      stream.getTracks().forEach(track => track.stop()); // Stop the test stream
    } catch (error) {
      console.error('❌ Microphone access denied or not available:', error);
      setState(prev => ({
        ...prev,
        error: 'Microphone access is required for speech recognition'
      }));
      return;
    }
    
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
        console.log('Speech recognition started successfully');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to start speech recognition'
        }));
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      finalTranscript: '',
      error: null,
      confidence: 0
    }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    reset
  };
};

// Types are now defined in src/types/speech-recognition.d.ts
