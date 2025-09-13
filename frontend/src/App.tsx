import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import SpeechRecognition from './components/SpeechRecognition'
import { useAgenticWorkflow } from './hooks/useAgenticWorkflow'
import type { AgenticResponse, CommandResult } from './services/api'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [lastCommand, setLastCommand] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  const [agenticResponse, setAgenticResponse] = useState<AgenticResponse | null>(null)
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null)

  // Initialize agentic workflow integration
  const {
    isConnected,
    isProcessing,
    error: workflowError,
    processSpeechCommand,
    executeCommand,
    reconnect
  } = useAgenticWorkflow({
    autoConnect: true,
    enableRealTime: true,
    onResponse: (response) => {
      setAgenticResponse(response);
      console.log('🤖 Agentic workflow response:', response);
    },
    onResult: (result) => {
      setCommandResult(result);
      console.log('✅ Command execution result:', result);
    },
    onError: (error) => {
      console.error('❌ Agentic workflow error:', error);
    }
  });

  const handleTranscript = (transcript: string) => {
    setLastTranscript(transcript)
  }

  const handleCommand = async (command: string) => {
    setLastCommand(command)
    console.log('🎤 Voice command received:', command)
    
    // Process through agentic workflow
    if (isConnected) {
      try {
        const response = await processSpeechCommand(command, 1.0);
        if (response) {
          console.log('🤖 Agentic workflow processing:', response);
          
          // If the response requires execution, execute it
          if (response.actions && response.actions.length > 0) {
            const result = await executeCommand(command, {
              actions: response.actions,
              intent: response.intent,
              confidence: response.confidence
            });
            
            if (result) {
              console.log('✅ Command executed:', result);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error processing command through agentic workflow:', error);
      }
    } else {
      // Fallback to local processing if backend is not connected
      console.log('⚠️ Backend not connected, using local processing');
      handleLocalCommand(command);
    }
  }

  // Fallback local command processing (your existing logic)
  const handleLocalCommand = (command: string) => {
    const lowerCommand = command.toLowerCase().trim();
    
    // Handle special commands
    if (lowerCommand.includes('show numbers')) {
      console.log('🔢 Showing numbers overlay');
      return;
    }
    
    if (lowerCommand.includes('hide numbers')) {
      console.log('🔢 Hiding numbers overlay');
      return;
    }
    
    // Handle click commands
    if (lowerCommand.includes('click')) {
      const targetText = extractTargetText(lowerCommand, 'click');
      console.log('🖱️ Local click command:', targetText);
      return;
    }
    
    // Handle type commands
    if (lowerCommand.includes('type')) {
      const targetText = extractTargetText(lowerCommand, 'type');
      console.log('⌨️ Local type command:', targetText);
      return;
    }
    
    // Handle scroll commands
    if (lowerCommand.includes('scroll')) {
      if (lowerCommand.includes('down')) {
        window.scrollBy(0, 300);
        console.log('⬇️ Scrolled down');
      } else if (lowerCommand.includes('up')) {
        window.scrollBy(0, -300);
        console.log('⬆️ Scrolled up');
      }
      return;
    }
    
    console.log('❓ Unknown local command:', command);
  }

  // Helper function for local command processing
  const extractTargetText = (command: string, action: string): string => {
    const actionIndex = command.indexOf(action);
    if (actionIndex === -1) return '';
    
    const afterAction = command.substring(actionIndex + action.length).trim();
    return afterAction.replace(/\b(the|a|an|button|link|field)\b/g, '').trim();
  }

  // Handle reconnection
  const handleReconnect = () => {
    reconnect();
  }

  return (
    <>
      <div className="header">
        <div className="logos">
          <a href="https://vite.dev" target="_blank">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>
        <h1>Accessly - Voice-Controlled Web Accessibility</h1>
        <p className="subtitle">Speak naturally to control web pages with AI assistance</p>
        
        {/* Backend Connection Status */}
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot"></div>
            <span>
              {isConnected ? '🤖 Agentic Workflow Connected' : '⚠️ Backend Disconnected'}
            </span>
          </div>
          {!isConnected && (
            <button onClick={handleReconnect} className="reconnect-button">
              🔄 Reconnect
            </button>
          )}
        </div>
      </div>

      <div className="main-content">
        <div className="speech-section">
          <SpeechRecognition 
            onTranscript={handleTranscript}
            onCommand={handleCommand}
          />
          
          {/* Agentic Workflow Status */}
          {isProcessing && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <span>🤖 Agentic workflow processing...</span>
            </div>
          )}
          
          {workflowError && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {workflowError}
            </div>
          )}
        </div>

        <div className="demo-section">
          <h2>Demo Interactive Elements</h2>
          <div className="card">
            <button onClick={() => setCount((count) => count + 1)}>
              count is {count}
            </button>
            <p>
              Try saying: <strong>"Click the count button"</strong>
            </p>
          </div>
          
          <div className="card">
            <input 
              type="text" 
              placeholder="Try saying: 'Type hello world'"
              style={{ padding: '8px', marginRight: '8px', minWidth: '200px' }}
            />
            <button>Submit</button>
          </div>

          <div className="card">
            <textarea 
              placeholder="Try saying: 'Type a long message here'"
              rows={3}
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            />
          </div>
        </div>

        <div className="status-section">
          <h3>Voice Command Status</h3>
          <div className="status-cards">
            <div className="status-card">
              <h4>Last Command</h4>
              <p>{lastCommand || 'No command yet'}</p>
            </div>
            <div className="status-card">
              <h4>Last Transcript</h4>
              <p>{lastTranscript || 'No speech detected yet'}</p>
            </div>
          </div>
          
          {/* Agentic Workflow Response */}
          {agenticResponse && (
            <div className="agentic-response">
              <h4>🤖 Agentic Workflow Response</h4>
              <div className="response-content">
                <p><strong>Intent:</strong> {agenticResponse.intent}</p>
                <p><strong>Confidence:</strong> {Math.round(agenticResponse.confidence * 100)}%</p>
                <p><strong>Response:</strong> {agenticResponse.response}</p>
                {agenticResponse.actions && agenticResponse.actions.length > 0 && (
                  <p><strong>Actions:</strong> {agenticResponse.actions.join(', ')}</p>
                )}
                {agenticResponse.requiresConfirmation && (
                  <p className="confirmation-required">⚠️ Requires confirmation</p>
                )}
              </div>
            </div>
          )}
          
          {/* Command Execution Result */}
          {commandResult && (
            <div className="command-result">
              <h4>✅ Command Result</h4>
              <div className="result-content">
                <p><strong>Success:</strong> {commandResult.success ? 'Yes' : 'No'}</p>
                <p><strong>Action:</strong> {commandResult.action}</p>
                <p><strong>Message:</strong> {commandResult.message}</p>
                {commandResult.error && (
                  <p className="error-text"><strong>Error:</strong> {commandResult.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
