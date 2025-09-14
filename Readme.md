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

## 🔧 Configuration

### Backend Configuration
Edit `backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
LOG_LEVEL=INFO
CORS_ORIGINS=*
```

### Extension Configuration
Modify `frontend/manifest.json` for custom settings:
- Change extension name and description
- Adjust permissions as needed
- Update host permissions for different backend URLs

## 🛠️ Development

### Project Structure
```
accessly-integrated/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application
│   ├── models.py           # Pydantic models
│   ├── gemini_agent.py     # AI agent logic
│   ├── action_validator.py # Action validation
│   └── requirements.txt    # Python dependencies
├── frontend/               # Chrome extension
│   ├── manifest.json       # Extension manifest
│   ├── content.js          # Content script
│   ├── popup.html          # Popup interface
│   ├── popup.js            # Popup logic
│   ├── background.js       # Service worker
│   └── content.css         # Styling
└── README.md
```

### Running in Development

1. **Backend Development**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Extension Development**
   - Make changes to files in `frontend/`
   - Reload extension in `chrome://extensions/`
   - Check console for debugging

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/process-command` | POST | Process voice commands |
| `/process-batch` | POST | Process multiple commands |
| `/validate-command` | POST | Validate command syntax |

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/
```

### Extension Testing
1. Load extension in Chrome
2. Test voice commands on various websites
3. Check console for errors
4. Verify action execution

## 🐛 Troubleshooting

### Common Issues

**Voice recognition not working**
- Check microphone permissions
- Ensure backend is running
- Check console for errors

**Commands not executing**
- Verify backend connection
- Check network connectivity
- Review action validation logs

**Extension not loading**
- Check manifest.json syntax
- Verify file paths
- Check Chrome developer console

### Debug Mode
Enable debug logging by setting `LOG_LEVEL=DEBUG` in backend `.env`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for natural language processing
- LangChain for AI workflow orchestration
- FastAPI for the robust backend framework
- Chrome Extensions API for browser integration

## 📞 Support

For support, email support@dom-accessibility.com or create an issue on GitHub.

---

**Made with ❤️ for web accessibility**
