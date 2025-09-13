// Background script for Accessly browser extension

console.log('🎤 Accessly: Background script loaded');

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
  }
});


// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🎤 Accessly: Background received message:', message.type);
  
  switch (message.type) {
    case 'GET_EXTENSION_INFO':
      sendResponse({
        version: chrome.runtime.getManifest().version,
        name: chrome.runtime.getManifest().name
      });
      break;
      
    case 'LOG_ACTIVITY':
      console.log('🎤 Accessly: User activity:', message.activity);
      break;
      
    default:
      console.log('🎤 Accessly: Unknown message type:', message.type);
  }
});


// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('🎤 Accessly: Extension icon clicked');
  
  // Inject content script if needed
  if (tab.id && (tab.url?.startsWith('http://') || tab.url?.startsWith('https://'))) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(error => {
      console.log('Content script injection failed:', error);
    });
  }
});
