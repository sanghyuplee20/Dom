// popup.js - Extension popup logic

class VoiceForwardPopup {
    constructor() {
        this.backendUrl = 'http://localhost:8000';
        this.isProcessing = false;
        this.isRecording = false;

        this.initializeElements();
        this.setupEventListeners();
        this.setupMessageListener();
        this.checkBackendStatus();
        this.syncWithBackgroundState();
    }
    
    initializeElements() {
        this.statusEl = document.getElementById('status');
        this.commandInput = document.getElementById('commandInput');
        this.sendButton = document.getElementById('sendCommand');
        this.clearButton = document.getElementById('clearResults');
        this.resultsEl = document.getElementById('results');
        this.resultsContent = document.getElementById('resultsContent');
        this.loadingEl = document.getElementById('loading');

        // Voice elements
        this.recordBtn = document.getElementById('recordBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.voiceStatusText = document.getElementById('voiceStatusText');
        this.transcriptionPreview = document.getElementById('transcriptionPreview');
        this.voiceError = document.getElementById('voiceError');
    }
    
    setupEventListeners() {
        // Send command button
        this.sendButton.addEventListener('click', () => this.sendCommand());
        
        // Enter key in input
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                this.sendCommand();
            }
        });
        
        // Clear results button
        this.clearButton.addEventListener('click', () => this.clearResults());
        
        // Voice command buttons
        this.recordBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());

        // Quick command buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.target.dataset.command;
                this.commandInput.value = command;
                this.sendCommand();
            });
        });
    }
    
    async checkBackendStatus() {
        try {
            const response = await fetch(`${this.backendUrl}/health`);
            if (response.ok) {
                this.updateStatus(true, 'Backend connected');
            } else {
                this.updateStatus(false, 'Backend error');
            }
        } catch (error) {
            this.updateStatus(false, 'Backend offline');
        }
    }
    
    updateStatus(connected, message) {
        this.statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
        this.statusEl.querySelector('span').textContent = message;
    }
    
    async sendCommand() {
        const command = this.commandInput.value.trim();
        if (!command || this.isProcessing) return;
        
        this.isProcessing = true;
        this.showLoading(true);
        this.sendButton.disabled = true;
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Send message to content script to get DOM context
            const domContext = await chrome.tabs.sendMessage(tab.id, {
                action: 'getDOMContext'
            });
            
            if (!domContext) {
                throw new Error('Could not get page context. Make sure the page is loaded.');
            }
            
            // Prepare request for backend
            const requestData = {
                query: command,
                page_context: domContext
            };
            
            // Send to backend
            const response = await fetch(`${this.backendUrl}/process-command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Send result to content script for execution
            await chrome.tabs.sendMessage(tab.id, {
                action: 'executeResult',
                data: result
            });
            
            // Display result in popup
            this.displayResult(command, result);

            // Clear the command input and transcription preview to prevent overlap
            this.commandInput.value = '';
            this.showTranscriptionPreview('');

        } catch (error) {
            console.error('Command processing error:', error);
            this.displayError(command, error.message);
        } finally {
            this.isProcessing = false;
            this.showLoading(false);
            this.sendButton.disabled = false;
        }
    }
    
    displayResult(command, result) {
        this.showResults(true);
        
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.command_type === 'show_numbers' ? 'number' : 'action'}`;
        
        let content = `<strong>Command:</strong> "${command}"<br>`;
        content += `<strong>Type:</strong> ${result.command_type}<br>`;
        
        if (result.command_type === 'show_numbers') {
            content += `<strong>Elements:</strong> ${result.total_elements} interactive elements found<br>`;
            content += `<strong>Action:</strong> Numbers displayed on page`;
        } else if (result.command_type === 'action_sequence') {
            content += `<strong>Actions:</strong> ${result.total_actions} steps planned<br>`;
            content += `<strong>Confidence:</strong> ${Math.round(result.confidence_score * 100)}%<br>`;
            
            if (result.actions && result.actions.length > 0) {
                content += `<strong>Steps:</strong><br>`;
                result.actions.forEach((action, index) => {
                    content += `${index + 1}. ${action.action}`;
                    if (action.direction) content += ` ${action.direction}`;
                    if (action.target) content += ` → ${action.target}`;
                    if (action.text) content += ` (text: "${action.text}")`;
                    if (action.amount) content += ` (${action.amount}px)`;
                    content += `<br>`;
                });
            }
            
            if (result.fallback_used) {
                content += `<br><em>⚠️ Fallback mode used</em>`;
            }
        }
        
        resultItem.innerHTML = content;
        this.resultsContent.appendChild(resultItem);
        
        // Scroll to bottom
        this.resultsContent.scrollTop = this.resultsContent.scrollHeight;
    }
    
    displayError(command, error) {
        this.showResults(true);
        
        const errorItem = document.createElement('div');
        errorItem.className = 'result-item error';
        errorItem.innerHTML = `
            <strong>Command:</strong> "${command}"<br>
            <strong>Error:</strong> ${error}<br>
            <em>Check that the backend is running on ${this.backendUrl}</em>
        `;
        
        this.resultsContent.appendChild(errorItem);
        this.resultsContent.scrollTop = this.resultsContent.scrollHeight;
    }
    
    showLoading(show) {
        this.loadingEl.classList.toggle('hidden', !show);
    }
    
    showResults(show) {
        this.resultsEl.classList.toggle('hidden', !show);
    }
    
    clearResults() {
        this.resultsContent.innerHTML = '';
        this.showResults(false);
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'voiceStatusChanged':
                    this.handleVoiceStatusChanged(message.status);
                    break;
                case 'transcriptionUpdate':
                    this.showTranscriptionPreview(message.text);
                    break;
                case 'transcriptionComplete':
                    this.handleTranscriptionComplete(message.text);
                    break;
                case 'voiceError':
                    this.showVoiceError(message.error);
                    this.isRecording = false;
                    this.updateRecordingUI(false);
                    break;
                case 'processCommand':
                    // This is now handled directly by content script
                    console.log('processCommand message received but handled by content script');
                    break;
                case 'recordingStopped':
                    this.handleRecordingStopped(message.text);
                    break;
                case 'commandExecuted':
                    this.displayResult(message.command, message.result);
                    // Clear the command input and transcription preview
                    this.commandInput.value = '';
                    this.showTranscriptionPreview('');
                    break;
            }
        });

        // Show ready status initially
        this.showVoiceStatus('Click "Start Recording" to begin voice input', 'ready');
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            this.hideVoiceError();
            this.showVoiceStatus('Starting recording...', 'processing');

            // Get current tab and send message to content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                await chrome.tabs.sendMessage(tab.id, { action: 'startVoiceRecording' });
                this.isRecording = true;
                this.updateRecordingUI(true);

                // Update background state for persistence
                chrome.runtime.sendMessage({
                    type: 'setRecordingState',
                    isRecording: true
                });
            } else {
                throw new Error('No active tab found');
            }
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showVoiceError('Failed to start recording. Make sure the page is loaded.');
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    async stopRecording() {
        if (!this.isRecording) return;

        try {
            // Get current tab and send message to content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopVoiceRecording' });
            }

            this.isRecording = false;
            this.updateRecordingUI(false);
            this.showVoiceStatus('Recording stopped', 'ready');

            // Update background state
            chrome.runtime.sendMessage({
                type: 'setRecordingState',
                isRecording: false
            });
        } catch (error) {
            console.error('Failed to stop recording:', error);
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    handleVoiceStatusChanged(status) {
        switch (status) {
            case 'listening':
                this.showVoiceStatus('Listening... Speak now!', 'listening');
                break;
            case 'ready':
                this.showVoiceStatus('Ready to listen...', 'ready');
                this.isRecording = false;
                this.updateRecordingUI(false);
                break;
        }
    }

    handleTranscriptionComplete(text) {
        console.log('Transcription complete:', text);
        this.commandInput.value = text;

        // Auto-send command after a brief delay
        setTimeout(() => {
            if (this.commandInput.value.trim()) {
                this.sendCommand();
            }
        }, 500);
    }

    async processBackendCommand(data) {
        try {
            // Send to backend
            const response = await fetch(`${this.backendUrl}/process-command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }

            const result = await response.json();

            // Send result back to content script for execution
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'executeResult',
                    data: result
                });
            }

            // Display result in popup
            this.displayResult(data.query, result);

            // Clear the command input and transcription preview to prevent overlap
            this.commandInput.value = '';
            this.showTranscriptionPreview('');

        } catch (error) {
            console.error('Backend processing error:', error);
            this.showVoiceError(`Failed to process command: ${error.message}`);
        }
    }

    updateRecordingUI(recording) {
        this.recordBtn.disabled = recording;
        this.stopBtn.disabled = !recording;

        if (recording) {
            this.recordBtn.textContent = '🔴 Recording...';
            this.recordBtn.classList.add('recording');
        } else {
            this.recordBtn.textContent = '🔴 Start Recording';
            this.recordBtn.classList.remove('recording');
        }
    }

    showVoiceStatus(message, state = 'ready') {
        this.voiceStatus.classList.remove('hidden');
        this.voiceStatusText.textContent = message;

        // Update indicator
        this.voiceIndicator.className = `voice-indicator ${state}`;
    }

    showTranscriptionPreview(text) {
        if (text.trim()) {
            this.transcriptionPreview.textContent = text;
            this.transcriptionPreview.classList.remove('hidden');
        } else {
            this.transcriptionPreview.classList.add('hidden');
        }
    }

    showVoiceError(message) {
        this.voiceError.textContent = message;
        this.voiceError.classList.remove('hidden');
    }

    hideVoiceError() {
        this.voiceError.classList.add('hidden');
    }

    async syncWithBackgroundState() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'getRecordingState' });
            if (response && response.isRecording) {
                this.isRecording = true;
                this.updateRecordingUI(true);
                this.showVoiceStatus('Syncing with persistent recording...', 'processing');

                // Actually start recording on current tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.id) {
                    await chrome.tabs.sendMessage(tab.id, { action: 'startVoiceRecording' });
                    this.showVoiceStatus('Recording active (persistent)', 'listening');
                } else {
                    this.showVoiceStatus('Recording active (waiting for page)', 'processing');
                }
            }
        } catch (error) {
            console.log('Could not sync with background state:', error);
        }
    }

    handleRecordingStopped(message) {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.showVoiceStatus(message || 'Recording stopped', 'ready');
        this.showTranscriptionPreview('');
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new VoiceForwardPopup();
});