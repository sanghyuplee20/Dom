// Custom hook for integrating speech recognition with agentic workflow
// This hook bridges your existing speech recognition with the backend agentic workflow

import { useState, useEffect, useCallback } from 'react';
import { apiService, SpeechCommand, AgenticResponse, CommandResult } from '../services/api';

export interface AgenticWorkflowState {
  isConnected: boolean;
  isProcessing: boolean;
  lastResponse: AgenticResponse | null;
  lastResult: CommandResult | null;
  error: string | null;
  status: 'idle' | 'listening' | 'processing' | 'executing' | 'completed' | 'error';
}

export interface AgenticWorkflowOptions {
  autoConnect?: boolean;
  enableRealTime?: boolean;
  onResponse?: (response: AgenticResponse) => void;
  onResult?: (result: CommandResult) => void;
  onError?: (error: string) => void;
}

export const useAgenticWorkflow = (options: AgenticWorkflowOptions = {}) => {
  const {
    autoConnect = true,
    enableRealTime = true,
    onResponse,
    onResult,
    onError
  } = options;

  const [state, setState] = useState<AgenticWorkflowState>({
    isConnected: false,
    isProcessing: false,
    lastResponse: null,
    lastResult: null,
    error: null,
    status: 'idle'
  });

  // Initialize connection
  useEffect(() => {
    if (autoConnect) {
      initializeConnection();
    }

    return () => {
      apiService.close();
    };
  }, [autoConnect]);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!enableRealTime) return;

    const handleSpeechStart = () => {
      setState(prev => ({ ...prev, status: 'listening' }));
    };

    const handleSpeechResult = (data: any) => {
      console.log('🎤 Speech result from backend:', data);
    };

    const handleCommandProcessing = (data: any) => {
      setState(prev => ({ 
        ...prev, 
        status: 'processing',
        isProcessing: true 
      }));
    };

    const handleCommandResult = (data: CommandResult) => {
      setState(prev => ({ 
        ...prev, 
        lastResult: data,
        status: 'completed',
        isProcessing: false 
      }));
      onResult?.(data);
    };

    const handleAgenticResponse = (data: AgenticResponse) => {
      setState(prev => ({ 
        ...prev, 
        lastResponse: data,
        status: 'executing'
      }));
      onResponse?.(data);
    };

    const handleError = (error: string) => {
      setState(prev => ({ 
        ...prev, 
        error,
        status: 'error',
        isProcessing: false 
      }));
      onError?.(error);
    };

    // Register event listeners
    apiService.on('speech_start', handleSpeechStart);
    apiService.on('speech_result', handleSpeechResult);
    apiService.on('command_processing', handleCommandProcessing);
    apiService.on('command_result', handleCommandResult);
    apiService.on('agentic_response', handleAgenticResponse);
    apiService.on('error', handleError);

    // Cleanup listeners
    return () => {
      apiService.off('speech_start', handleSpeechStart);
      apiService.off('speech_result', handleSpeechResult);
      apiService.off('command_processing', handleCommandProcessing);
      apiService.off('command_result', handleCommandResult);
      apiService.off('agentic_response', handleAgenticResponse);
      apiService.off('error', handleError);
    };
  }, [enableRealTime, onResponse, onResult, onError]);

  // Initialize WebSocket connection
  const initializeConnection = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, status: 'idle' }));
      await apiService.initializeWebSocket();
      setState(prev => ({ ...prev, isConnected: true }));
      console.log('✅ Connected to agentic workflow backend');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to backend';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        status: 'error' 
      }));
      console.error('❌ Failed to connect to backend:', error);
    }
  }, []);

  // Process speech command through agentic workflow
  const processSpeechCommand = useCallback(async (transcript: string, confidence: number = 1.0) => {
    if (!state.isConnected) {
      console.warn('⚠️ Not connected to backend, processing locally');
      return null;
    }

    try {
      setState(prev => ({ ...prev, status: 'processing', isProcessing: true }));

      const command: SpeechCommand = {
        transcript,
        confidence,
        timestamp: Date.now(),
        context: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent
        }
      };

      const response = await apiService.processSpeechCommand(command);
      setState(prev => ({ 
        ...prev, 
        lastResponse: response,
        status: 'executing'
      }));

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process speech command';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        status: 'error',
        isProcessing: false 
      }));
      console.error('❌ Error processing speech command:', error);
      return null;
    }
  }, [state.isConnected]);

  // Execute a command through the agentic workflow
  const executeCommand = useCallback(async (command: string, context?: any) => {
    if (!state.isConnected) {
      console.warn('⚠️ Not connected to backend, executing locally');
      return null;
    }

    try {
      setState(prev => ({ ...prev, status: 'executing', isProcessing: true }));

      const result = await apiService.executeCommand(command, context);
      setState(prev => ({ 
        ...prev, 
        lastResult: result,
        status: 'completed',
        isProcessing: false 
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute command';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        status: 'error',
        isProcessing: false 
      }));
      console.error('❌ Error executing command:', error);
      return null;
    }
  }, [state.isConnected]);

  // Send real-time speech data
  const sendSpeechData = useCallback((data: any) => {
    if (state.isConnected && enableRealTime) {
      apiService.sendSpeechData(data);
    }
  }, [state.isConnected, enableRealTime]);

  // Get system status
  const getStatus = useCallback(async () => {
    try {
      return await apiService.getStatus();
    } catch (error) {
      console.error('❌ Error getting status:', error);
      return null;
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isConnected: false,
      isProcessing: false,
      lastResponse: null,
      lastResult: null,
      error: null,
      status: 'idle'
    });
  }, []);

  // Reconnect to backend
  const reconnect = useCallback(() => {
    apiService.close();
    initializeConnection();
  }, [initializeConnection]);

  return {
    ...state,
    processSpeechCommand,
    executeCommand,
    sendSpeechData,
    getStatus,
    reset,
    reconnect,
    initializeConnection
  };
};
