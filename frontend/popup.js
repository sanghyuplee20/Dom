// popup.js - Extension popup logic

class VoiceForwardPopup {
    constructor() {
        this.backendUrl = 'http://localhost:8000';
        this.isProcessing = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkBackendStatus();
    }
    
    initializeElements() {
        this.statusEl = document.getElementById('status');
        this.commandInput = document.getElementById('commandInput');
        this.sendButton = document.getElementById('sendCommand');
        this.clearButton = document.getElementById('clearResults');
        this.resultsEl = document.getElementById('results');
        this.resultsContent = document.getElementById('resultsContent');
        this.loadingEl = document.getElementById('loading');
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
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new VoiceForwardPopup();
});