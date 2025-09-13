// Background script for Accessly browser extension
// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('🎤 Accessly: Extension installed/updated');
    if (details.reason === 'install') {
        // First time installation
        console.log('🎤 Accessly: First time installation');
        // Set default settings
        chrome.storage.sync.set({
            voiceEnabled: true,
            showNumbers: false,
            language: 'en-US',
            continuousListening: true
        });
        // Open welcome page
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    }
    else if (details.reason === 'update') {
        console.log('🎤 Accessly: Extension updated');
    }
});
// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('🎤 Accessly: Tab updated:', tab.url);
        // Inject content script if needed
        if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            }).catch(error => {
                console.log('Content script already injected or failed:', error);
            });
        }
    }
});
// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🎤 Accessly: Background received message:', message);
    switch (message.type) {
        case 'GET_EXTENSION_INFO':
            sendResponse({
                version: chrome.runtime.getManifest().version,
                name: chrome.runtime.getManifest().name
            });
            break;
        case 'LOG_ACTIVITY':
            // Log user activity for analytics (privacy-friendly)
            console.log('🎤 Accessly: User activity:', message.activity);
            break;
        case 'REQUEST_PERMISSIONS':
            // Handle permission requests
            chrome.permissions.request({
                permissions: ['activeTab', 'scripting']
            }, (granted) => {
                sendResponse({ granted });
            });
            return true; // Keep message channel open for async response
        default:
            console.log('🎤 Accessly: Unknown message type:', message.type);
    }
});
// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    console.log('🎤 Accessly: Keyboard command:', command);
    switch (command) {
        case 'toggle-speech':
            // Toggle speech recognition on current tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SPEECH' });
                }
            });
            break;
        case 'show-numbers':
            // Show number overlay on current tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_NUMBERS' });
                }
            });
            break;
        case 'hide-numbers':
            // Hide number overlay on current tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'HIDE_NUMBERS' });
                }
            });
            break;
    }
});
// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    console.log('🎤 Accessly: Extension icon clicked');
    // Open popup (this is handled by manifest.json)
    // But we can also inject content script if needed
    if (tab.id && (tab.url?.startsWith('http://') || tab.url?.startsWith('https://'))) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }).catch(error => {
            console.log('Content script injection failed:', error);
        });
    }
});
// Handle context menu (right-click menu)
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'accessly-voice-command',
        title: '🎤 Start Voice Command',
        contexts: ['page']
    });
    chrome.contextMenus.create({
        id: 'accessly-show-numbers',
        title: '🔢 Show Number Overlay',
        contexts: ['page']
    });
    chrome.contextMenus.create({
        id: 'accessly-hide-numbers',
        title: '❌ Hide Number Overlay',
        contexts: ['page']
    });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id)
        return;
    switch (info.menuItemId) {
        case 'accessly-voice-command':
            chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SPEECH' });
            break;
        case 'accessly-show-numbers':
            chrome.tabs.sendMessage(tab.id, { type: 'SHOW_NUMBERS' });
            break;
        case 'accessly-hide-numbers':
            chrome.tabs.sendMessage(tab.id, { type: 'HIDE_NUMBERS' });
            break;
    }
});
// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('🎤 Accessly: Storage changed:', changes);
    // Notify content scripts of settings changes
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id && (tab.url?.startsWith('http://') || tab.url?.startsWith('https://'))) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SETTINGS_CHANGED',
                    changes
                }).catch(() => {
                    // Ignore errors for tabs without content script
                });
            }
        });
    });
});
// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('🎤 Accessly: Extension started');
});
// Handle extension suspend/resume
chrome.runtime.onSuspend.addListener(() => {
    console.log('🎤 Accessly: Extension suspended');
});
// Error handling
chrome.runtime.onSuspendCanceled.addListener(() => {
    console.log('🎤 Accessly: Extension suspend canceled');
});
// Keep service worker alive
chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
        console.log('🎤 Accessly: Port disconnected');
    });
});
