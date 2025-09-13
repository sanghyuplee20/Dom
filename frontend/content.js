// content.js - Content script for DOM analysis and action execution

class VoiceForwardContent {
    constructor() {
        this.numberedElements = new Map();
        this.overlays = [];
        this.isShowingNumbers = false;
        this.recognition = null;
        this.isListening = false;

        this.setupMessageListener();
        this.initializeVoiceRecognition();
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

                case 'showNumbersDirectly':
                    this.showNumbersDirectly();
                    sendResponse({ success: true });
                    break;

                case 'scrollUp':
                    this.scrollUp(message.amount);
                    sendResponse({ success: true });
                    break;

                case 'startVoiceRecording':
                    this.startVoiceRecording();
                    sendResponse({ success: true });
                    break;

                case 'stopVoiceRecording':
                    this.stopVoiceRecording();
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
        
        // SIMPLIFIED APPROACH: Cast a wider net and let the backend filter
        const interactiveSelectors = [
            // Standard interactive elements
            'button', 'input', 'textarea', 'select', 'a',

            // Role-based elements
            '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',

            // Common interactive classes
            '[class*="btn"]', '[class*="button"]', '[class*="link"]',
            '[class*="clickable"]', '[class*="interactive"]',

            // Content containers that might be clickable
            '[class*="card"]', '[class*="tile"]', '[class*="item"]', '[class*="entry"]',

            // Elements with click handlers
            '[onclick]', '[onmousedown]', '[onmouseup]',

            // Elements with tabindex (focusable)
            '[tabindex]',

            // Data attributes suggesting interactivity
            '[data-click]', '[data-action]', '[data-href]', '[data-url]',

            // Cursor pointer elements
            '[style*="cursor"]'
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
                const selector = this.generateSelector(element);
                const elementData = {
                    tag_name: element.tagName.toLowerCase(),
                    text_content: this.getElementText(element),
                    attributes: this.getElementAttributes(element),
                    selector: selector,
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

                // DEBUG: Log selector for video elements
                if (selector.includes('lockup') || selector.includes('video')) {
                    console.log(`DEBUG: Video element selector: ${selector}`);
                }

                elements.push(elementData);
            }
        });
        
        console.log(`Found ${elements.length} interactive elements`);

        // DEBUG: Log first few elements if we found very few
        if (elements.length < 10) {
            console.log('DEBUG: Few elements found, logging details:');
            elements.slice(0, 5).forEach((el, i) => {
                console.log(`Element ${i}:`, el.tag_name, el.attributes.class, el.text_content?.substring(0, 50));
            });
        }

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
        const importantAttrs = [
            'id', 'class', 'name', 'type', 'placeholder', 'aria-label', 'role', 'data-testid',
            // YouTube and video-specific attributes
            'data-video-id', 'data-context-item-id', 'data-sessionlink', 'data-ytid',
            'data-vid', 'data-video-url', 'href', 'title', 'itemprop'
        ];
        
