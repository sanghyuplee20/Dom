// content.js - Content script for DOM analysis and action execution

class VoiceForwardContent {
    constructor() {
        this.numberedElements = new Map();
        this.overlays = [];
        this.isShowingNumbers = false;
        
        this.setupMessageListener();
        console.log('VoiceForward content script loaded');
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'getDOMContext':
                    sendResponse(this.getDOMContext());
                    break;
                    
                case 'executeResult':
                    this.executeResult(message.data);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    console.warn('Unknown message action:', message.action);
            }
        });
    }
    
    getDOMContext() {
        try {
            const elements = this.analyzeDOM();
            
            return {
                url: window.location.href,
                title: document.title,
                elements: elements,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                scroll_position: {
                    x: window.scrollX,
                    y: window.scrollY
                }
            };
        } catch (error) {
            console.error('Error getting DOM context:', error);
            return null;
        }
    }
    
    analyzeDOM() {
        const elements = [];
        
        // Define selectors for interactive elements
        const interactiveSelectors = [
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'textarea:not([disabled])',
            'select:not([disabled])',
            'a[href]',
            '[role="button"]:not([disabled])',
            '[onclick]',
            '[tabindex]:not([tabindex="-1"])',
            '.btn',
            '.button',
            '[data-testid*="button"]'
        ];
        
        // Find all interactive elements
        const foundElements = document.querySelectorAll(interactiveSelectors.join(', '));
        
        foundElements.forEach((element, index) => {
            // Check if element is visible
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            const isVisible = (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0 &&
                rect.top < window.innerHeight &&
                rect.bottom > 0
            );
            
            if (isVisible) {
                const elementData = {
                    tag_name: element.tagName.toLowerCase(),
                    text_content: this.getElementText(element),
                    attributes: this.getElementAttributes(element),
                    selector: this.generateSelector(element),
                    xpath: this.generateXPath(element),
                    position: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    },
                    is_visible: true,
                    is_interactive: true
                };
                
                elements.push(elementData);
            }
        });
        
        console.log(`Found ${elements.length} interactive elements`);
        return elements;
    }
    
    getElementText(element) {
        // Get visible text content, prioritizing specific attributes
        let text = '';
        
        // Check aria-label first
        if (element.getAttribute('aria-label')) {
            text = element.getAttribute('aria-label');
        }
        // Then check placeholder
        else if (element.getAttribute('placeholder')) {
            text = element.getAttribute('placeholder');
        }
        // Then check title
        else if (element.getAttribute('title')) {
            text = element.getAttribute('title');
        }
        // Finally check text content
        else if (element.textContent && element.textContent.trim()) {
            text = element.textContent.trim();
        }
        // For inputs, check value
        else if (element.tagName === 'INPUT' && element.value) {
            text = element.value;
        }
        
        return text.substring(0, 100); // Limit length
    }
    
    getElementAttributes(element) {
        const attrs = {};
        
        // Get important attributes
        const importantAttrs = ['id', 'class', 'name', 'type', 'placeholder', 'aria-label', 'role', 'data-testid'];
        
        importantAttrs.forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) {
                attrs[attr] = value;
            }
        });
        
        return attrs;
    }
    
    generateSelector(element) {
        // Generate a CSS selector for the element
        let selector = element.tagName.toLowerCase();
        
        // Add ID if available
        if (element.id) {
            return `#${element.id}`;
        }
        
        // Add class if available
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                selector += '.' + classes[0];
            }
        }
        
        // Add attribute selectors for better specificity
        if (element.getAttribute('name')) {
            selector += `[name="${element.getAttribute('name')}"]`;
        } else if (element.getAttribute('data-testid')) {
            selector += `[data-testid="${element.getAttribute('data-testid')}"]`;
        }
        
        return selector;
    }
    
    generateXPath(element) {
        // Simple XPath generation
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        let path = '';
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = current.previousSibling;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            
            const tagName = current.tagName.toLowerCase();
            const pathIndex = index > 0 ? `[${index + 1}]` : '';
            path = `/${tagName}${pathIndex}${path}`;
            
            current = current.parentNode;
        }
        
        return path;
    }
    
    async executeResult(result) {
        console.log('Executing result:', result);
        
        if (result.command_type === 'show_numbers') {
            this.showNumbers(result.numbered_elements);
        } else if (result.command_type === 'action_sequence') {
            await this.executeActions(result.actions);
        }
    }
    
    showNumbers(numberedElements) {
        // Clear any existing numbers
        this.hideNumbers();
        
        console.log(`Showing numbers for ${numberedElements.length} elements`);
        
        numberedElements.forEach(item => {
            const element = this.findElementFromDescription(item.element);
            if (element) {
                const overlay = this.createNumberOverlay(item.number, element);
                document.body.appendChild(overlay);
                this.overlays.push(overlay);
                this.numberedElements.set(item.number, element);
            }
        });
        
        this.isShowingNumbers = true;
        
        // Auto-hide after 30 seconds
        setTimeout(() => this.hideNumbers(), 30000);
    }
    
    findElementFromDescription(elementDesc) {
        // Try to find element using selector first
        if (elementDesc.selector) {
            try {
                const element = document.querySelector(elementDesc.selector);
                if (element) return element;
            } catch (e) {
                // Selector might be invalid
            }
        }
        
        // Fallback to finding by text content and tag
        const elements = document.querySelectorAll(elementDesc.tag_name);
        for (let element of elements) {
            if (this.getElementText(element) === elementDesc.text_content) {
                return element;
            }
        }
        
        return null;
    }
    
    createNumberOverlay(number, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const overlay = document.createElement('div');
        
        overlay.className = 'vf-number-overlay';
        overlay.textContent = number.toString();
        
        // Position overlay
        const size = Math.min(Math.max(rect.width * 0.15, 20), 32);
        overlay.style.cssText = `
            position: fixed;
            top: ${rect.top - size/2}px;
            left: ${rect.right - size/2}px;
            width: ${size}px;
            height: ${size}px;
            background: linear-gradient(135deg, #ff4444, #cc2222);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: ${size * 0.6}px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 999999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
            pointer-events: none;
            animation: vfPulse 2s infinite;
        `;
        
        return overlay;
    }
    
    hideNumbers() {
        this.overlays.forEach(overlay => overlay.remove());
        this.overlays = [];
        this.numberedElements.clear();
        this.isShowingNumbers = false;
    }
    
    async executeActions(actions) {
        console.log(`Executing ${actions.length} actions`);
        
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            
            try {
                await this.executeAction(action);
                
                // Wait between actions
                if (action.wait_time) {
                    await this.wait(action.wait_time * 1000);
                }
                
            } catch (error) {
                console.error(`Error executing action ${i + 1}:`, error);
                // Continue with next action
            }
        }
    }
    
    async executeAction(action) {
        console.log('Executing action:', action);
        
        switch (action.action) {
            case 'click':
                await this.clickAction(action);
                break;
                
            case 'type':
                await this.typeAction(action);
                break;
                
            case 'scroll':
                await this.scrollAction(action);
                break;
                
            case 'wait':
                await this.wait(action.duration * 1000 || 1000);
                break;
                
            case 'hover':
                await this.hoverAction(action);
                break;
                
            case 'focus':
                await this.focusAction(action);
                break;
                
            default:
                console.warn('Unknown action type:', action.action);
        }
    }
    
    async clickAction(action) {
        const element = this.findActionTarget(action);
        if (element) {
            this.highlightElement(element);
            
            // Scroll into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.wait(500);
            
            // Click the element
            element.click();
            element.focus();
            
            console.log('Clicked element:', element);
        } else {
            throw new Error(`Could not find element to click: ${action.target}`);
        }
    }
    
    async typeAction(action) {
        const element = this.findActionTarget(action);
        if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.contentEditable === 'true')) {
            this.highlightElement(element);
            
            // Focus the element
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.wait(300);
            
            // Clear existing content
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.select();
                element.value = action.text;
                
                // Trigger input events for frameworks
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (element.contentEditable === 'true') {
                element.textContent = action.text;
            }
            
            console.log('Typed text:', action.text);
        } else {
            throw new Error(`Could not find input element for typing: ${action.target}`);
        }
    }
    
    async scrollAction(action) {
        const amount = action.amount || 300;
        const direction = action.direction || 'down';
        
        if (direction === 'down') {
            window.scrollBy({ top: amount, behavior: 'smooth' });
        } else if (direction === 'up') {
            window.scrollBy({ top: -amount, behavior: 'smooth' });
        }
        
        console.log(`Scrolled ${direction} by ${amount}px`);
    }
    
    async hoverAction(action) {
        const element = this.findActionTarget(action);
        if (element) {
            this.highlightElement(element);
            
            // Create and dispatch hover event
            const hoverEvent = new MouseEvent('mouseover', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(hoverEvent);
            
            console.log('Hovered element:', element);
        }
    }
    
    async focusAction(action) {
        const element = this.findActionTarget(action);
        if (element) {
            this.highlightElement(element);
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            console.log('Focused element:', element);
        }
    }
    
    findActionTarget(action) {
        // Try different strategies to find the target element
        
        // Strategy 1: Use validated selector if available
        if (action.validated_selector) {
            try {
                const element = document.querySelector(action.validated_selector);
                if (element) return element;
            } catch (e) {}
        }
        
        // Strategy 2: Use original selector
        if (action.selector) {
            try {
                const element = document.querySelector(action.selector);
                if (element) return element;
            } catch (e) {}
        }
        
        // Strategy 3: Find by numbered element (if numbers are showing)
        if (action.target && action.target.startsWith('number_')) {
            const number = parseInt(action.target.split('_')[1]);
            return this.numberedElements.get(number);
        }
        
        // Strategy 4: Find by text content
        if (action.target) {
            const elements = document.querySelectorAll('button, input, textarea, select, a');
            for (let element of elements) {
                const text = this.getElementText(element).toLowerCase();
                if (text.includes(action.target.toLowerCase())) {
                    return element;
                }
            }
        }
        
        return null;
    }
    
    highlightElement(element) {
        // Add temporary highlight
        element.classList.add('vf-highlighted');
        setTimeout(() => {
            element.classList.remove('vf-highlighted');
        }, 1000);
    }
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize content script
const voiceForwardContent = new VoiceForwardContent();