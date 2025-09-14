# Dom - Voice-Controlled Web Accessibility Assistant

A powerful Chrome extension that enables voice-controlled web navigation and accessibility features, powered by AI and designed to make web browsing more accessible for everyone.

## 🌟 Features

### Voice Commands
- **Natural Language Processing**: Speak commands in natural language
- **Continuous Listening**: Always-on voice recognition with wake word activation
- **Real-time Transcription**: See your commands transcribed in real-time
- **Smart Command Classification**: AI-powered command understanding and routing

### Web Navigation
- **Click Elements**: "Click the login button", "Click on the search box"
- **Type Text**: "Type hello world", "Fill the form with my email"
- **Scroll Pages**: "Scroll down", "Scroll up", "Scroll to the bottom"
- **Navigate**: "Go to youtube.com", "Open google.com"
- **Search**: "Search for accessibility tools"

### Accessibility Features
- **Number Overlay**: "Show numbers" to display numbered overlays on clickable elements
- **Element Highlighting**: Visual indicators for interactive elements
- **Smart Element Detection**: Advanced DOM analysis for better targeting
- **Fallback Handling**: Graceful degradation when AI services are unavailable

### Advanced Capabilities
- **Multi-step Actions**: Complex command sequences
- **Context Awareness**: Understands page content and structure
- **Error Recovery**: Automatic retry mechanisms for failed commands
- **Cross-site Compatibility**: Works on any website

## 🏗️ Architecture

### Frontend (Chrome Extension)
- **Manifest V3**: Modern Chrome extension architecture
- **Content Scripts**: DOM manipulation and voice recognition
- **Background Service Worker**: Extension lifecycle management
- **Popup Interface**: User controls and status display

### Backend (AI Processing)
- **FastAPI**: High-performance Python web framework
- **Google Gemini AI**: Advanced language understanding
- **LangChain**: AI workflow orchestration
- **Action Validation**: Ensures commands are safe and executable

## 🚀 Quick Start

### Prerequisites
- Chrome browser (version 88+)
- Python 3.8+
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/accessly-integrated.git
   cd accessly-integrated
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

4. **Start the backend server**
   ```bash
   python main.py
   ```
   The server will start at `http://localhost:8000`

5. **Install the Chrome extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `frontend` folder

6. **Grant permissions**
   - Allow microphone access when prompted
   - The extension will automatically start listening

## 🎯 Usage

### Basic Voice Commands

| Command | Action |
|---------|--------|
| "Hey Dom, show numbers" | Display numbered overlays on clickable elements |
| "Hey Dom, click 5" | Click on element number 5 |
| "Hey Dom, scroll down" | Scroll down the page |
| "Hey Dom, type hello world" | Type text into focused input |
| "Hey Dom, go to google.com" | Navigate to a website |
| "Hey Dom, search for accessibility" | Perform a search |

### Advanced Commands

| Command | Action |
|---------|--------|
| "Hey Dom, fill the form with my name" | Fill form fields intelligently |
| "Hey Dom, click the submit button" | Find and click submit buttons |
| "Hey Dom, scroll to the bottom" | Navigate to page bottom |
| "Hey Dom, hide numbers" | Remove number overlays |

### Wake Word
- Start commands with "Hey Dom" for activation
- The extension listens continuously in the background
- Visual indicator shows when listening
