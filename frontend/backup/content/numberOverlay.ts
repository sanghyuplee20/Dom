// Number overlay for showing numbers on interactive elements

let numberOverlay: HTMLElement | null = null;
let numberedElements: HTMLElement[] = [];

export function showNumberOverlay(elements: HTMLElement[]) {
  // Remove existing overlay
  hideNumberOverlay();
  
  numberedElements = elements.slice(0, 9); // Limit to 9 elements for single digits
  
  // Create overlay container
  numberOverlay = document.createElement('div');
  numberOverlay.id = 'accessly-number-overlay';
  numberOverlay.innerHTML = `
    <div class="accessly-overlay-header">
      <span class="accessly-overlay-title">🔢 Voice Commands Available</span>
      <button class="accessly-overlay-close" aria-label="Close numbers">×</button>
    </div>
    <div class="accessly-overlay-content">
      <p class="accessly-overlay-instruction">Say the number to interact with elements:</p>
      <div class="accessly-overlay-elements"></div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #accessly-number-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: rgba(255, 255, 255, 0.98);
      border: 2px solid #667eea;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      backdrop-filter: blur(10px);
      overflow-y: auto;
    }
    
    .accessly-overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 14px 14px 0 0;
    }
    
    .accessly-overlay-title {
      font-weight: 600;
      font-size: 16px;
    }
    
    .accessly-overlay-close {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }
    
    .accessly-overlay-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .accessly-overlay-content {
      padding: 20px;
    }
    
    .accessly-overlay-instruction {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 14px;
      text-align: center;
    }
    
    .accessly-overlay-elements {
      display: grid;
      gap: 8px;
    }
    
    .accessly-element-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    
    .accessly-element-item:hover {
      background: #e3f2fd;
      border-color: #667eea;
      transform: translateY(-1px);
    }
    
    .accessly-element-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 50%;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .accessly-element-info {
      flex: 1;
      min-width: 0;
    }
    
    .accessly-element-description {
      font-size: 14px;
      color: #333;
      font-weight: 500;
      margin: 0 0 4px 0;
      word-break: break-word;
    }
    
    .accessly-element-type {
      font-size: 12px;
      color: #666;
      margin: 0;
    }
    
    .accessly-element-highlight {
      position: absolute;
      border: 3px solid #667eea;
      border-radius: 4px;
      background: rgba(102, 126, 234, 0.1);
      pointer-events: none;
      z-index: 10000;
      animation: accessly-highlight-pulse 2s infinite;
    }
    
    @keyframes accessly-highlight-pulse {
      0% { border-color: #667eea; }
      50% { border-color: #ff6b6b; }
      100% { border-color: #667eea; }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(numberOverlay);
  
  // Add elements to overlay
  const elementsContainer = numberOverlay.querySelector('.accessly-overlay-elements');
  if (elementsContainer) {
    numberedElements.forEach((element, index) => {
      const elementItem = document.createElement('div');
      elementItem.className = 'accessly-element-item';
      elementItem.innerHTML = `
        <div class="accessly-element-number">${index + 1}</div>
        <div class="accessly-element-info">
          <div class="accessly-element-description">${getElementDescription(element)}</div>
          <div class="accessly-element-type">${getElementType(element)}</div>
        </div>
      `;
      
      // Add click handler
      elementItem.addEventListener('click', () => {
        element.click();
        hideNumberOverlay();
      });
      
      // Add hover effect to highlight element on page
      elementItem.addEventListener('mouseenter', () => {
        highlightElement(element);
      });
      
      elementItem.addEventListener('mouseleave', () => {
        removeHighlight();
      });
      
      elementsContainer.appendChild(elementItem);
    });
  }
  
  // Add close button handler
  const closeButton = numberOverlay.querySelector('.accessly-overlay-close');
  closeButton?.addEventListener('click', hideNumberOverlay);
  
  // Add click outside to close
  numberOverlay.addEventListener('click', (e) => {
    if (e.target === numberOverlay) {
      hideNumberOverlay();
    }
  });
  
  // Add keyboard handler
  document.addEventListener('keydown', handleNumberKeyPress);
}

export function hideNumberOverlay() {
  if (numberOverlay) {
    numberOverlay.remove();
    numberOverlay = null;
  }
  
  numberedElements = [];
  removeHighlight();
  document.removeEventListener('keydown', handleNumberKeyPress);
}

// Handle number key presses
function handleNumberKeyPress(event: KeyboardEvent) {
  const key = event.key;
  const number = parseInt(key);
  
  if (number >= 1 && number <= 9 && number <= numberedElements.length) {
    const element = numberedElements[number - 1];
    if (element) {
      element.click();
      hideNumberOverlay();
    }
  }
  
  if (key === 'Escape') {
    hideNumberOverlay();
  }
}

// Highlight element on page
function highlightElement(element: HTMLElement) {
  removeHighlight();
  
  const rect = element.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.className = 'accessly-element-highlight';
  highlight.style.left = `${rect.left + window.scrollX}px`;
  highlight.style.top = `${rect.top + window.scrollY}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  
  document.body.appendChild(highlight);
}

// Remove highlight
function removeHighlight() {
  const existingHighlight = document.querySelector('.accessly-element-highlight');
  if (existingHighlight) {
    existingHighlight.remove();
  }
}

// Get element description
function getElementDescription(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  const title = element.getAttribute('title');
  if (title) return title;
  
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return placeholder;
  
  const value = (element as HTMLInputElement).value;
  if (value) return value;
  
  const textContent = element.textContent?.trim();
  if (textContent && textContent.length <= 50) return textContent;
  
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');
  
  if (type) {
    return `${tagName} ${type}`;
  }
  
  return tagName;
}

// Get element type
function getElementType(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');
  const role = element.getAttribute('role');
  
  if (role) return role;
  
  switch (tagName) {
    case 'button':
    case 'input':
      return type || 'button';
    case 'a':
      return 'link';
    case 'textarea':
      return 'textarea';
    case 'select':
      return 'select';
    default:
      return tagName;
  }
}
