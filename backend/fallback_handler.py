import logging
from typing import List, Dict, Any
from models import CommandRequest, Action, ActionSequenceResponse

logger = logging.getLogger(__name__)

class FallbackHandler:
    """Handles fallback scenarios when primary systems fail"""
    
    def __init__(self):
        self.simple_patterns = {
            'scroll_down': ['scroll down', 'scroll', 'page down'],
            'scroll_up': ['scroll up', 'page up', 'go up'],
            'click': ['click', 'press', 'tap'],
            'search': ['search', 'find', 'look for'],
            'type': ['type', 'write', 'fill', 'enter'],
            'back': ['back', 'previous', 'go back'],
            'forward': ['forward', 'next', 'go forward']
        }
    
    async def handle_error(self, request: CommandRequest, error: str) -> ActionSequenceResponse:
        """Handle errors with fallback responses"""
        logger.info(f"Handling error with fallback: {error}")
        
        fallback_actions = self.create_fallback_actions(request.query)
        
        return ActionSequenceResponse(
            command_type="action_sequence",
            original_command=request.query,
            actions=fallback_actions,
            total_actions=len(fallback_actions),
            estimated_duration=sum(action.wait_time for action in fallback_actions),
            confidence_score=0.5,
            fallback_used=True,
            error_message=f"Primary system failed: {error}. Using fallback."
        )
    
    def create_fallback_actions(self, command: str) -> List[Action]:
        """Create simple fallback actions based on command"""
        command_lower = command.lower()
        actions = []
        
        # Try to match simple patterns
        for pattern_type, patterns in self.simple_patterns.items():
            for pattern in patterns:
                if pattern in command_lower:
                    action = self._create_pattern_action(pattern_type, command)
                    if action:
                        actions.append(action)
                    break
            if actions:  # Stop after first match
                break
        
        # If no patterns matched, create a generic action
        if not actions:
            actions.append(self._create_generic_action(command))
        
        return actions
    
    def _create_pattern_action(self, pattern_type: str, command: str) -> Action:
        """Create action based on recognized pattern"""
        base_action = {
            "id": f"fallback_{pattern_type}",
            "confidence": 0.6,
            "wait_time": 0.5,
            "sequence_order": 1
        }
        
        if pattern_type == 'scroll_down':
            return Action(
                action="scroll",
                target="page",
                **base_action,
                **{"direction": "down", "amount": 300}
            )
        
        elif pattern_type == 'scroll_up':
            return Action(
                action="scroll",
                target="page",
                **base_action,
                **{"direction": "up", "amount": 300}
            )
        
        elif pattern_type == 'click':
            return Action(
                action="click",
                target="first clickable element",
                selector="button, a, input[type='submit'], [role='button']",
                **base_action
            )
        
        elif pattern_type == 'search':
            # Extract search term from command
            search_term = self._extract_search_term(command)
            return Action(
                action="type",
                target="search field",
                text=search_term,
                selector="input[type='search'], input[name*='search'], input[placeholder*='search']",
                **base_action
            )
        
        elif pattern_type == 'type':
            # Extract text to type
            text_to_type = self._extract_text_to_type(command)
            return Action(
                action="type",
                target="input field",
                text=text_to_type,
                selector="input:not([type='hidden']), textarea",
                **base_action
            )
        
        elif pattern_type == 'back':
            return Action(
                action="navigate",
                target="previous page",
                **base_action,
                **{"direction": "back"}
            )
        
        elif pattern_type == 'forward':
            return Action(
                action="navigate",
                target="next page",
                **base_action,
                **{"direction": "forward"}
            )
        
        return self._create_generic_action(command)
    
    def _create_generic_action(self, command: str) -> Action:
        """Create a generic wait action when nothing else matches"""
        return Action(
            id="fallback_generic",
            action="wait",
            target="system",
            duration=1.0,
            confidence=0.3,
            wait_time=1.0,
            sequence_order=1
        )
    
    def _extract_search_term(self, command: str) -> str:
        """Extract search term from search command"""
        command_lower = command.lower()
        
        # Remove common search prefixes
        prefixes = ['search for', 'search', 'find', 'look for']
        for prefix in prefixes:
            if command_lower.startswith(prefix):
                return command[len(prefix):].strip()
        
        # If no prefix found, return the whole command
        return command.strip()
    
    def _extract_text_to_type(self, command: str) -> str:
        """Extract text to type from type command"""
        command_lower = command.lower()
        
        # Remove common type prefixes
        prefixes = ['type', 'write', 'fill', 'enter']
        for prefix in prefixes:
            if command_lower.startswith(prefix):
                remaining = command[len(prefix):].strip()
                # Remove common conjunctions
                if remaining.startswith('in '):
                    remaining = remaining[3:]
                return remaining
        
        return command.strip()
    
    def create_simple_actions(self, command: str) -> List[Dict[str, Any]]:
        """Create simple actions dictionary format (for compatibility)"""
        actions = self.create_fallback_actions(command)
        return [action.dict() for action in actions]
        