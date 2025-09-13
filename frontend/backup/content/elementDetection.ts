// Element detection for interactive elements on web pages

export function detectInteractiveElements(): HTMLElement[] {
  const interactiveElements: HTMLElement[] = [];
  
  // Selectors for interactive elements
  const selectors = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="search"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[type="number"]',
    'textarea',
    'select',
    'a[href]',
    '[onclick]',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="option"]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ];
  
  // Find all interactive elements
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
    elements.forEach(element => {
      if (isElementVisible(element) && !isElementDisabled(element)) {
        interactiveElements.push(element);
      }
    });
  });
  
  // Remove duplicates
  const uniqueElements = Array.from(new Set(interactiveElements));
  
  // Sort by visual position (top to bottom, left to right)
  uniqueElements.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    
    if (Math.abs(rectA.top - rectB.top) < 10) {
      return rectA.left - rectB.left;
    }
    return rectA.top - rectB.top;
  });
  
  return uniqueElements;
}

// Check if element is visible
function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

// Check if element is disabled
function isElementDisabled(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled')) return true;
  if (element.getAttribute('aria-disabled') === 'true') return true;
  
  // Check if element is inside a disabled fieldset
  const fieldset = element.closest('fieldset');
  if (fieldset && fieldset.hasAttribute('disabled')) return true;
  
  return false;
}

// Get element description for voice commands
export function getElementDescription(element: HTMLElement): string {
  // Try different attributes for description
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  const title = element.getAttribute('title');
  if (title) return title;
  
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return placeholder;
  
  const value = (element as HTMLInputElement).value;
  if (value) return value;
  
  const textContent = element.textContent?.trim();
  if (textContent) return textContent;
  
  // Fallback to tag name and type
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');
  
  if (type) {
    return `${tagName} ${type}`;
  }
  
  return tagName;
}

// Get element type for categorization
export function getElementType(element: HTMLElement): string {
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
