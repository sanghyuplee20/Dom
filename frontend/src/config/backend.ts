export const BACKEND_CONFIG = {
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-backend-domain.com' 
    : 'http://localhost:8000',
  wsUrl: process.env.NODE_ENV === 'production'
    ? 'wss://your-backend-domain.com/ws/speech'
    : 'ws://localhost:8000/ws/speech',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5
};
