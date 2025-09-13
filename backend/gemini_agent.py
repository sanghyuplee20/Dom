# VoiceForward Gemini Action Planner
# File: gemini_agent.py

import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import BaseOutputParser
from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict
import re

logger = logging.getLogger(__name__)

class ActionPlannerState(TypedDict):
    """State for the action planning workflow"""
    voice_command: str
    page_context: Dict[str, Any]
    command_type: str
    planned_actions: List[Dict[str, Any]]
    confidence_score: float
    error: Optional[str]
    retry_count: int

class WebActionParser(BaseOutputParser):
    """Parse Gemini output into structured web actions"""
    
    def parse(self, text: str) -> List[Dict[str, Any]]:
        try:
            # Clean the text and extract JSON
            cleaned_text = self._extract_json_from_text(text)
            actions = json.loads(cleaned_text)
            
            # Ensure it's a list
            if not isinstance(actions, list):
                actions = [actions]
            
            # Validate and clean each action
            valid_actions = []
            for action in actions:
                if self._validate_action_structure(action):
                    cleaned_action = self._clean_action(action)
                    valid_actions.append(cleaned_action)
            
            return valid_actions
            
        except Exception as e:
            logger.error(f"Failed to parse actions from Gemini: {e}")
            logger.debug(f"Original text: {text}")
            return []
    
    def _extract_json_from_text(self, text: str) -> str:
        """Extract JSON from text that might contain markdown or other formatting"""
        # Remove markdown code blocks
        if "```json" in text:
            json_text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            json_text = text.split("```")[1].strip()
        else:
            json_text = text.strip()
        
        # Try to find JSON array/object in the text
        json_patterns = [
            r'\[.*\]',  # Array
            r'\{.*\}',  # Object
        ]
        
        for pattern in json_patterns:
            match = re.search(pattern, json_text, re.DOTALL)
            if match:
                return match.group(0)
        
        return json_text
    
    def _validate_action_structure(self, action: Dict[str, Any]) -> bool:
        """Validate that an action has the required structure"""
        if not isinstance(action, dict):
            return False
        
        # Must have action type
        if "action" not in action:
            return False
        
        # Action type must be valid
        valid_actions = ["click", "type", "scroll", "wait", "navigate", "hover", "focus"]
        if action["action"].lower() not in valid_actions:
            return False
        
        return True
    
    def _clean_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and standardize an action"""
        cleaned = {
            "action": action["action"].lower(),
            "confidence": action.get("confidence", 0.8)
        }
        
        # Add optional fields if present
        optional_fields = ["target", "text", "selector", "xpath", "coordinates", "wait_time", "direction", "amount", "duration", "url"]
        for field in optional_fields:
            if field in action and action[field] is not None:
                cleaned[field] = action[field]
        
        return cleaned

class GeminiActionPlanner:
    """Main action planner using Google Gemini with LangGraph workflow"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.llm = None
        self.parser = WebActionParser()
        self.graph = None
        self._initialize_llm()
        self._setup_prompts()
        self._setup_graph()
    
    def _initialize_llm(self):
        """Initialize the Gemini LLM"""
        try:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=self.api_key,
                temperature=0.1,
                max_tokens=2000,
                top_p=0.9
            )
            logger.info("Gemini LLM initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            self.llm = None
    
    def _setup_prompts(self):
        """Setup prompt templates for different scenarios"""
        
        # Main action planning prompt
        self.action_planning_prompt = ChatPromptTemplate.from_template("""
You are a web automation expert. Convert voice commands into structured web actions.

AVAILABLE ACTIONS:
1. click - Click an element (requires target description or selector)
2. type - Type text into an input field (requires text and target)
3. scroll - Scroll the page (requires direction: up/down and optional amount)
4. wait - Wait for a specified duration (requires duration in seconds)
5. navigate - Navigate to a URL (requires url)
6. hover - Hover over an element (requires target)
7. focus - Focus on an element (requires target)

CURRENT PAGE CONTEXT:
URL: {url}
Title: {title}
Available Interactive Elements:
{elements_summary}

USER VOICE COMMAND: "{voice_command}"

INSTRUCTIONS:
1. Analyze the voice command and break it into specific, actionable steps
2. Use the available page elements to create precise selectors
3. Return a JSON array of actions in execution order
4. Include confidence scores (0.0-1.0) for each action
5. Be specific with target descriptions

RESPONSE FORMAT (JSON only):
[
  {{
    "action": "click",
    "target": "search input field",
    "selector": "input[type='search']",
    "confidence": 0.9
  }},
  {{
    "action": "type",
    "text": "machine learning",
    "target": "search input field",
    "selector": "input[type='search']",
    "confidence": 0.95
  }}
]

EXAMPLES:

Voice: "search for wireless headphones"
[
  {{"action": "click", "target": "search box", "selector": "input[type='search'], input[name='search'], input[placeholder*='search']", "confidence": 0.9}},
  {{"action": "type", "text": "wireless headphones", "target": "search box", "confidence": 0.95}},
  {{"action": "click", "target": "search button", "selector": "button[type='submit'], input[type='submit'], button:contains('Search')", "confidence": 0.85}}
]

Voice: "scroll down and click the first article"
[
  {{"action": "scroll", "direction": "down", "amount": 300, "confidence": 1.0}},
  {{"action": "wait", "duration": 1, "confidence": 1.0}},
  {{"action": "click", "target": "first article link", "selector": "article:first-child a, .article:first a, h2:first a", "confidence": 0.8}}
]

Voice: "scroll up"
[
  {{"action": "scroll", "direction": "up", "amount": 300, "confidence": 1.0}}
]

Voice: "fill out the contact form with my email"
[
  {{"action": "click", "target": "email input", "selector": "input[type='email'], input[name*='email']", "confidence": 0.9}},
  {{"action": "type", "text": "user@example.com", "target": "email field", "confidence": 0.85}}
]

Return ONLY the JSON array, no additional text:
""")

        # Number-based command prompt
        self.number_command_prompt = ChatPromptTemplate.from_template("""
Convert voice commands using numbered elements into specific actions.

NUMBERED ELEMENTS ON PAGE:
{numbered_elements}

USER COMMAND: "{voice_command}"

Convert to structured actions. Extract numbers and actions from the command.

EXAMPLES:
"click number 1 and type hello in number 3"
[
  {{"action": "click", "target": "element_1", "selector": "[data-voice-number='1']", "confidence": 1.0}},
  {{"action": "type", "text": "hello", "target": "element_3", "selector": "[data-voice-number='3']", "confidence": 1.0}}
]

"scroll down and then click number 5"
[
  {{"action": "scroll", "direction": "down", "amount": 300, "confidence": 1.0}},
  {{"action": "click", "target": "element_5", "selector": "[data-voice-number='5']", "confidence": 1.0}}
]

Return ONLY the JSON array:
""")

        # Command classification prompt
        self.command_classification_prompt = ChatPromptTemplate.from_template("""
Analyze the user's voice command and classify it into one of these types:

COMMAND TYPES:
1. "show_numbers" - User wants to see numbered elements on the page
2. "number_command" - User is referring to numbered elements (e.g., "click number 3")
3. "navigation" - User wants to navigate to a website or URL
4. "action_planning" - User wants to perform actions on the current page

USER COMMAND: "{voice_command}"

CLASSIFICATION RULES:
- "show_numbers": Commands like "show numbers", "display numbers", "number mode"
- "number_command": Commands mentioning specific numbers like "click 1", "number 5", "press two"
- "navigation": Commands like "go to youtube.com", "visit google", "open facebook", "navigate to amazon"
- "action_planning": All other commands for page interactions

EXAMPLES:
"show me the numbers" → "show_numbers"
"click number 3" → "number_command"
"go to youtube.com" → "navigation"
"search for shoes" → "action_planning"
"visit google" → "navigation"
"click the login button" → "action_planning"

Return ONLY the classification type as a single word: show_numbers, number_command, navigation, or action_planning
""")

        # Navigation URL extraction prompt
        self.navigation_extraction_prompt = ChatPromptTemplate.from_template("""
Extract the target website or URL from the user's navigation command and normalize it.

USER COMMAND: "{voice_command}"

RULES:
1. Extract the website name or URL mentioned
2. Add appropriate protocol (https://) if missing
3. Add www. if it's a common domain without subdomain
4. Handle common site names (youtube → youtube.com, google → google.com, etc.)

EXAMPLES:
"go to youtube.com" → "https://www.youtube.com"
"visit google" → "https://www.google.com"
"open facebook.com" → "https://www.facebook.com"
"navigate to amazon" → "https://www.amazon.com"
"go to reddit.com" → "https://www.reddit.com"
"visit github.com" → "https://github.com"

Return ONLY the normalized URL as a string.
""")
    
    def _setup_graph(self):
        """Setup LangGraph workflow"""
        workflow = StateGraph(ActionPlannerState)
        
        # Add nodes
        workflow.add_node("analyze_command", self._analyze_command)
        workflow.add_node("plan_actions", self._plan_actions)
        workflow.add_node("validate_actions", self._validate_actions)
        workflow.add_node("retry_planning", self._retry_planning)
        workflow.add_node("handle_error", self._handle_error)
        
        # Set entry point
        workflow.set_entry_point("analyze_command")
        
        # Add edges
        workflow.add_edge("analyze_command", "plan_actions")
        workflow.add_edge("retry_planning", "plan_actions")
        workflow.add_edge("handle_error", END)
        
        # Conditional edges
        workflow.add_conditional_edges(
            "plan_actions",
            self._should_retry,
            {
                "retry": "retry_planning",
                "validate": "validate_actions",
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "validate_actions",
            self._should_finish,
            {
                "finish": END,
                "retry": "retry_planning",
                "error": "handle_error"
            }
        )
        
        self.graph = workflow.compile()
    
    async def _analyze_command(self, state: ActionPlannerState) -> ActionPlannerState:
        """Analyze the command to determine the best planning approach"""
        command = state["voice_command"].lower()
        
        # Detect command type
        if "number" in command and any(str(i) in command for i in range(1, 21)):
            state["command_type"] = "numbered"
        else:
            state["command_type"] = "natural"
        
        # Initialize other state values
        state["retry_count"] = 0
        state["confidence_score"] = 0.0
        state["planned_actions"] = []
        state["error"] = None
        
        return state
    
    async def _plan_actions(self, state: ActionPlannerState) -> ActionPlannerState:
        """Plan actions using Gemini"""
        try:
            if state["command_type"] == "numbered":
                prompt = self.number_command_prompt
                context = {
                    "numbered_elements": self._format_numbered_elements(state["page_context"]),
                    "voice_command": state["voice_command"]
                }
            else:
                prompt = self.action_planning_prompt
                context = {
                    "url": state["page_context"].get("url", ""),
                    "title": state["page_context"].get("title", ""),
                    "elements_summary": self._create_elements_summary(state["page_context"]),
                    "voice_command": state["voice_command"]
                }
            
            # Get response from Gemini
            response = await self.llm.ainvoke(prompt.format(**context))
            
            # Parse actions
            actions = self.parser.parse(response.content)
            
            if actions:
                state["planned_actions"] = actions
                state["confidence_score"] = sum(a.get("confidence", 0.8) for a in actions) / len(actions)
            else:
                state["error"] = "No valid actions generated"
            
        except Exception as e:
            state["error"] = f"Planning failed: {str(e)}"
            logger.error(f"Action planning error: {e}")
        
        return state
    
    async def _validate_actions(self, state: ActionPlannerState) -> ActionPlannerState:
        """Validate the planned actions"""
        actions = state["planned_actions"]
        page_context = state["page_context"]
        
        if not actions:
            state["error"] = "No actions to validate"
            return state
        
        validated_actions = []
        total_confidence = 0
        
        for action in actions:
            # Basic validation
            if self._is_action_valid(action, page_context):
                validated_actions.append(action)
                total_confidence += action.get("confidence", 0.8)
            else:
                # Try to fix the action
                fixed_action = self._fix_action(action, page_context)
                if fixed_action:
                    validated_actions.append(fixed_action)
                    total_confidence += fixed_action.get("confidence", 0.6)
        
        if validated_actions:
            state["planned_actions"] = validated_actions
            state["confidence_score"] = total_confidence / len(validated_actions)
        else:
            state["error"] = "No valid actions after validation"
        
        return state
    
    async def _retry_planning(self, state: ActionPlannerState) -> ActionPlannerState:
        """Retry planning with simplified approach"""
        state["retry_count"] += 1
        
        # Simplify the command for retry
        simplified_command = self._simplify_command(state["voice_command"])
        state["voice_command"] = simplified_command
        
        logger.info(f"Retrying with simplified command: {simplified_command}")
        return state
    
    async def _handle_error(self, state: ActionPlannerState) -> ActionPlannerState:
        """Handle errors with fallback actions"""
        command = state["voice_command"].lower()
        fallback_actions = []
        
        # Simple fallback patterns
        if "scroll" in command:
            direction = "up" if "up" in command else "down"
            fallback_actions.append({
                "action": "scroll",
                "direction": direction,
                "amount": 300,
                "confidence": 0.8
            })
        elif "click" in command:
            fallback_actions.append({
                "action": "click",
                "target": "first clickable element",
                "selector": "button, a, input[type='submit']",
                "confidence": 0.5
            })
        
        state["planned_actions"] = fallback_actions
        state["confidence_score"] = 0.5
        
        return state
    
    def _should_retry(self, state: ActionPlannerState) -> str:
        """Determine if we should retry planning"""
        if state.get("error") and state["retry_count"] < 2:
            return "retry"
        elif state.get("error"):
            return "error"
        else:
            return "validate"
    
    def _should_finish(self, state: ActionPlannerState) -> str:
        """Determine if we should finish or retry"""
        if state.get("error") and state["retry_count"] < 2:
            return "retry"
        elif state.get("error"):
            return "error"
        else:
            return "finish"
    
    def _create_elements_summary(self, page_context: Dict[str, Any]) -> str:
        """Create a summary of page elements for the prompt"""
        elements = page_context.get("elements", [])
        summary_parts = []
        
        for element in elements[:10]:  # Limit to first 10 elements
            tag = element.get("tag_name", "")
            text = element.get("text_content", "")[:50]
            attrs = element.get("attributes", {})
            
            element_desc = f"- {tag}"
            if text:
                element_desc += f' "{text}"'
            if attrs.get("placeholder"):
                element_desc += f' (placeholder: {attrs["placeholder"]})'
            if attrs.get("class"):
                element_desc += f' (class: {attrs["class"][:30]})'
            
            summary_parts.append(element_desc)
        
        return "\n".join(summary_parts)
    
    def _format_numbered_elements(self, page_context: Dict[str, Any]) -> str:
        """Format numbered elements for prompt"""
        # This would be used when numbers are already showing
        return "Elements are numbered 1-N on the page"
    
    def _is_action_valid(self, action: Dict[str, Any], page_context: Dict[str, Any]) -> bool:
        """Check if an action is valid for the current page"""
        # Basic validation - can be enhanced
        action_type = action.get("action")
        
        if action_type == "scroll":
            return True  # Scroll is always possible
        elif action_type == "wait":
            return True  # Wait is always possible
        elif action_type in ["click", "type", "hover", "focus"]:
            # Check if target elements exist
            return True  # Simplified for now
        
        return False
    
    def _fix_action(self, action: Dict[str, Any], page_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Try to fix an invalid action"""
        # Simplified fixing - can be enhanced
        action["confidence"] = max(0.1, action.get("confidence", 0.8) - 0.2)
        return action
    
    def _simplify_command(self, command: str) -> str:
        """Simplify a command for retry"""
        # Remove complex parts and focus on main action
        simplified = command.lower()
        
        # Extract main action verbs
        if "search" in simplified:
            return "search"
        elif "click" in simplified:
            return "click first button"
        elif "scroll" in simplified:
            if "up" in simplified:
                return "scroll up"
            else:
                return "scroll down"
        elif "type" in simplified or "fill" in simplified:
            return "fill first input"
        
        return simplified
    
    def is_available(self) -> bool:
        """Check if Gemini is available"""
        return self.llm is not None
    
    async def plan_actions(self, voice_command: str, page_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Main method to plan actions for a voice command"""
        if not self.is_available():
            logger.error("Gemini not available")
            return []
        
        initial_state: ActionPlannerState = {
            "voice_command": voice_command,
            "page_context": page_context,
            "command_type": "",
            "planned_actions": [],
            "confidence_score": 0.0,
            "error": None,
            "retry_count": 0
        }
        
        try:
            # Run the workflow
            result = await self.graph.ainvoke(initial_state)
            return result["planned_actions"]
        except Exception as e:
            logger.error(f"Graph execution failed: {e}")
            return []
    
    async def validate_command(self, command: str, page_context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a command without full planning"""
        try:
            # Quick validation
            if not command or not command.strip():
                return {"valid": False, "error": "Empty command"}

            # Check for common patterns
            command_lower = command.lower()
            if any(word in command_lower for word in ["click", "type", "scroll", "search", "fill"]):
                return {
                    "valid": True,
                    "command_type": "action_planning",
                    "confidence": 0.8
                }
            elif "number" in command_lower:
                return {
                    "valid": True,
                    "command_type": "numbered",
                    "confidence": 0.9
                }
            else:
                return {
                    "valid": True,
                    "command_type": "action_planning",
                    "confidence": 0.6,
                    "suggestion": "Try using specific action words like 'click', 'type', or 'scroll'"
                }

        except Exception as e:
            return {"valid": False, "error": str(e)}

    async def analyze_element_importance(self, prompt: str) -> List[int]:
        """Analyze elements and return indices of important ones"""
        try:
            if not self.is_available():
                logger.warning("Gemini not available for element importance analysis")
                return []

            # Create a simple prompt template for element analysis
            analysis_prompt = ChatPromptTemplate.from_template("""
{prompt}

You must respond with ONLY a JSON array of numbers representing the indices of important elements.
For example: [0, 2, 5, 8, 12]

Do not include any other text, explanation, or markdown formatting.
""")

            # Get response from Gemini
            response = await self.llm.ainvoke(analysis_prompt.format(prompt=prompt))

            # Parse the response to extract indices
            content = response.content.strip()

            # Try to extract JSON array from response
            import re
            json_match = re.search(r'\[[\d,\s]*\]', content)
            if json_match:
                indices_json = json_match.group(0)
                indices = json.loads(indices_json)

                # Validate that we got a list of integers
                if isinstance(indices, list) and all(isinstance(i, int) for i in indices):
                    return indices

            logger.warning(f"Could not parse element importance response: {content}")
            return []

        except Exception as e:
            logger.error(f"Element importance analysis failed: {e}")
            return []

    async def classify_command_with_llm(self, voice_command: str) -> str:
        """Classify command using LLM for better natural language understanding"""
        try:
            if not self.is_available():
                logger.warning("Gemini not available for command classification")
                return "action_planning"  # fallback

            # Get response from Gemini
            response = await self.llm.ainvoke(
                self.command_classification_prompt.format(voice_command=voice_command)
            )

            # Parse the response
            classification = response.content.strip().lower()

            # Validate the classification
            valid_classifications = ["show_numbers", "number_command", "navigation", "action_planning"]
            if classification in valid_classifications:
                logger.info(f"LLM classified '{voice_command}' as '{classification}'")
                return classification
            else:
                logger.warning(f"Invalid classification from LLM: {classification}")
                return "action_planning"  # fallback

        except Exception as e:
            logger.error(f"LLM command classification failed: {e}")
            return "action_planning"  # fallback

    async def extract_navigation_url(self, voice_command: str) -> str:
        """Extract and normalize URL from navigation command"""
        try:
            if not self.is_available():
                logger.warning("Gemini not available for URL extraction")
                return self._fallback_url_extraction(voice_command)

            # Get response from Gemini
            response = await self.llm.ainvoke(
                self.navigation_extraction_prompt.format(voice_command=voice_command)
            )

            # Parse the response
            url = response.content.strip()

            # Basic URL validation
            if url.startswith(('http://', 'https://')):
                logger.info(f"LLM extracted URL '{url}' from '{voice_command}'")
                return url
            else:
                logger.warning(f"Invalid URL from LLM: {url}")
                return self._fallback_url_extraction(voice_command)

        except Exception as e:
            logger.error(f"LLM URL extraction failed: {e}")
            return self._fallback_url_extraction(voice_command)

    def _fallback_url_extraction(self, voice_command: str) -> str:
        """Fallback URL extraction using simple patterns"""
        import re

        command_lower = voice_command.lower()

        # Common site mappings
        site_mappings = {
            'youtube': 'https://www.youtube.com',
            'google': 'https://www.google.com',
            'facebook': 'https://www.facebook.com',
            'amazon': 'https://www.amazon.com',
            'twitter': 'https://www.twitter.com',
            'instagram': 'https://www.instagram.com',
            'reddit': 'https://www.reddit.com',
            'github': 'https://github.com',
            'linkedin': 'https://www.linkedin.com',
            'netflix': 'https://www.netflix.com',
        }

        # Check for direct site mentions
        for site, url in site_mappings.items():
            if site in command_lower:
                return url

        # Look for .com/.org/.net patterns
        url_pattern = r'([a-zA-Z0-9-]+\.(?:com|org|net|edu|gov|io|co|ly))'
        match = re.search(url_pattern, command_lower)
        if match:
            domain = match.group(1)
            return f"https://www.{domain}" if not domain.startswith('www.') else f"https://{domain}"

        # Default fallback
        return "https://www.google.com"