// content.js - Content script for DOM analysis and action execution

class VoiceForwardContent {
    constructor() {
        this.numberedElements = new Map();
        this.overlays = [];
        this.isShowingNumbers = false;
        this.recognition = null;
        this.isListening = false;
        this.interimTimeout = null;
        this.floatingIndicator = null;
        this.isWaitingForWakeWord = true;
        this.wakeWord = 'hey dom';
        this.isActivated = false; // Track if we're in persistent recording mode
        this.currentUrl = window.location.href;
        this.shouldAutoRestart = true; // Flag to control auto-restart behavior

        this.setupMessageListener();
        this.initializeVoiceRecognition();
        this.createFloatingIndicator();
        this.setupWindowResizeHandler();
        this.checkActivationState();
        console.log('VoiceForward content script loaded with passive wake word listening');
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

                case 'restartVoiceRecording':
                    this.restartVoiceRecording();
                    sendResponse({ success: true });
                    break;

                case 'stopRecordingFromVoice':
                    // This is called when voice command stops recording from background
                    this.shouldAutoRestart = false;
                    this.stopVoiceRecording();
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
                    this.closeCurrentTab();
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
            // DO NOT hide numbers here - we need them for number-based actions!
            console.log('Executing action sequence while preserving numbers');
            await this.executeActions(result.actions);

            // Only hide numbers after action execution is complete and if the action succeeded
            // This gives users a chance to see the result and try another number if needed
            setTimeout(() => {
                // Check if the action involved clicking a numbered element
                const hasNumberAction = result.actions?.some(action =>
                    action.target && action.target.startsWith('number_')
                );

                if (hasNumberAction) {
                    console.log('Number-based action completed, keeping numbers visible for next interaction');
                    // Keep numbers visible for potential follow-up actions
                } else {
                    // Non-number actions can hide the numbers
                    this.hideNumbers();
                }
            }, 1000);
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
            background: #4682b4;
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
        console.log('=== EXECUTING ACTION ===');
        console.log('Action:', action);
        console.log('Numbers currently showing:', this.isShowingNumbers);
        console.log('Available numbered elements:', Array.from(this.numberedElements.keys()));
        console.log('Total overlays:', this.overlays.length);

        // Log the full state before action
        if (action.target && action.target.startsWith('number_')) {
            const number = parseInt(action.target.split('_')[1]);
            console.log(`About to execute action on number ${number}`);
            const element = this.numberedElements.get(number);
            if (element) {
                console.log(`Element for number ${number} exists:`, element);
                console.log('Element in DOM:', document.contains(element));
            } else {
                console.error(`CRITICAL: No element stored for number ${number}`);
            }
        }

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

            case 'hide_numbers':
                this.hideNumbers();
                console.log('Numbers hidden by explicit command');
                break;

            case 'switch_tab':
                await this.switchTabAction(action);
                break;

            case 'create_tab':
                await this.createTabAction(action);
                break;

            case 'close_tab':
                await this.closeTabAction(action);
                break;

            default:
                console.warn('Unknown action type:', action.action);
        }
    }
    
    async clickAction(action) {
        const element = this.findActionTarget(action);
        if (!element) {
            throw new Error(`Could not find element to click: ${action.target || action.selector || 'unknown target'}`);
        }

        try {
            console.log('Attempting to click element:', element);
            this.highlightElement(element);

            // Ensure element is interactable before proceeding
            if (!this.isElementInteractable(element)) {
                console.warn('Element found but not interactable, trying to make it interactable...');

                // Try to scroll the element into view
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                await this.wait(1000); // Give more time for scrolling

                // Check again after scrolling
                if (!this.isElementInteractable(element)) {
                    throw new Error(`Element is not interactable after scrolling: ${element.tagName}`);
                }
            }

            // Try multiple click methods for better compatibility
            const clickMethods = [
                // Method 1: Standard click
                () => {
                    console.log('Trying standard click...');
                    element.click();
                },

                // Method 2: Focus then click
                () => {
                    console.log('Trying focus then click...');
                    element.focus();
                    element.click();
                },

                // Method 3: Dispatch mouse events
                () => {
                    console.log('Trying mouse events...');
                    const rect = element.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                        const event = new MouseEvent(eventType, {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                            clientX: centerX,
                            clientY: centerY
                        });
                        element.dispatchEvent(event);
                    });
                },

                // Method 4: Try synthetic click event
                () => {
                    console.log('Trying synthetic click event...');
                    const clickEvent = new Event('click', {
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(clickEvent);
                }
            ];

            // Try each method until one works or all fail
            let clicked = false;
            for (let i = 0; i < clickMethods.length && !clicked; i++) {
                try {
                    clickMethods[i]();

                    // Brief wait to see if the click had an effect
                    await this.wait(200);

                    // Check if the page changed or element state changed
                    if (this.hasPageOrElementChanged(element)) {
                        clicked = true;
                        console.log(`Click method ${i + 1} succeeded`);
                        break;
                    }
                } catch (methodError) {
                    console.warn(`Click method ${i + 1} failed:`, methodError);
                }
            }

            // Special handling for specific element types
            if (!clicked) {
                if (element.tagName === 'A' && element.href) {
                    console.log('Trying navigation for link element...');
                    window.location.href = element.href;
                    clicked = true;
                } else if (element.tagName === 'INPUT' && element.type === 'submit') {
                    console.log('Trying form submission...');
                    const form = element.closest('form');
                    if (form) {
                        form.submit();
                        clicked = true;
                    }
                }
            }

            if (clicked) {
                console.log('Successfully clicked element:', element);
                // Give the page time to respond
                await this.wait(300);
            } else {
                throw new Error(`All click methods failed for element: ${element.tagName}`);
            }

        } catch (error) {
            console.error('Click action failed:', error);
            // Try to provide more context about the failure
            const elementInfo = {
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                textContent: element.textContent?.substring(0, 50)
            };
            throw new Error(`Click failed: ${error.message}. Element info: ${JSON.stringify(elementInfo)}`);
        }
    }

    hasPageOrElementChanged(element) {
        // Simple heuristics to detect if something changed after click
        try {
            // Check if URL changed
            if (this.currentUrl !== window.location.href) {
                this.currentUrl = window.location.href;
                return true;
            }

            // Check if element is still in the same state
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                // Element might have been hidden/removed
                return true;
            }

            // Check if focus changed
            if (document.activeElement !== element && document.activeElement !== document.body) {
                return true;
            }

            // Default: assume click had some effect
            return true;
        } catch (e) {
            return true;
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
        console.log('Finding target for action:', action);

        // Strategy 1: Find by numbered element (highest priority)
        if (action.target && action.target.startsWith('number_')) {
            const number = parseInt(action.target.split('_')[1]);
            console.log(`Looking for numbered element ${number}`);
            console.log(`Available numbered elements:`, Array.from(this.numberedElements.keys()));
            console.log(`Numbers showing:`, this.isShowingNumbers);
            console.log(`Total overlays:`, this.overlays.length);

            const element = this.numberedElements.get(number);
            if (element) {
                console.log(`Found element for number ${number}:`, element);

                // Check if element is still in DOM
                if (!document.contains(element)) {
                    console.warn(`Element for number ${number} is no longer in DOM`);
                    return null;
                }

                if (this.isElementInteractable(element)) {
                    console.log(`Element ${number} is interactable, returning it`);
                    return element;
                } else {
                    console.warn(`Element ${number} found but not interactable:`, {
                        tagName: element.tagName,
                        visible: element.offsetParent !== null,
                        disabled: element.disabled,
                        display: getComputedStyle(element).display,
                        visibility: getComputedStyle(element).visibility
                    });
                }
            } else {
                console.error(`No element found for number ${number}!`);
                console.log('Full numbered elements map:', this.numberedElements);
            }
        }

        // Strategy 2: Use validated selector if available
        if (action.validated_selector) {
            try {
                const element = document.querySelector(action.validated_selector);
                if (element && this.isElementInteractable(element)) {
                    console.log('Found element by validated selector:', element);
                    return element;
                }
            } catch (e) {
                console.warn('Validated selector failed:', e);
            }
        }

        // Strategy 3: Use original selector with improved error handling
        if (action.selector) {
            try {
                // Clean up the selector to avoid common issues
                let cleanSelector = action.selector;

                // Handle data attributes with special characters
                if (cleanSelector.includes('[data-number=')) {
                    const numberMatch = cleanSelector.match(/\[data-number=['"](\d+)['"]\]/);
                    if (numberMatch) {
                        const number = parseInt(numberMatch[1]);
                        const element = this.numberedElements.get(number);
                        if (element && this.isElementInteractable(element)) {
                            console.log(`Found element by number reference in selector:`, element);
                            return element;
                        }
                    }
                }

                const element = document.querySelector(cleanSelector);
                if (element && this.isElementInteractable(element)) {
                    console.log('Found element by selector:', element);
                    return element;
                }
            } catch (e) {
                console.warn('Selector failed:', cleanSelector, e);
            }
        }

        // Strategy 4: Find by coordinates if available
        if (action.coordinates && action.coordinates.x !== undefined && action.coordinates.y !== undefined) {
            try {
                const elements = document.elementsFromPoint(action.coordinates.x, action.coordinates.y);
                for (let element of elements) {
                    if (this.isElementInteractable(element)) {
                        console.log('Found element by coordinates:', element);
                        return element;
                    }
                }
            } catch (e) {
                console.warn('Coordinate-based finding failed:', e);
            }
        }

        // Strategy 5: Enhanced text content search
        if (action.target && typeof action.target === 'string' && !action.target.startsWith('number_')) {
            const searchText = action.target.toLowerCase();
            const selectors = [
                'button', 'input[type="button"]', 'input[type="submit"]',
                'a[href]', '[role="button"]', '[onclick]',
                '.btn', '.button', '[data-action]'
            ];

            for (let selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (let element of elements) {
                        const text = this.getElementText(element).toLowerCase();
                        if (text.includes(searchText) && this.isElementInteractable(element)) {
                            console.log('Found element by text content:', element);
                            return element;
                        }
                    }
                } catch (e) {
                    console.warn(`Selector ${selector} failed:`, e);
                }
            }
        }

        console.error('Could not find target element for action:', action);
        return null;
    }

    isElementInteractable(element) {
        if (!element || !element.getBoundingClientRect) return false;

        try {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            // Check if element is visible and has area
            const isVisible = (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                parseFloat(style.opacity) > 0 &&
                rect.width > 0 &&
                rect.height > 0
            );

            // Check if element is in viewport or scrollable into view
            const isInViewport = (
                rect.top < window.innerHeight + 1000 && // Allow some margin for scrolling
                rect.bottom > -1000 &&
                rect.left < window.innerWidth + 1000 &&
                rect.right > -1000
            );

            // Check if element is not disabled
            const isEnabled = !element.disabled && !element.hasAttribute('disabled');

            return isVisible && isInViewport && isEnabled;
        } catch (e) {
            console.warn('Error checking element interactability:', e);
            return false;
        }
    }
    
    highlightElement(element) {
        // Add CSS styles for highlighting if not already added
        if (!document.querySelector('#vf-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'vf-highlight-styles';
            style.textContent = `
                .vf-highlighted {
                    outline: 3px solid #ff4444 !important;
                    outline-offset: 2px !important;
                    background-color: rgba(255, 68, 68, 0.1) !important;
                    transition: all 0.2s ease !important;
                    position: relative !important;
                    z-index: 999999 !important;
                }

                .vf-highlighted::before {
                    content: "CLICKING...";
                    position: absolute !important;
                    top: -25px !important;
                    left: 0 !important;
                    background: #ff4444 !important;
                    color: white !important;
                    padding: 2px 8px !important;
                    font-size: 11px !important;
                    font-weight: bold !important;
                    border-radius: 3px !important;
                    z-index: 1000000 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                }

                .vf-numbers-active {
                    /* Ensure numbers stay visible during interactions */
                }
            `;
            document.head.appendChild(style);
        }

        // Add temporary highlight
        element.classList.add('vf-highlighted');

        // Ensure element stays highlighted during the interaction
        setTimeout(() => {
            if (element.classList.contains('vf-highlighted')) {
                element.classList.remove('vf-highlighted');
            }
        }, 2000); // Longer timeout to see the action
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
            // Show appropriate indicator based on activation state
            this.showFloatingIndicator(this.isActivated);
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

            const fullTranscript = (finalTranscript + interimTranscript).trim().toLowerCase();
            console.log('Full transcript:', fullTranscript, 'Activated:', this.isActivated);

            // If not activated yet, check for wake word
            if (!this.isActivated) {
                const wakeWordVariations = [
                    'hey dom', 'hey don', 'a dom', 'hey dumb', 'hey tom',
                    'hey dom', 'hey down', 'hey dawn', 'hey done', 'hey damn',
                    'a don', 'a tom', 'a done', 'aide on', 'hey damn',
                    'hey deem', 'hey dim', 'hay dom', 'hey doom', 'hey dom',
                    'hey dom', 'hey dom', 'hey dom', 'hey dom', 'hey dom',
                    'dom', 'don', 'tom', 'dumb', 'dawn', 'hey' // Even more lenient - just the name variations
                ];

                // More flexible matching - check if any variation is contained or sounds similar
                const detectedWakeWord = wakeWordVariations.find(variation => {
                    // Direct contains check
                    if (fullTranscript.includes(variation)) return true;

                    // Fuzzy matching for single word variations
                    if (variation.length <= 4) {  // For short words like 'dom', 'don', etc.
                        const words = fullTranscript.split(' ');
                        return words.some(word => {
                            // Check if word starts with variation (partial match)
                            if (word.startsWith(variation)) return true;
                            // Check if variation starts with word (truncated speech)
                            if (variation.startsWith(word) && word.length >= 2) return true;
                            return false;
                        });
                    }

                    return false;
                });

                if (detectedWakeWord) {
                    console.log('Wake word detected - activating persistent recording mode');
                    this.isActivated = true;
                    this.showFloatingIndicator(true); // Show REC

                    // Save activation state to background
                    chrome.runtime.sendMessage({
                        type: 'setActivationState',
                        isActivated: true
                    });

                    // Extract command after wake word
                    const wakeWordIndex = fullTranscript.indexOf(detectedWakeWord);
                    const commandAfterWakeWord = fullTranscript.substring(wakeWordIndex + detectedWakeWord.length).trim();

                    if (commandAfterWakeWord.length > 2) {
                        // Process command immediately if there's more speech after wake word
                        console.log('Processing command after activation:', commandAfterWakeWord);
                        this.sendMessageToPopup({
                            type: 'transcriptionComplete',
                            text: commandAfterWakeWord
                        });
                        this.processVoiceCommand(commandAfterWakeWord);
                        return;
                    }

                    // Send status update
                    this.sendMessageToPopup({
                        type: 'transcriptionUpdate',
                        text: 'Activated - listening for commands...'
                    });
                    return;
                }
                // Still waiting for wake word, don't process anything else
                return;
            }

            // We're past wake word, now listening for actual commands
            if (interimTranscript && interimTranscript.trim().length > 2) {
                const fullCommand = (finalTranscript + interimTranscript).trim();

                // Send interim results to popup for preview
                this.sendMessageToPopup({
                    type: 'transcriptionUpdate',
                    text: fullCommand
                });

                // Clear existing timeout
                if (this.interimTimeout) {
                    clearTimeout(this.interimTimeout);
                }

                // Set 2-second timeout to auto-execute command
                this.interimTimeout = setTimeout(() => {
                    if (this.isListening && fullCommand.length > 3) {
                        console.log('Auto-executing after 2 seconds of silence:', fullCommand);

                        // Check for "stop recording" command
                        if (this.isStopRecordingCommand(fullCommand)) {
                            console.log('Stop recording command detected - deactivating');
                            this.isActivated = false;
                            this.showFloatingIndicator(false); // Show READY

                            // Save deactivation state to background
                            chrome.runtime.sendMessage({
                                type: 'setActivationState',
                                isActivated: false
                            });

                            this.sendMessageToPopup({
                                type: 'recordingStopped',
                                text: 'Recording deactivated - say "Hey Dom" to reactivate'
                            });
                            return;
                        }

                        this.sendMessageToPopup({
                            type: 'transcriptionComplete',
                            text: fullCommand
                        });
                        this.processVoiceCommand(fullCommand);

                        // Stay in activated mode - don't reset

                        // Clear the interim timeout and restart recognition with clean state
                        if (this.interimTimeout) {
                            clearTimeout(this.interimTimeout);
                            this.interimTimeout = null;
                        }

                        // Stop and restart recognition to ensure clean state for next command
                        if (this.recognition && this.isListening) {
                            setTimeout(() => {
                                this.recognition.stop();
                            }, 100);
                        }
                    }
                }, 2000);
            }

            // Process final results immediately (override timeout)
            if (finalTranscript.trim()) {
                if (this.interimTimeout) {
                    clearTimeout(this.interimTimeout);
                    this.interimTimeout = null;
                }

                const command = finalTranscript.trim();
                console.log('Final transcript:', command);

                // Check for "stop recording" command
                if (this.isStopRecordingCommand(command)) {
                    console.log('Stop recording command detected - deactivating');
                    this.isActivated = false;
                    this.showFloatingIndicator(false); // Show READY

                    // Save deactivation state to background
                    chrome.runtime.sendMessage({
                        type: 'setActivationState',
                        isActivated: false
                    });

                    this.sendMessageToPopup({
                        type: 'recordingStopped',
                        text: 'Recording deactivated - say "Hey Dom" to reactivate'
                    });
                    return;
                }

                this.sendMessageToPopup({
                    type: 'transcriptionComplete',
                    text: command
                });
                this.processVoiceCommand(command);

                // Stay in activated mode - don't reset

                // Clear any pending timeout and restart recognition for next command
                if (this.interimTimeout) {
                    clearTimeout(this.interimTimeout);
                    this.interimTimeout = null;
                }

                // Stop and restart recognition to ensure clean state for next command
                if (this.recognition && this.isListening) {
                    setTimeout(() => {
                        this.recognition.stop();
                    }, 100);
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;

            let errorMessage = 'Voice recognition error: ';
            switch (event.error) {
                case 'not-allowed':
                    errorMessage += 'Microphone access needed. Click the extension popup and allow microphone access.';
                    // Show a more prominent message for permission issues
                    this.showPermissionPrompt();
                    break;
                case 'no-speech':
                    // This is normal during wake word listening, don't show error
                    console.log('No speech detected, continuing to listen...');
                    return;
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
            this.showFloatingIndicator(false); // false = ready but not recording

            // Clear any pending timeout
            if (this.interimTimeout) {
                clearTimeout(this.interimTimeout);
                this.interimTimeout = null;
            }

            this.sendMessageToPopup({ type: 'voiceStatusChanged', status: 'ready' });

            // Only auto-restart if shouldAutoRestart is true (continuous listening mode)
            if (this.shouldAutoRestart) {
                setTimeout(() => {
                    if (!this.isListening && this.recognition && this.shouldAutoRestart) {
                        try {
                            console.log('Auto-restarting voice recognition with clean state...');
                            this.recognition.start();
                        } catch (error) {
                            console.log('Could not auto-restart recognition:', error);
                        }
                    }
                }, 100); // Short delay to ensure clean restart
            } else {
                console.log('Voice recognition stopped - auto-restart disabled');
            }
        };
    }

    startVoiceRecording() {
        if (this.isListening || !this.recognition) return;

        // Enable auto-restart when starting recording
        this.shouldAutoRestart = true;
        // Reset activation state if manually starting
        this.isActivated = false;

        try {
            this.recognition.start();
            console.log('Starting voice recognition - waiting for wake word "' + this.wakeWord + '"...');
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

        // Disable auto-restart when user explicitly stops recording
        this.shouldAutoRestart = false;

        // Clear any pending timeout
        if (this.interimTimeout) {
            clearTimeout(this.interimTimeout);
            this.interimTimeout = null;
        }

        this.recognition.stop();
        this.showFloatingIndicator(false);
        console.log('Stopping voice recognition... (auto-restart disabled)');
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

            // Send directly to backend (no need for popup)
            const response = await fetch('http://localhost:8000/process-command', {
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
            console.log('Backend response:', result);

            // Execute the result directly
            await this.executeResult(result);

            // Also send to popup if it's open for display
            this.sendMessageToPopup({
                type: 'commandExecuted',
                command: command,
                result: result
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

    isStopRecordingCommand(command) {
        const lowerCommand = command.toLowerCase().trim();
        const stopPatterns = [
            'stop recording',
            'stop record',
            'end recording',
            'finish recording',
            'quit recording',
            'close recording',
            'turn off recording',
            'disable recording'
        ];

        return stopPatterns.some(pattern => lowerCommand.includes(pattern));
    }

    async restartVoiceRecording() {
        console.log('Restarting voice recording on new page...');

        // Enable auto-restart when restarting recording
        this.shouldAutoRestart = true;

        // Wait a moment for the page to fully load
        setTimeout(() => {
            if (!this.isListening && this.recognition) {
                try {
                    this.recognition.start();
                    console.log('Voice recording restarted successfully');
                } catch (error) {
                    console.error('Failed to restart voice recording:', error);
                    // Try again in 2 seconds
                    setTimeout(() => {
                        this.restartVoiceRecording();
                    }, 2000);
                }
            }
        }, 500);
    }

    createFloatingIndicator() {
        // Create floating recording indicator
        this.floatingIndicator = document.createElement('div');
        this.floatingIndicator.className = 'vf-floating-indicator';
        this.floatingIndicator.innerHTML = `
            <div class="vf-indicator-dot"></div>
            <div class="vf-indicator-text">REC</div>
        `;

        // Get saved position or use defaults
        const savedPosition = this.getSavedFloaterPosition();

        // Add CSS styles
        this.floatingIndicator.style.cssText = `
            position: fixed !important;
            top: ${savedPosition.top}px !important;
            right: ${savedPosition.right}px !important;
            width: 80px !important;
            height: 35px !important;
            background: rgba(102, 126, 234, 0.95) !important;
            color: white !important;
            border-radius: 20px !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 999999 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            backdrop-filter: blur(10px) !important;
            border: 2px solid rgba(255,255,255,0.3) !important;
            cursor: move !important;
            transition: none !important;
            user-select: none !important;
        `;

        // Style the dot
        const dot = this.floatingIndicator.querySelector('.vf-indicator-dot');
        if (dot) {
            dot.style.cssText = `
                width: 8px !important;
                height: 8px !important;
                background: white !important;
                border-radius: 50% !important;
                animation: vf-pulse 1s infinite !important;
            `;
        }

        // Add pulsing animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes vf-pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.6; transform: scale(1.2); }
                100% { opacity: 1; transform: scale(1); }
            }
            @keyframes vf-slow-pulse {
                0% { opacity: 0.7; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
                100% { opacity: 0.7; transform: scale(1); }
            }
            .vf-floating-indicator:hover {
                transform: scale(1.05) !important;
                background: rgba(102, 126, 234, 1) !important;
            }
            .vf-floating-indicator.dragging {
                transform: scale(1.1) !important;
                box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important;
                transition: none !important;
            }
        `;
        document.head.appendChild(style);

        // Initialize drag functionality
        this.initializeDrag();

        // Add to page (initially hidden)
        document.body.appendChild(this.floatingIndicator);
    }

    getSavedFloaterPosition() {
        try {
            const saved = localStorage.getItem('vf-floater-position');
            if (saved) {
                const position = JSON.parse(saved);
                // Validate position is within screen bounds
                if (position.top >= 0 && position.top <= window.innerHeight - 50 &&
                    position.right >= 0 && position.right <= window.innerWidth - 100) {
                    return position;
                }
            }
        } catch (e) {
            console.log('Could not load saved floater position:', e);
        }
        // Return default position
        return { top: 20, right: 20 };
    }

    saveFloaterPosition() {
        if (!this.floatingIndicator) return;

        const rect = this.floatingIndicator.getBoundingClientRect();
        const position = {
            top: rect.top,
            right: window.innerWidth - rect.right
        };

        try {
            localStorage.setItem('vf-floater-position', JSON.stringify(position));
        } catch (e) {
            console.log('Could not save floater position:', e);
        }
    }

    initializeDrag() {
        if (!this.floatingIndicator) return;

        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        let dragTimeout = null;

        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Clear any existing timeout to prevent click event
            if (dragTimeout) {
                clearTimeout(dragTimeout);
                dragTimeout = null;
            }

            isDragging = true;
            this.floatingIndicator.classList.add('dragging');

            const rect = this.floatingIndicator.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();

            let newX = e.clientX - dragOffset.x;
            let newY = e.clientY - dragOffset.y;

            // Keep within screen bounds
            const maxX = window.innerWidth - this.floatingIndicator.offsetWidth;
            const maxY = window.innerHeight - this.floatingIndicator.offsetHeight;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            this.floatingIndicator.style.left = newX + 'px';
            this.floatingIndicator.style.top = newY + 'px';
            this.floatingIndicator.style.right = 'auto';
        };

        const onMouseUp = (e) => {
            if (!isDragging) return;

            isDragging = false;
            this.floatingIndicator.classList.remove('dragging');

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Save new position
            this.saveFloaterPosition();

            // Prevent click event from firing after drag
            dragTimeout = setTimeout(() => {
                dragTimeout = null;
            }, 100);
        };

        const onClick = (e) => {
            // Only show status if we're not in the middle of a drag operation
            if (!dragTimeout && !isDragging) {
                this.showRecordingStatus();
            }
        };

        this.floatingIndicator.addEventListener('mousedown', onMouseDown);
        this.floatingIndicator.addEventListener('click', onClick);
    }

    showFloatingIndicator(recording = false) {
        if (!this.floatingIndicator) {
            this.createFloatingIndicator();
        }

        if (this.floatingIndicator) {
            this.floatingIndicator.style.display = 'flex';

            if (recording) {
                // Active recording state - red with pulsing
                this.floatingIndicator.style.background = 'rgba(229, 62, 62, 0.95)';
                const textElement = this.floatingIndicator.querySelector('.vf-indicator-text');
                const dotElement = this.floatingIndicator.querySelector('.vf-indicator-dot');

                if (textElement) textElement.textContent = 'REC';
                if (dotElement) dotElement.style.animation = 'vf-pulse 1s infinite';
            } else {
                // Ready state - blue without pulsing
                this.floatingIndicator.style.background = 'rgba(102, 126, 234, 0.9)';
                const textElement = this.floatingIndicator.querySelector('.vf-indicator-text');
                const dotElement = this.floatingIndicator.querySelector('.vf-indicator-dot');

                if (textElement) textElement.textContent = 'READY';
                if (dotElement) dotElement.style.animation = 'none';
            }

            // Ensure position is still within bounds after window resize
            this.validateFloaterPosition();
        }
    }

    validateFloaterPosition() {
        if (!this.floatingIndicator) return;

        const rect = this.floatingIndicator.getBoundingClientRect();
        const maxX = window.innerWidth - this.floatingIndicator.offsetWidth;
        const maxY = window.innerHeight - this.floatingIndicator.offsetHeight;

        let needsUpdate = false;
        let newX = rect.left;
        let newY = rect.top;

        if (rect.left < 0) {
            newX = 0;
            needsUpdate = true;
        } else if (rect.left > maxX) {
            newX = maxX;
            needsUpdate = true;
        }

        if (rect.top < 0) {
            newY = 0;
            needsUpdate = true;
        } else if (rect.top > maxY) {
            newY = maxY;
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.floatingIndicator.style.left = newX + 'px';
            this.floatingIndicator.style.top = newY + 'px';
            this.floatingIndicator.style.right = 'auto';
            this.saveFloaterPosition();
        }
    }

    setupWindowResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce resize events to avoid excessive position updates
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.validateFloaterPosition();
            }, 250);
        });
    }

    hideFloatingIndicator() {
        if (this.floatingIndicator) {
            this.floatingIndicator.style.display = 'none';
        }
    }

    showPermissionPrompt() {
        // Create permission prompt popup
        const permissionPopup = document.createElement('div');
        permissionPopup.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            padding: 20px !important;
            background: rgba(239, 68, 68, 0.95) !important;
            color: white !important;
            border-radius: 12px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            z-index: 9999999 !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
            backdrop-filter: blur(10px) !important;
            border: 2px solid rgba(255,255,255,0.3) !important;
            max-width: 300px !important;
            text-align: center !important;
        `;
        permissionPopup.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">🎤 Microphone Access Required</div>
            <div style="margin-bottom: 12px;">To use "Hey Dom" wake word, please:</div>
            <div style="margin-bottom: 8px;">1. Click the extension icon</div>
            <div style="margin-bottom: 12px;">2. Click "Start Recording" to grant permissions</div>
            <div style="font-size: 11px; opacity: 0.8;">This popup will disappear automatically</div>
        `;

        document.body.appendChild(permissionPopup);

        // Remove after 8 seconds
        setTimeout(() => {
            if (permissionPopup.parentNode) {
                permissionPopup.remove();
            }
        }, 8000);
    }

    showRecordingStatus() {
        // Create temporary status popup
        const statusPopup = document.createElement('div');
        statusPopup.style.cssText = `
            position: fixed !important;
            top: 70px !important;
            right: 20px !important;
            padding: 12px 16px !important;
            background: rgba(45, 55, 72, 0.95) !important;
            color: white !important;
            border-radius: 8px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 12px !important;
            z-index: 999999 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            backdrop-filter: blur(10px) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
            max-width: 200px !important;
        `;
        statusPopup.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">VoiceForward Wake Word Active</div>
            <div style="font-size: 11px; opacity: 0.8;">Say "Hey Dom" followed by your command</div>
            <div style="font-size: 10px; opacity: 0.6; margin-top: 2px;">Say "stop recording" to end</div>
        `;

        document.body.appendChild(statusPopup);

        // Remove after 3 seconds
        setTimeout(() => {
            if (statusPopup.parentNode) {
                statusPopup.remove();
            }
        }, 3000);
    }

    async checkActivationState() {
        console.log('Checking activation state from background...');

        try {
            // Check if we should be in activated mode from background state
            const response = await chrome.runtime.sendMessage({ type: 'getRecordingState' });
            if (response && response.isActivated) {
                console.log('Restoring activated state from background');
                this.isActivated = true;
                this.showFloatingIndicator(true); // Show REC
            } else {
                console.log('Starting in ready mode');
                this.isActivated = false;
                this.showFloatingIndicator(false); // Show READY
            }

            // Enable auto-restart and start listening
            this.shouldAutoRestart = true;

            // Wait a moment for page to settle, then start listening
            setTimeout(() => {
                if (!this.isListening && this.recognition) {
                    try {
                        this.recognition.start();
                        console.log('Voice recognition started, activation state:', this.isActivated);
                    } catch (error) {
                        console.error('Failed to start voice recognition:', error);
                        // Retry in 2 seconds
                        setTimeout(() => {
                            this.checkActivationState();
                        }, 2000);
                    }
                }
            }, 1000);

        } catch (error) {
            console.log('Could not check activation state:', error);
            // Default to ready mode
            this.isActivated = false;
            this.showFloatingIndicator(false);
            this.shouldAutoRestart = true;

            // Start listening anyway
            setTimeout(() => {
                if (!this.isListening && this.recognition) {
                    try {
                        this.recognition.start();
                        console.log('Voice recognition started in fallback mode');
                    } catch (error) {
                        console.error('Fallback start failed:', error);
                    }
                }
            }, 1000);
        }
    }

    async checkInitialRecordingState() {
        // This method is now replaced by autoStartWakeWordListening
        // but keeping it for compatibility with existing popup behavior
        console.log('Legacy checkInitialRecordingState called');
    }

    // Tab switching functionality
    async switchTab(direction) {
        console.log(`Switching tab ${direction}`);

        try {
            // Send message to background script to handle tab switching
            await chrome.runtime.sendMessage({
                type: 'switchTab',
                direction: direction
            });
        } catch (error) {
            console.error('Failed to switch tab:', error);
        }
    }

    async createNewTab(url = null) {
        console.log('Creating new tab', url ? `with URL: ${url}` : '');

        try {
            // Send message to background script to create new tab
            await chrome.runtime.sendMessage({
                type: 'createNewTab',
                url: url
            });
        } catch (error) {
            console.error('Failed to create new tab:', error);
        }
    }

    async closeCurrentTab() {
        console.log('Closing current tab');

        try {
            // Send message to background script to close current tab
            await chrome.runtime.sendMessage({
                type: 'closeCurrentTab'
            });
        } catch (error) {
            console.error('Failed to close current tab:', error);
        }
    }

    async switchTabAction(action) {
        const direction = action.direction || 'next';
        console.log(`Tab switch action: ${direction}`);
        await this.switchTab(direction);
    }

    async createTabAction(action) {
        const url = action.url || null;
        console.log(`Create tab action:`, url);
        await this.createNewTab(url);
    }

    async closeTabAction() {
        console.log('Close tab action');
        await this.closeCurrentTab();
    }
}

// Initialize content script
const voiceForwardContent = new VoiceForwardContent();