        importantAttrs.forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) {
                attrs[attr] = value;
            }
        });
        
        return attrs;
    }
    
    generateSelector(element) {
        // Generate a more unique CSS selector
        let parts = [];

        // Start with tag name
        parts.push(element.tagName.toLowerCase());

        // Add ID if available (most specific)
        if (element.id && element.id.trim()) {
            return `#${element.id}`;
        }

        // Add unique data attributes first (highly specific)
        if (element.getAttribute('data-video-id')) {
            return `[data-video-id="${element.getAttribute('data-video-id')}"]`;
        }
        if (element.getAttribute('data-context-item-id')) {
            return `[data-context-item-id="${element.getAttribute('data-context-item-id')}"]`;
        }
        if (element.getAttribute('name')) {
            return `[name="${element.getAttribute('name')}"]`;
        }

        // Build a more specific selector with classes
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ')
                .filter(c => c.trim() && !c.includes('style-scope'))
                .slice(0, 3); // Take up to 3 classes

            if (classes.length > 0) {
                parts.push('.' + classes.join('.'));
            }
        }

        // Add parent context to make selector more unique
        let parent = element.parentElement;
        if (parent && parent.tagName !== 'BODY') {
            let parentSelector = parent.tagName.toLowerCase();
            if (parent.id) {
                parentSelector = `#${parent.id}`;
            } else if (parent.className) {
                const parentClasses = parent.className.split(' ')
                    .filter(c => c.trim() && !c.includes('style-scope'))
                    .slice(0, 1);
                if (parentClasses.length > 0) {
                    parentSelector += '.' + parentClasses[0];
                }
            }
            return `${parentSelector} > ${parts.join('')}`;
        }

        return parts.join('');
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
        console.log('DEBUG: First few numbered elements:', numberedElements.slice(0, 3));

        let successfulOverlays = 0;
        let failedMatches = 0;

        numberedElements.forEach(item => {
            const element = this.findElementFromDescription(item.element);
            if (element) {
                // Check if we already numbered this exact element
                const alreadyNumbered = Array.from(this.numberedElements.values()).includes(element);
                if (alreadyNumbered) {
                    console.warn(`Element already numbered, skipping duplicate for number ${item.number}`);
                    failedMatches++;
                } else {
                    const overlay = this.createNumberOverlay(item.number, element);
                    document.body.appendChild(overlay);
                    this.overlays.push(overlay);
                    this.numberedElements.set(item.number, element);
                    successfulOverlays++;
                }
            } else {
                console.warn(`Failed to find element for number ${item.number}:`, item.element);
                failedMatches++;
            }
        });

        console.log(`DEBUG: Successfully created ${successfulOverlays} overlays, failed to match ${failedMatches} elements`);

        this.isShowingNumbers = true;
        
        // Add visual indicator to body
        document.body.classList.add('vf-numbers-active');
        
        console.log('Numbers shown:', this.numberedElements);
        
        // Auto-hide after 30 seconds
        setTimeout(() => this.hideNumbers(), 30000);
    }
    
    findElementFromDescription(elementDesc) {
        // Strategy 1: Position-based matching (most reliable for similar elements)
        if (elementDesc.position && elementDesc.position.x !== undefined) {
            const centerX = elementDesc.position.x + (elementDesc.position.width / 2);
            const centerY = elementDesc.position.y + (elementDesc.position.height / 2);

            // DEBUG: Log position info for video elements
            const isVideoElement = elementDesc.attributes?.class?.includes('lockup') ||
                                 elementDesc.attributes?.class?.includes('video') ||
                                 elementDesc.tag_name === 'yt-lockup-view-model';

            if (isVideoElement) {
                console.log(`DEBUG: Looking for ${elementDesc.tag_name} at position (${Math.round(centerX)}, ${Math.round(centerY)})`);
            }

            try {
                const elements = document.elementsFromPoint(centerX, centerY);
                if (elements && elements.length > 0) {
                    if (isVideoElement) {
                        console.log(`DEBUG: Found ${elements.length} elements at position:`, elements.slice(0, 3).map(e => e.tagName));
                    }

                    // Find the best matching element at this position
                    for (let elem of elements) {
                        if (elem.tagName && elem.tagName.toLowerCase() === elementDesc.tag_name) {
                            // Additional check: verify it's roughly the same size
                            const rect = elem.getBoundingClientRect();
                            const sizeDiffX = Math.abs(rect.width - elementDesc.position.width);
                            const sizeDiffY = Math.abs(rect.height - elementDesc.position.height);

                            if (sizeDiffX < 100 && sizeDiffY < 100) { // More tolerance
                                if (isVideoElement) {
                                    console.log(`DEBUG: Matched by position - size diff: ${sizeDiffX}x${sizeDiffY}`);
                                }
                                return elem;
                            }
                        }
                    }

                    // If no exact match, try any visible element at this position
                    for (let elem of elements) {
                        const rect = elem.getBoundingClientRect();
                        if (rect.width > 10 && rect.height > 10) {
                            if (isVideoElement) {
                                console.log(`DEBUG: Using fallback element at position: ${elem.tagName}`);
                            }
                            return elem;
                        }
                    }
                }
            } catch (e) {
                // elementsFromPoint failed, continue with other strategies
                console.warn('Position-based matching failed:', e);
            }
        }

        // Strategy 2: Try exact selector match
        if (elementDesc.selector) {
            try {
                const element = document.querySelector(elementDesc.selector);
                if (element) return element;
            } catch (e) {
                // Invalid selector, continue
            }
        }

        // Strategy 3: Find by unique text content
        if (elementDesc.text_content && elementDesc.text_content.length > 10) {
            const candidates = document.querySelectorAll(elementDesc.tag_name);
            for (let element of candidates) {
                const elementText = this.getElementText(element);
                if (elementText && elementText.includes(elementDesc.text_content.substring(0, 20))) {
                    return element;
                }
            }
        }

        return null;
    }
    
    createNumberOverlay(number, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const overlay = document.createElement('div');

        overlay.className = 'vf-number-overlay';
        overlay.textContent = number.toString();

        // Better positioning logic
        const size = 24; // Fixed size for consistency
        let left = rect.left - size/2;
        let top = rect.top - size/2;

        // Ensure overlay stays within viewport
        if (left < 0) left = 5;
        if (top < 0) top = 5;
        if (left + size > window.innerWidth) left = window.innerWidth - size - 5;
        if (top + size > window.innerHeight) top = window.innerHeight - size - 5;

        overlay.style.cssText = `
            position: fixed;
            top: ${top}px;
            left: ${left}px;
            width: ${size}px;
            height: ${size}px;
            background: #ff4444;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 999999;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            border: 2px solid white;
            pointer-events: none;
            transition: opacity 0.2s ease;
        `;

        return overlay;
    }
    
    hideNumbers() {
        this.overlays.forEach(overlay => overlay.remove());
        this.overlays = [];
        this.numberedElements.clear();
        this.isShowingNumbers = false;
        
        // Remove visual indicator from body
        document.body.classList.remove('vf-numbers-active');
        
        console.log('Numbers hidden');
    }

    showNumbersDirectly() {
        console.log('Direct numbering mode - finding elements on page');
        this.hideNumbers();

        // Find all potentially interactive elements directly
        const allElements = document.querySelectorAll(`
            a, button, input, textarea, select,
            [role="button"], [role="link"], [role="tab"],
            [onclick], [onmousedown], [tabindex],
            [class*="btn"], [class*="button"], [class*="link"],
            [class*="card"], [class*="tile"], [class*="item"], [class*="entry"],
            [class*="video"], [class*="play"], [class*="watch"],
            [data-action], [data-click], [data-href]
        `);

        console.log(`Found ${allElements.length} potential elements`);

        const visibleElements = [];
        allElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);

            // Check if element is visible
            if (rect.width > 5 && rect.height > 5 &&
                rect.top < window.innerHeight && rect.bottom > 0 &&
                rect.left < window.innerWidth && rect.right > 0 &&
                style.visibility !== 'hidden' && style.display !== 'none' &&
                style.opacity !== '0') {
                visibleElements.push(element);
            }
        });

        console.log(`${visibleElements.length} visible elements found`);

        // Sort by position (top to bottom, left to right)
        visibleElements.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            const yDiff = rectA.top - rectB.top;
            return Math.abs(yDiff) < 20 ? rectA.left - rectB.left : yDiff;
        });

        // Number the first 50 elements
        const elementsToNumber = visibleElements.slice(0, 50);

        elementsToNumber.forEach((element, index) => {
            const number = index + 1;
            const overlay = this.createNumberOverlay(number, element);
            document.body.appendChild(overlay);
            this.overlays.push(overlay);
            this.numberedElements.set(number, element);
        });

        this.isShowingNumbers = true;
        document.body.classList.add('vf-numbers-active');

        console.log(`Successfully numbered ${elementsToNumber.length} elements`);

        // Auto-hide after 30 seconds
        setTimeout(() => this.hideNumbers(), 30000);
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
        console.log('Numbers currently showing:', this.isShowingNumbers);
        console.log('Available numbered elements:', Array.from(this.numberedElements.keys()));
        
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

            case 'navigate':
                await this.navigateAction(action);
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

    scrollUp(amount = 300) {
        window.scrollBy({ top: -amount, behavior: 'smooth' });
        console.log(`Scrolled up by ${amount}px`);
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

    async navigateAction(action) {
        console.log('Navigating to:', action.url);

        if (action.url) {
            // Navigate to the URL
            window.location.href = action.url;
        } else {
            console.error('Navigate action missing URL');
            throw new Error('Navigate action requires a URL');
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
            const element = this.numberedElements.get(number);
            if (element) {
                console.log(`Found numbered element ${number}:`, element);
                return element;
            } else {
                console.warn(`Numbered element ${number} not found. Available numbers:`, Array.from(this.numberedElements.keys()));
                console.warn('Full numbered elements map:', this.numberedElements);
            }
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

    initializeVoiceRecognition() {
        // Check for Web Speech API support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Configure recognition
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        // Set up event handlers
        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.isListening = true;
            this.sendMessageToPopup({ type: 'voiceStatusChanged', status: 'listening' });
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Send interim results to popup for preview
            if (interimTranscript) {
                this.sendMessageToPopup({
                    type: 'transcriptionUpdate',
                    text: finalTranscript + interimTranscript
                });
            }

            // Process final results
            if (finalTranscript.trim()) {
                console.log('Final transcript:', finalTranscript);
                this.sendMessageToPopup({
                    type: 'transcriptionComplete',
                    text: finalTranscript.trim()
                });
                this.processVoiceCommand(finalTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;

            let errorMessage = 'Voice recognition error: ';
            switch (event.error) {
                case 'not-allowed':
                    errorMessage += 'Microphone access denied. Please allow microphone access and try again.';
                    break;
                case 'no-speech':
                    errorMessage += 'No speech detected.';
                    break;
                case 'audio-capture':
                    errorMessage += 'Microphone not available.';
                    break;
                default:
                    errorMessage += event.error;
            }

            this.sendMessageToPopup({
                type: 'voiceError',
                error: errorMessage
            });
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            this.isListening = false;
            this.sendMessageToPopup({ type: 'voiceStatusChanged', status: 'ready' });
        };
    }

    startVoiceRecording() {
        if (this.isListening || !this.recognition) return;

        try {
            this.recognition.start();
            console.log('Starting voice recognition...');
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.sendMessageToPopup({
                type: 'voiceError',
                error: 'Failed to start voice recognition'
            });
        }
    }

    stopVoiceRecording() {
        if (!this.isListening || !this.recognition) return;

        this.recognition.stop();
        console.log('Stopping voice recognition...');
    }

    async processVoiceCommand(command) {
        console.log('Processing voice command:', command);

        try {
            // Get DOM context
            const domContext = this.getDOMContext();

            // Prepare request for backend
            const requestData = {
                query: command,
                page_context: domContext
            };

            // Send to backend via popup
            this.sendMessageToPopup({
                type: 'processCommand',
                data: requestData
            });

        } catch (error) {
            console.error('Error processing voice command:', error);
            this.sendMessageToPopup({
                type: 'voiceError',
                error: 'Failed to process voice command'
            });
        }
    }

    sendMessageToPopup(message) {
        // Send message to popup via background script
        chrome.runtime.sendMessage(message).catch(error => {
            console.log('Could not send message to popup:', error);
        });
    }
}

// Initialize content script
const voiceForwardContent = new VoiceForwardContent();