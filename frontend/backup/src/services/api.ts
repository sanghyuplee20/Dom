// API service for backend integration with agentic workflow
import { BACKEND_CONFIG } from '../config/backend';

export interface SpeechCommand {
  transcript: string;
  confidence: number;
  timestamp: number;
  context?: any;
}

export interface CommandResult {
  success: boolean;
  action: string;
  message: string;
  data?: any;
  error?: string;
}

export interface AgenticResponse {
  command: string;
  intent: string;
  confidence: number;
  actions: string[];
  response: string;
  requiresConfirmation: boolean;
}

class ApiService {
  private baseUrl: string;
  private wsConnection: WebSocket | null = null;
  private wsListeners: Map<string, Function[]> = new Map();

  constructor(baseUrl: string = BACKEND_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  // Initialize WebSocket connection for real-time communication
  initializeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = BACKEND_CONFIG.wsUrl;
        this.wsConnection = new WebSocket(wsUrl);

        this.wsConnection.onopen = () => {
          console.log('🔌 Connected to agentic workflow backend');
          resolve();
        };

        this.wsConnection.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        this.wsConnection.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.wsConnection.onclose = () => {
          console.log('🔌 WebSocket connection closed');
          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            this.initializeWebSocket();
          }, 3000);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle incoming WebSocket messages
  private handleWebSocketMessage(data: any) {
    const { type, payload } = data;
    
    switch (type) {
      case 'speech_start':
        this.emit('speech_start', payload);
        break;
      case 'speech_result':
        this.emit('speech_result', payload);
        break;
      case 'command_processing':
        this.emit('command_processing', payload);
        break;
      case 'command_result':
        this.emit('command_result', payload);
        break;
      case 'agentic_response':
        this.emit('agentic_response', payload);
        break;
      case 'error':
        this.emit('error', payload);
        break;
      default:
        console.log('📨 Unknown WebSocket message type:', type);
    }
  }

  // Send speech command to backend
  async processSpeechCommand(command: SpeechCommand): Promise<AgenticResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/speech/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AgenticResponse = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Error processing speech command:', error);
      throw error;
    }
  }

  // Execute a voice command through the agentic workflow
  async executeCommand(command: string, context?: any): Promise<CommandResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/commands/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          context,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: CommandResult = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Error executing command:', error);
      throw error;
    }
  }

  // Get system status
  async getStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error getting status:', error);
      throw error;
    }
  }

  // Send real-time speech data via WebSocket
  sendSpeechData(data: any) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: 'speech_data',
        payload: data,
      }));
    }
  }

  // Event listener system for WebSocket messages
  on(event: string, callback: Function) {
    if (!this.wsListeners.has(event)) {
      this.wsListeners.set(event, []);
    }
    this.wsListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.wsListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.wsListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Close WebSocket connection
  close() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Types are already exported above, no need to re-export
