import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import SpeechRecognition from './components/SpeechRecognition'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [lastCommand, setLastCommand] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')

  const handleTranscript = (transcript: string) => {
    setLastTranscript(transcript)
  }

  const handleCommand = (command: string) => {
    setLastCommand(command)
    console.log('Voice command received:', command)
    
    // Here you would integrate with your AI agent
    // For now, we'll just log the command and show it in the UI
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
      </div>

      <div className="main-content">
        <div className="speech-section">
          <SpeechRecognition 
            onTranscript={handleTranscript}
            onCommand={handleCommand}
          />
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
        </div>
      </div>
    </>
  )
}

export default App
