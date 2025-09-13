# VoiceForward Action Validator and Fallback Handler
# File: action_validator.py

import logging
import re
from typing import List, Dict, Any, Optional
from models import DOMElement, Action, CommandRequest

logger = logging.getLogger(__name__)

class ActionValidator:
    """Validates planned actions against page context and DOM elements"""
    
    def __init__(self):
        self.valid_actions = ['click', 'type', 'scroll', 'wait', 'navigate', 'hover', 'focus']
    
    def validate_actions(self, actions: List[Dict[str, Any]], dom_elements: List[DOMElement]) -> List[Dict[str, Any]]:
        """Validate a list of actions against available DOM elements"""
        validated_actions = []
        
        for action in actions:
            validated_action = self.validate_single_action(action, dom_elements)
            if validated_action:
                validated_actions.append(validated_action)
            else:
                # Try to repair the action
                repaired_action = self._repair_action(action, dom_elements)
                if repaired_action:
                    validated_actions.append(repaired_action)
                else:
                    logger.warning(f"Could not validate or repair action: {action}")
        
        return validated_actions
    
    def validate_single_action(self, action: Dict[str, Any], dom_elements: List[DOMElement]) -> Optional[Dict[str, Any]]:
        """Validate a single action"""
        try:
            # Check action type
            action_type = action.get("action", "").lower()
            if action_type not in self.valid_actions:
                logger.warning(f"Invalid action type: {action_type}")
                return None
            
            # Validate based on action type
            if action_type in ['click', 'hover', 'focus']:
                return self._validate_target_action(action, dom_elements)
            elif action_type == 'type':
                return self._validate_type_action(action, dom_elements)
            elif action_type == 'scroll':
                return self._validate_scroll_action(action)
            elif action_type == 'wait':
                return self._validate_wait_action(action)
            elif action_type == 'navigate':
                return self._validate_navigate_action(action)
            
            return action
            
        except Exception as e:
            logger.error(f"Error validating action: {e}")
            return None
    
    def _validate_target_action(self, action: Dict[str, Any], dom_elements: List[DOMElement]) -> Optional[Dict[str, Any]]:
        """Validate actions that target specific elements (click, hover, focus)"""
        target = action.get("target", "")
        selector = action.get("selector", "")
        
        # Try to find matching element
        matching_element = self._find_matching_element(target, selector, dom_elements)
        
        if matching_element:
            # Enhance action with better selector
            enhanced_action = action.copy()
            enhanced_action["validated_selector"] = self._generate_reliable_selector(matching_element)
            enhanced_action["element_id"] = id(matching_element)
            enhanced_action["confidence"] = min(1.0, action.get("confidence", 0.8) + 0.1)
            return enhanced_action
        else:
            # Lower confidence if no exact match
            action["confidence"] = max(0.1, action.get("confidence", 0.8) - 0.3)
            return action
    
    def _validate_type_action(self, action: Dict[str, Any], dom_elements: List[DOMElement]) -> Optional[Dict[str, Any]]:
        """Validate type actions"""
        if "text" not in action:
            logger.warning("Type action missing text field")
            return None
        
        # Find input elements
        input_elements = [
            el for el in dom_elements 
            if el.tag_name.lower() in ['input', 'textarea'] 
            or el.attributes.get('contenteditable') == 'true'
        ]
        
        if not input_elements:
            logger.warning("No input elements found for type action")
            action["confidence"] = 0.3
            return action
        
        # Try to match with target description
        target = action.get("target", "")
        selector = action.get("selector", "")
        
        matching_element = self._find_matching_element(target, selector, input_elements)
        
        if matching_element:
            enhanced_action = action.copy()
            enhanced_action["validated_selector"] = self._generate_reliable_selector(matching_element)
            enhanced_action["element_id"] = id(matching_element)
            enhanced_action["confidence"] = min(1.0, action.get("confidence", 0.8) + 0.1)
            return enhanced_action
        
        return action
    
    def _validate_scroll_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Validate scroll actions"""
        # Scroll actions are generally always valid
        enhanced_action = action.copy()
        
        # Set default values if missing
        if "direction" not in enhanced_action:
            enhanced_action["direction"] = "down"
        
        if "amount" not in enhanced_action:
            enhanced_action["amount"] = 300
        
        enhanced_action["confidence"] = 1.0
        return enhanced_action
    
    def _validate_wait_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Validate wait actions"""
        enhanced_action = action.copy()
        
        # Set default duration if missing
        if "duration" not in enhanced_action:
            enhanced_action["duration"] = 1.0
        
        # Ensure duration is reasonable
        duration = enhanced_action["duration"]
        if duration < 0.1:
            enhanced_action["duration"] = 0.1
        elif duration > 10.0:
            enhanced_action["duration"] = 10.0
        
        enhanced_action["confidence"] = 1.0
        return enhanced_action
    
    def _validate_navigate_action(self, action: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Validate navigate actions"""
        if "url" not in action:
            logger.warning("Navigate action missing URL")
            return None
        
        url = action["url"]
        
        # Basic URL validation
        if not (url.startswith("http://") or url.startswith("https://") or url.startswith("/")):
            logger.warning(f"Invalid URL format: {url}")
            return None
        
        enhanced_action = action.copy()
        enhanced_action["confidence"] = 0.9
        return enhanced_action
    
    def _find_matching_element(self, target: str, selector: str, elements: List[DOMElement]) -> Optional[DOMElement]:
        """Find DOM element that matches target description or selector"""
        
        # Strategy 1: Try CSS selector first
        if selector:
            for element in elements:
                if self._matches_selector(element, selector):
                    return element
        
        # Strategy 2: Match by text content
        if target:
            target_lower = target.lower()
            for element in elements:
                if element.text_content and target_lower in element.text_content.lower():
                    return element
        
        # Strategy 3: Match by attributes
        if target:
            for element in elements:
                if self._matches_target_description(element, target):
                    return element
        
        return None
    
    def _matches_selector(self, element: DOMElement, selector: str) -> bool:
        """Check if element matches CSS selector (simplified)"""
        try:
            # Very basic CSS selector matching
            # In production, you'd want a proper CSS selector engine
            
            # Tag name matching
            if selector.lower() == element.tag_name.lower():
                return True
            
            # Class matching
            if selector.startswith("."):
                class_name = selector[1:]
                element_classes = element.attributes.get("class", "").split()
                return class_name in element_classes
            
            # ID matching
            if selector.startswith("#"):
                element_id = element.attributes.get("id", "")
                return selector[1:] == element_id
            
            # Attribute matching [type="text"]
            attr_match = re.match(r'\[(\w+)="([^"]+)"\]', selector)
            if attr_match:
                attr_name, attr_value = attr_match.groups()
                return element.attributes.get(attr_name) == attr_value
            
            return False
            
        except Exception as e:
            logger.error(f"Error matching selector: {e}")
            return False
    
    def _matches_target_description(self, element: DOMElement, target: str) -> bool:
        """Check if element matches target description"""
        target_lower = target.lower()
        
        # Check common descriptions
        if "button" in target_lower and element.tag_name.lower() == "button":
            return True
        
        if "input" in target_lower and element.tag_name.lower() == "input":
            return True
        
        if "link" in target_lower and element.tag_name.lower() == "a":
            return True
        
        # Check placeholder
        placeholder = element.attributes.get("placeholder", "").lower()
        if placeholder and any(word in placeholder for word in target_lower.split()):
            return True
        
        # Check aria-label
        aria_label = element.attributes.get("aria-label", "").lower()
        if aria_label and any(word in aria_label for word in target_lower.split()):
            return True
        
        return False
    
    def _generate_reliable_selector(self, element: DOMElement) -> str:
        """Generate a reliable CSS selector for an element"""
        selectors = []
        
        # Try ID first
        if element.attributes.get("id"):
            selectors.append(f"#{element.attributes['id']}")
        
        # Try unique attributes
        if element.attributes.get("name"):
            selectors.append(f"{element.tag_name}[name='{element.attributes['name']}']")
        
        if element.attributes.get("data-testid"):
            selectors.append(f"[data-testid='{element.attributes['data-testid']}']")
        
        # Fall back to tag + class
        if element.attributes.get("class"):
            classes = element.attributes["class"].split()
            if classes:
                selectors.append(f"{element.tag_name}.{classes[0]}")
        
        # Ultimate fallback
        if not selectors:
            selectors.append(element.tag_name)
        
        return ", ".join(selectors)
    
    def _repair_action(self, action: Dict[str, Any], dom_elements: List[DOMElement]) -> Optional[Dict[str, Any]]:
        """Try to repair an invalid action"""
        action_type = action.get("action", "").lower()
        
        if action_type == "click":
            # Try to find any clickable element
            clickable_elements = [
                el for el in dom_elements 
                if el.tag_name.lower() in ['button', 'a'] 
                or 'click' in el.attributes.get('onclick', '')
            ]
            
            if clickable_elements:
                repaired_action = action.copy()
                repaired_action["target"] = "clickable element"
                repaired_action["selector"] = "button, a, [onclick]"
                repaired_action["confidence"] = 0.4
                return repaired_action
        
        elif action_type == "type":
            # Try to find any input element
            input_elements = [
                el for el in dom_elements 
                if el.tag_name.lower() in ['input', 'textarea']
            ]
            
            if input_elements:
                repaired_action = action.copy()
                repaired_action["target"] = "input field"
                repaired_action["selector"] = "input, textarea"
                repaired_action["confidence"] = 0.4
                return repaired_action
        
        return None


