// background.js - Extension background script

class VoiceForwardBackground {
    constructor() {
        this.setupEventListeners();
        console.log('VoiceForward background script loaded');
    }
    
    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('VoiceForward extension installed:', details);
        });
        
        // Handle messages between popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Log messages for debugging
            console.log('Background received message:', message);
            return false; // Allow other handlers to process
        });
        
        // Handle tab updates (optional: could inject content script dynamically)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                // Page loaded - content script should already be injected via manifest
                console.log('Page loaded:', tab.url);
            }
        });
    }
}

// Initialize background script
new VoiceForwardBackground();