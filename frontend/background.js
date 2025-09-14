// background.js - Extension background script

class VoiceForwardBackground {
    constructor() {
        this.isRecordingActive = false;
        this.isActivated = false; // Track if "Hey Dom" has been said
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
            console.log('Background received message:', message);

            switch (message.type) {
                case 'setRecordingState':
                    this.isRecordingActive = message.isRecording;
                    console.log('Recording state updated:', this.isRecordingActive);
                    this.updateBadge();
                    sendResponse({ success: true });
                    break;

                case 'getRecordingState':
                    sendResponse({
                        isRecording: this.isRecordingActive,
                        isActivated: this.isActivated
                    });
                    break;

                case 'setActivationState':
                    this.isActivated = message.isActivated;
                    console.log('Activation state updated:', this.isActivated);
                    // When activated, also mark as recording active
                    if (this.isActivated) {
                        this.isRecordingActive = true;
                    }
                    this.updateBadge();
                    sendResponse({ success: true });
                    break;

                case 'stopRecordingCommand':
                    // Voice command to stop recording
                    this.isRecordingActive = false;
                    this.isActivated = false; // Also deactivate
                    this.updateBadge();
                    // Notify all tabs to stop recording
                    this.notifyAllTabs({ type: 'stopRecordingFromVoice' });
                    sendResponse({ success: true });
                    break;

                case 'switchTab':
                    this.switchTab(message.direction);
                    sendResponse({ success: true });
                    break;

                case 'createNewTab':
                    this.createNewTab(message.url);
                    sendResponse({ success: true });
                    break;

                case 'closeCurrentTab':
                    this.closeCurrentTab(sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                default:
                    // Forward other messages (for popup <-> content script communication)
                    return false; // Allow other handlers to process
            }
            return true; // Keep message channel open for async response
        });
        
        // Handle tab updates - restart recording on new pages if it was active
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && this.isRecordingActive) {
                // Page loaded and recording is active - restart recording
                console.log('Page loaded, restarting recording:', tab.url);
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'restartVoiceRecording'
                    }).catch(error => {
                        console.log('Could not restart recording on new page:', error);
                    });
                }, 1000); // Wait 1 second for content script to load
            }
        });
    }

    async notifyAllTabs(message) {
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // Ignore errors for tabs without content scripts
                });
            }
        } catch (error) {
            console.error('Error notifying tabs:', error);
        }
    }

    updateBadge() {
        if (this.isActivated) {
            chrome.action.setBadgeText({ text: '🔴' });
            chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
            chrome.action.setTitle({ title: 'VoiceForward - Activated (REC)' });
        } else if (this.isRecordingActive) {
            chrome.action.setBadgeText({ text: '🟡' });
            chrome.action.setBadgeBackgroundColor({ color: '#ffaa00' });
            chrome.action.setTitle({ title: 'VoiceForward - Ready (say "Hey Dom")' });
        } else {
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setTitle({ title: 'VoiceForward Test' });
        }
    }

    async switchTab(direction) {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            if (tabs.length <= 1) {
                console.log('Only one tab open, cannot switch');
                return;
            }

            const activeTab = tabs.find(tab => tab.active);
            if (!activeTab) return;

            const currentIndex = tabs.indexOf(activeTab);
            let targetIndex;

            if (direction === 'next' || direction === 'right') {
                targetIndex = (currentIndex + 1) % tabs.length;
            } else if (direction === 'previous' || direction === 'prev' || direction === 'left') {
                targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            } else {
                console.warn('Invalid tab switch direction:', direction);
                return;
            }

            const targetTab = tabs[targetIndex];
            await chrome.tabs.update(targetTab.id, { active: true });
            console.log(`Switched from tab ${currentIndex} to tab ${targetIndex}`);
        } catch (error) {
            console.error('Failed to switch tab:', error);
        }
    }

    async createNewTab(url = null) {
        try {
            const newTabOptions = { active: true };
            if (url) {
                newTabOptions.url = url;
            }

            const newTab = await chrome.tabs.create(newTabOptions);
            console.log('Created new tab:', newTab.id, url ? `with URL: ${url}` : '');
        } catch (error) {
            console.error('Failed to create new tab:', error);
        }
    }

    async closeCurrentTab(tabId = null) {
        try {
            if (tabId) {
                await chrome.tabs.remove(tabId);
                console.log('Closed tab:', tabId);
            } else {
                // Get current active tab if no specific tab ID provided
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTab) {
                    await chrome.tabs.remove(activeTab.id);
                    console.log('Closed current active tab:', activeTab.id);
                }
            }
        } catch (error) {
            console.error('Failed to close tab:', error);
        }
    }
}

// Initialize background script
new VoiceForwardBackground();