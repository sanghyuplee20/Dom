// Content script for Accessly browser extension
// This script runs on every web page and injects the speech recognition interface

import { createSpeechInterface } from './speechInterface';
import { detectInteractiveElements } from './elementDetection';
import { showNumberOverlay, hideNumberOverlay } from './numberOverlay';

// Initialize the extension when the page loads
function initializeExtension() {
  console.log('🎤 Accessly: Initializing voice-controlled accessibility...');
  
  // Create the speech interface
  const speechInterface = createSpeechInterface();
  
  // Detect interactive elements on the page
  const interactiveElements = detectInteractiveElements();
  console.log('🎯 Accessly: Found', interactiveElements.length, 'interactive elements');
  
  // Listen for messages from the popup/background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Accessly: Received message:', message);
    
    switch (message.type) {
      case 'TOGGLE_SPEECH':
        speechInterface.toggleListening();
        break;
        
      case 'SHOW_NUMBERS':
        showNumberOverlay(interactiveElements);
        break;
        
      case 'HIDE_NUMBERS':
        hideNumberOverlay();
        break;
        
      case 'EXECUTE_COMMAND':
        executeVoiceCommand(message.command, interactiveElements);
        break;
        
      case 'GET_PAGE_INFO':
        sendResponse({
          url: window.location.href,
          title: document.title,
          elementCount: interactiveElements.length
        });
        break;
    }
  });
  
  // Handle voice commands
  function executeVoiceCommand(command: string, elements: HTMLElement[]) {
    console.log('🎯 Accessly: Executing command:', command);
    
    const lowerCommand = command.toLowerCase().trim();
    
    // Handle special commands
    if (lowerCommand.includes('show numbers')) {
      showNumberOverlay(elements);
      return;
    }
    
    if (lowerCommand.includes('hide numbers')) {
      hideNumberOverlay();
      return;
    }
    
    // Handle click commands
    if (lowerCommand.includes('click')) {
      const targetText = extractTargetText(lowerCommand, 'click');
      const element = findElementByText(elements, targetText);
      if (element) {
        element.click();
        console.log('✅ Accessly: Clicked element:', element);
      } else {
        console.log('❌ Accessly: Could not find element to click:', targetText);
      }
      return;
    }
    
    // Handle type commands
    if (lowerCommand.includes('type')) {
      const targetText = extractTargetText(lowerCommand, 'type');
      const inputElement = findInputElement(elements);
      if (inputElement) {
        inputElement.focus();
        inputElement.value = targetText;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('✅ Accessly: Typed text:', targetText);
      } else {
        console.log('❌ Accessly: Could not find input element to type into');
      }
      return;
    }
    
    // Handle scroll commands
    if (lowerCommand.includes('scroll')) {
      if (lowerCommand.includes('down')) {
        window.scrollBy(0, 300);
        console.log('✅ Accessly: Scrolled down');
      } else if (lowerCommand.includes('up')) {
        window.scrollBy(0, -300);
        console.log('✅ Accessly: Scrolled up');
      }
      return;
    }
    
    console.log('❓ Accessly: Unknown command:', command);
  }
  
  // Helper functions
  function extractTargetText(command: string, action: string): string {
    const actionIndex = command.indexOf(action);
    if (actionIndex === -1) return '';
    
    const afterAction = command.substring(actionIndex + action.length).trim();
    // Remove common words like "the", "a", "an"
    return afterAction.replace(/\b(the|a|an|button|link|field)\b/g, '').trim();
  }
  
  function findElementByText(elements: HTMLElement[], text: string): HTMLElement | null {
    const searchText = text.toLowerCase();
    
    for (const element of elements) {
      const elementText = element.textContent?.toLowerCase() || '';
      const elementTitle = element.getAttribute('title')?.toLowerCase() || '';
      const elementAriaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
      
      if (elementText.includes(searchText) || 
          elementTitle.includes(searchText) || 
          elementAriaLabel.includes(searchText)) {
        return element;
      }
    }
    
    return null;
  }
  
  function findInputElement(elements: HTMLElement[]): HTMLInputElement | HTMLTextAreaElement | null {
    for (const element of elements) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        return element as HTMLInputElement | HTMLTextAreaElement;
      }
    }
    return null;
  }
}

// Wait for the page to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Re-initialize when new content is loaded (for SPAs)
const observer = new MutationObserver((mutations) => {
  let shouldReinitialize = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      shouldReinitialize = true;
    }
  });
  
  if (shouldReinitialize) {
    // Debounce re-initialization
    setTimeout(() => {
      initializeExtension();
    }, 1000);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
