# VoiceForward Backend - Complete System
# File: main.py

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
import json
import asyncio
import logging
import os
from datetime import datetime
import uuid

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import our custom modules
from models import (
    CommandRequest, 
    CommandResponse, 
    DOMElement, 
    Action, 
    ShowNumbersResponse,
    ActionSequenceResponse
)
from gemini_agent import GeminiActionPlanner
from action_validator import ActionValidator
from fallback_handler import FallbackHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="VoiceForward Backend",
    description="AI-powered voice navigation backend for web accessibility",
    version="1.0.0"
)

# Add CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core components
gemini_planner = GeminiActionPlanner(api_key=os.getenv("GEMINI_API_KEY"))
action_validator = ActionValidator()
fallback_handler = FallbackHandler()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")
    
    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(json.dumps(message))

manager = ConnectionManager()

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "gemini_available": gemini_planner.is_available(),
        "version": "1.0.0"
    }

# Main command processing endpoint
@app.post("/process-command", response_model=Union[ShowNumbersResponse, ActionSequenceResponse])
async def process_command(request: CommandRequest):
    """
    Main endpoint for processing voice commands
    """
    try:
        logger.info(f"Processing command: '{request.query}' for URL: {request.page_context.url}")

        # Step 1: Parse and classify the command using LLM
        command_type = await classify_command_with_llm(request.query)

        logger.info(f"Command classified as: {command_type}")

        if command_type == "show_numbers":
            # Step 2a: Handle "show numbers" command
            return await handle_show_numbers(request)
        elif command_type == "number_command":
            # Step 2b: Handle number-based commands (click on 2, etc.)
            return await handle_number_command(request)
        elif command_type == "navigation":
            # Step 2c: Handle navigation commands
            return await handle_navigation_command(request)
        else:
            # Step 2d: Handle action planning command
            return await handle_action_planning(request)

    except Exception as e:
        logger.error(f"Error processing command: {str(e)}")

        # Return fallback response
        fallback_response = await fallback_handler.handle_error(request, str(e))
        return fallback_response

async def classify_command_with_llm(query: str) -> str:
    """
    Classify the type of command using LLM for better natural language understanding
    """
    try:
        # Use the Gemini agent for classification
        command_type = await gemini_planner.classify_command_with_llm(query)
        return command_type
    except Exception as e:
        logger.error(f"LLM classification failed, using fallback: {e}")
        return classify_command_fallback(query)


def classify_command_fallback(query: str) -> str:
    """
    Fallback classification for when LLM is unavailable
    """
    query_lower = query.lower().strip()

    # Check for "show numbers" variations
    show_numbers_patterns = [
        "show numbers", "show number", "display numbers", "number mode",
        "numbered mode", "show me numbers", "activate numbers", "turn on numbers"
    ]

    for pattern in show_numbers_patterns:
        if pattern in query_lower:
            return "show_numbers"

    # Check for navigation patterns
    navigation_patterns = [
        "go to", "navigate to", "visit", "open",
        "youtube.com", "google.com", "facebook.com"
    ]

    for pattern in navigation_patterns:
        if pattern in query_lower:
            return "navigation"

    # Check for direct number commands (when numbers are already showing)
    import re
    number_patterns = [
        r'\b(click|type|press|select|choose|tap)\s+(on\s+)?(?:number\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b',
        r'\b(number\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b',
        r'\b(\d+)\b'
    ]

    for pattern in number_patterns:
        if re.search(pattern, query_lower):
            return "number_command"

    # Default to action planning
    return "action_planning"

async def filter_important_elements(elements: List[DOMElement], page_url: str, user_query: str = None) -> List[DOMElement]:
    """
    Use AI to filter interactive elements and only return the most important ones
    """
    try:
        if not elements:
            return elements

        # Prepare element data for AI analysis with enhanced context
        element_data = []
        for i, element in enumerate(elements):
            attrs = element.attributes or {}
            full_text = (element.text_content or "").strip()

            element_info = {
                "index": i,
                "tag": element.tag_name,
                "text": full_text[:200],  # Increased text length for better context
                "full_text_length": len(full_text),
                "attributes": {
                    "class": attrs.get("class", ""),
                    "id": attrs.get("id", ""),
                    "type": attrs.get("type", ""),
                    "role": attrs.get("role", ""),
                    "aria-label": attrs.get("aria-label", ""),
                    "href": attrs.get("href", ""),
                    "title": attrs.get("title", ""),
                    "data-testid": attrs.get("data-testid", ""),
                    "placeholder": attrs.get("placeholder", ""),
                    # YouTube and video-specific attributes
                    "itemprop": attrs.get("itemprop", ""),
                    "data-context-item-id": attrs.get("data-context-item-id", ""),
                    "data-video-id": attrs.get("data-video-id", ""),
                    "style": attrs.get("style", "")[:100] if attrs.get("style") else ""
                },
                # Additional context for better decision making
                "has_youtube_patterns": any(pattern in attrs.get("class", "").lower()
                                          for pattern in ["ytd-", "yt-", "video", "thumbnail"]),
                "has_href": bool(attrs.get("href")),
                "text_length": len(full_text)
            }
            element_data.append(element_info)

        # Create AI prompt for importance filtering
        context = f"Page URL: {page_url}"
        if user_query:
            context += f"\nUser context: {user_query}"

        prompt = f"""
{context}

Analyze these interactive elements and identify the most important ones that a user would likely want to interact with. Focus on:
- Primary navigation elements (main menu, key links)
- Core action buttons (submit, login, search, etc.)
- Essential form fields
- Key content interactions
- Video/media content (video thumbnails, play buttons, video titles)
- Content cards/items (articles, posts, products, videos)
- Interactive content elements (like, share, comment buttons)

For video platforms like YouTube:
- Video thumbnails and titles should be labeled
- Channel links and names
- Playlist items
- Subscribe, like, share buttons
- Video player controls

Avoid labeling:
- Pure decorative elements
- Advertisement banners (but not content ads)
- Minor utility buttons that aren't primary actions
- Duplicate elements

Elements to analyze:
{json.dumps(element_data, indent=2)}

Return indices of important elements as a JSON array (aim for 15-25 elements). For example: [0, 2, 5, 8, 11, 14]
"""

        # Use Gemini to analyze element importance
        important_indices = await gemini_planner.analyze_element_importance(prompt)

        # If AI analysis fails, fall back to heuristic filtering
        if not important_indices:
            important_indices = heuristic_important_elements(elements)

        # Filter elements based on AI/heuristic results
        filtered_elements = []
        for idx in important_indices:
            if 0 <= idx < len(elements):
                filtered_elements.append(elements[idx])

        # Ensure we don't return too many elements (max 25 for better coverage)
        if len(filtered_elements) > 25:
            filtered_elements = filtered_elements[:25]

        return filtered_elements

    except Exception as e:
        logger.warning(f"AI filtering failed: {str(e)}, falling back to heuristic")
        # Fallback to heuristic filtering
        important_indices = heuristic_important_elements(elements)
        filtered_elements = []
        for idx in important_indices:
            if 0 <= idx < len(elements):
                filtered_elements.append(elements[idx])
        return filtered_elements


def heuristic_important_elements(elements: List[DOMElement], lower_threshold: bool = False) -> List[int]:
    """
    Fallback heuristic method to identify important elements
    Returns indices of important elements
    """
    scored_elements = []

    # Priority scoring system
    for i, element in enumerate(elements):
        score = 0
        tag = element.tag_name.lower()
        text = (element.text_content or "").lower().strip()
        attrs = element.attributes or {}
        class_name = attrs.get("class", "").lower()
        element_id = attrs.get("id", "").lower()

        # High priority elements
        if tag in ["button", "input", "select", "textarea"]:
            score += 10

        if tag == "a" and attrs.get("href"):
            score += 8

        # Important action keywords in text
        important_keywords = [
            "login", "sign in", "register", "signup", "submit", "search",
            "menu", "home", "contact", "about", "buy", "purchase", "cart",
            "checkout", "save", "continue", "next", "back", "cancel",
            # Video/media keywords
            "play", "pause", "watch", "video", "subscribe", "like", "share",
            "comment", "playlist", "channel", "live", "stream"
        ]

        if text and any(keyword in text for keyword in important_keywords):
            score += 15

        # Important class/ID patterns
        important_patterns = [
            "nav", "menu", "button", "btn", "primary", "main", "header",
            "search", "login", "auth", "submit", "cta", "call-to-action",
            # YouTube/video specific patterns
            "video", "thumbnail", "play", "player", "content", "item",
            "card", "tile", "entry", "link", "clickable", "watch",
            "ytd-", "yt-", "video-title", "media", "playlist"
        ]

        if any(pattern in class_name or pattern in element_id for pattern in important_patterns):
            score += 5

        # Special scoring for video/media platforms
        if "youtube.com" in attrs.get("href", "") or "youtu.be" in attrs.get("href", ""):
            score += 12

        # YouTube-specific element detection
        youtube_patterns = [
            "ytd-video-renderer", "ytd-rich-item", "ytd-compact-video",
            "ytd-playlist-renderer", "ytd-channel-renderer", "video-title",
            "thumbnail", "ytd-thumbnail", "yt-simple-endpoint"
        ]

        if any(pattern in class_name or pattern in element_id for pattern in youtube_patterns):
            score += 10
            logger.info(f"DEBUG: YouTube element found - {element.tag_name} class='{class_name}' score={score}")

        # Content elements that are likely clickable (div, span, etc. with clickable indicators)
        if tag in ["div", "span", "section", "article"] and (
            "click" in class_name or
            "link" in class_name or
            "item" in class_name or
            "card" in class_name or
            "tile" in class_name or
            "entry" in class_name or
            "content" in class_name
        ):
            score += 6

        # Form inputs get higher priority
        if tag == "input":
            input_type = attrs.get("type", "").lower()
            if input_type in ["text", "email", "password", "search"]:
                score += 12
            elif input_type in ["submit", "button"]:
                score += 15

        # Penalize elements that seem decorative or secondary
        decorative_patterns = ["icon", "decoration", "ad", "banner", "footer"]
        if any(pattern in class_name for pattern in decorative_patterns):
            score -= 5

        threshold = 3 if lower_threshold else 5  # Even lower threshold for bypass mode
        if score >= threshold:
            scored_elements.append((i, score))

    # Sort by score (descending) and return indices
    scored_elements.sort(key=lambda x: x[1], reverse=True)
    limit = 100 if lower_threshold else 25  # Even more elements when bypassing AI
    return [i for i, score in scored_elements[:limit]]

async def handle_show_numbers(request: CommandRequest) -> ShowNumbersResponse:
    """
    Handle "show numbers" command - identify interactive elements for numbering
    AI-enhanced to only label elements that seem important
    """
    try:
        # Step 1: Filter DOM elements to find interactive ones
        interactive_elements = []

        for element in request.page_context.elements:
            if is_interactive_element(element):
                interactive_elements.append(element)

        logger.info(f"Found {len(interactive_elements)} interactive elements")

        # Step 2: Use AI to filter for important elements only
        # Check if user wants to see all elements (bypass AI filtering)
        user_query = request.query if hasattr(request, 'query') else None
        bypass_ai = user_query and any(phrase in user_query.lower() for phrase in [
            "show all", "all numbers", "every element", "everything", "more elements", "debug"
        ])

        # DEBUG MODE: Log element detection results
        logger.info(f"DEBUG: Found {len(interactive_elements)} interactive elements before filtering")
        if len(interactive_elements) < 5:
            logger.info("DEBUG: Very few interactive elements found - checking first 10 elements:")
            for i, element in enumerate(request.page_context.elements[:10]):
                is_interactive = is_interactive_element(element)
                attrs = element.attributes or {}
                class_name = attrs.get('class', '')
                text = (element.text_content or '')[:50]
                logger.info(f"  Element {i}: {element.tag_name} class='{class_name}' text='{text}' interactive={is_interactive}")

        # If very few interactive elements found, use more lenient detection
        if len(interactive_elements) < 5:
            logger.info("DEBUG: Using lenient detection due to low interactive element count")
            bypass_ai = True

        # Use lenient detection for better coverage
        bypass_ai = True  # Always use heuristic scoring for more reliable results

        if bypass_ai:
            # Use heuristic scoring but with lower threshold to show more elements
            important_indices = heuristic_important_elements(interactive_elements, lower_threshold=True)
            important_elements = []
            for idx in important_indices:
                if 0 <= idx < len(interactive_elements):
                    important_elements.append(interactive_elements[idx])
            logger.info(f"Bypassed AI filtering, showing {len(important_elements)} elements")
        else:
            important_elements = await filter_important_elements(
                interactive_elements,
                request.page_context.url,
                user_query
            )

        logger.info(f"AI filtered to {len(important_elements)} important elements")

        # DEBUG: Log what types of elements we're about to number
        element_types = {}
        for elem in important_elements:
            tag_class = f"{elem.tag_name}.{elem.attributes.get('class', '')[:50] if elem.attributes else ''}"
            element_types[tag_class] = element_types.get(tag_class, 0) + 1
        logger.info(f"DEBUG: Element types to number: {element_types}")

        # Step 3: Number the important elements
        numbered_elements = []
        element_counter = 1

        for element in important_elements:
            numbered_element = {
                "number": element_counter,
                "element": element.dict(),
                "description": generate_element_description(element)
            }
            numbered_elements.append(numbered_element)
            element_counter += 1

        return ShowNumbersResponse(
            command_type="show_numbers",
            numbered_elements=numbered_elements,
            total_elements=len(numbered_elements),
            instructions="Most important interactive elements have been numbered. Say 'click number X' or 'type [text] in number X' to interact."
        )

    except Exception as e:
        logger.error(f"Error in handle_show_numbers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process show numbers: {str(e)}")

async def handle_number_command(request: CommandRequest) -> ActionSequenceResponse:
    """
    Handle number-based commands like "click on 2" or "type hello in 3"
    """
    try:
        import re
        
        query_lower = request.query.lower().strip()
        logger.info(f"Processing number command: {query_lower}")
        
        # Extract numbers and actions from the command
        actions = []
        
        # Pattern to match "click [on] [number] N" where N can be digit or word
        click_pattern = r'\b(click|tap|press|select|choose)\s+(?:on\s+)?(?:number\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b'
        click_matches = re.findall(click_pattern, query_lower)
        
        # Pattern to match "type X [in] [number] N"
        type_pattern = r'\b(type|enter|input)\s+([^,]+?)\s+(?:in|into|on)\s+(?:number\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b'
        type_matches = re.findall(type_pattern, query_lower)
        
        # Convert word numbers to digits
        word_to_num = {
            'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
            'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
        }
        
        # Process click actions
        for action_verb, number_str in click_matches:
            number = word_to_num.get(number_str, number_str)
            actions.append({
                "action": "click",
                "target": f"number_{number}",
                "selector": f"[data-number='{number}']",
                "number_reference": int(number),
                "confidence": 0.95
            })
        
        # Process type actions  
        for action_verb, text, number_str in type_matches:
            number = word_to_num.get(number_str, number_str)
            text = text.strip()
            actions.append({
                "action": "type",
                "text": text,
                "target": f"number_{number}",
                "selector": f"[data-number='{number}']",
                "number_reference": int(number),
                "confidence": 0.95
            })
        
        # If no specific patterns matched, try to extract any number for a generic click
        if not actions:
            number_match = re.search(r'\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b', query_lower)
            if number_match:
                number_str = number_match.group(1)
                number = word_to_num.get(number_str, number_str)
                actions.append({
                    "action": "click",
                    "target": f"number_{number}",
                    "selector": f"[data-number='{number}']", 
                    "number_reference": int(number),
                    "confidence": 0.8
                })
        
        if not actions:
            raise ValueError("Could not extract number-based actions from command")
        
        # Convert to Action objects
        enriched_actions = []
        for i, action in enumerate(actions):
            enriched_action = Action(
                id=str(uuid.uuid4()),
                action=action["action"],
                target=action["target"],
                text=action.get("text", ""),
                selector=action["selector"],
                coordinates=action.get("coordinates"),
                wait_time=0.5,
                sequence_order=i + 1,
                confidence=action["confidence"]
            )
            enriched_actions.append(enriched_action)
        
        logger.info(f"Generated {len(enriched_actions)} number-based actions")
        
        return ActionSequenceResponse(
            command_type="action_sequence",
            original_command=request.query,
            actions=enriched_actions,
            total_actions=len(enriched_actions),
            estimated_duration=sum(action.wait_time for action in enriched_actions),
            confidence_score=sum(action.confidence for action in enriched_actions) / len(enriched_actions),
            instructions="Executing actions on numbered elements"
        )
        
    except Exception as e:
        logger.error(f"Error in handle_number_command: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process number command: {str(e)}")

async def handle_navigation_command(request: CommandRequest) -> ActionSequenceResponse:
    """
    Handle navigation commands like "go to youtube.com"
    """
    try:
        logger.info(f"Processing navigation command: {request.query}")

        # Extract the target URL using LLM
        target_url = await gemini_planner.extract_navigation_url(request.query)

        logger.info(f"Extracted target URL: {target_url}")

        # Create navigation action
        navigation_action = Action(
            id=str(uuid.uuid4()),
            action="navigate",
            target="website",
            text="",
            selector="",
            url=target_url,
            coordinates=None,
            wait_time=2.0,  # Give time for page to load
            sequence_order=1,
            confidence=0.95
        )

        return ActionSequenceResponse(
            command_type="action_sequence",
            original_command=request.query,
            actions=[navigation_action],
            total_actions=1,
            estimated_duration=2.0,
            confidence_score=0.95,
            instructions=f"Navigating to {target_url}"
        )

    except Exception as e:
        logger.error(f"Error in handle_navigation_command: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process navigation command: {str(e)}")

def is_interactive_element(element: DOMElement) -> bool:
    """
    Determine if a DOM element is interactive and should be numbered
    Enhanced version with comprehensive detection logic
    """
    # More lenient visibility check - only skip if explicitly hidden
    if hasattr(element, 'is_visible') and element.is_visible is False:
        # Check if element might still be interactive despite being marked invisible
        attributes = element.attributes or {}
        # Allow elements that might be dynamically shown/hidden
        if not any(attr in attributes for attr in ['style', 'class', 'hidden']):
            return False

    tag_name = element.tag_name.lower()
    attributes = element.attributes or {}
    class_name = attributes.get('class', '').lower()

    # 1. Standard interactive HTML elements
    interactive_tags = [
        'button', 'input', 'textarea', 'select', 'a', 'summary',
        'details', 'option', 'optgroup', 'label', 'form'
    ]

    if tag_name in interactive_tags:
        # Skip hidden inputs and disabled elements
        if tag_name == 'input':
            input_type = attributes.get('type', '').lower()
            if input_type == 'hidden' or attributes.get('disabled'):
                return False
        # Skip disabled elements
        if attributes.get('disabled') or attributes.get('aria-disabled') == 'true':
            return False
        return True

    # 2. Elements with interactive ARIA roles
    interactive_roles = [
        'button', 'link', 'textbox', 'combobox', 'tab', 'menuitem',
        'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox',
        'radio', 'slider', 'spinbutton', 'switch', 'tabpanel',
        'treeitem', 'gridcell', 'columnheader', 'rowheader'
    ]

    role = attributes.get('role', '').lower()
    if role in interactive_roles:
        if attributes.get('disabled') or attributes.get('aria-disabled') == 'true':
            return False
        return True

    # 3. Elements with interactive attributes (including modern framework handlers)
    interactive_attributes = [
        'onclick', 'onmousedown', 'onmouseup', 'href', 'tabindex',
        'contenteditable', 'draggable',
        # React event handlers
        'onClick', 'onSubmit', 'onChange', 'onFocus', 'onBlur', 'onKeyDown',
        'onKeyUp', 'onKeyPress', 'onDoubleClick', 'onContextMenu',
        # Vue.js event handlers
        '@click', '@submit', '@change', '@focus', '@blur', '@keydown',
        '@keyup', '@dblclick', '@contextmenu', 'v-on:click', 'v-on:submit',
        # Angular event handlers
        '(click)', '(submit)', '(change)', '(focus)', '(blur)', '(keydown)',
        # Other framework patterns
        'ng-click', 'ng-submit', 'data-ng-click', 'x-on:click', 'wire:click'
    ]

    for attr in interactive_attributes:
        if attr in attributes:
            # Allow elements with tabindex="-1" (programmatically focusable)
            if attr == 'tabindex':
                try:
                    tabindex_val = int(str(attributes.get('tabindex', '0')))
                    # Only skip if tabindex is very negative (likely intentionally hidden)
                    if tabindex_val < -1:
                        continue
                except (ValueError, TypeError):
                    pass
            # Skip non-editable contenteditable
            if attr == 'contenteditable' and attributes.get('contenteditable') == 'false':
                continue
            return True

    # 4. Framework-specific interactive classes
    interactive_class_patterns = [
        # Generic patterns
        'btn', 'button', 'link', 'clickable', 'interactive', 'action',
        # Bootstrap
        'btn-', 'nav-link', 'dropdown-toggle', 'close', 'pagination',
        'list-group-item', 'card-', 'alert', 'badge',
        # Material UI
        'mui', 'mat-button', 'mat-icon-button', 'mat-fab', 'mat-mini-fab',
        'mat-chip', 'mat-tab', 'mat-menu-item',
        # Tailwind
        'cursor-pointer', 'hover:', 'focus:', 'active:',
        # Ant Design
        'ant-btn', 'ant-menu-item', 'ant-tabs-tab', 'ant-select',
        # React/Vue component patterns
        'react-', 'vue-', 'component-',
        # Common patterns
        'click', 'press', 'tap', 'select', 'toggle', 'switch', 'menu',
        'tab', 'accordion', 'dropdown', 'modal', 'popup', 'tooltip',
        # Framework agnostic
        'control', 'widget', 'trigger', 'handle', 'item', 'option',
        # Modern CSS frameworks
        'chakra-', 'mantine-', 'semantic-',
        # Icon libraries that are often clickable
        'fa-', 'icon-', 'feather-', 'lucide-'
    ]

    for pattern in interactive_class_patterns:
        if pattern in class_name:
            return True

    # 4.5. YouTube and video platform specific detection
    youtube_class_patterns = [
        'ytd-video-renderer', 'ytd-rich-item', 'ytd-compact-video',
        'ytd-playlist-renderer', 'ytd-channel-renderer', 'ytd-thumbnail',
        'yt-simple-endpoint', 'video-title', 'ytd-rich-grid-media',
        'ytd-rich-item-renderer', 'ytd-video-meta-block', 'ytd-compact-radio-renderer',
        'ytd-compact-playlist-renderer', 'ytd-grid-video-renderer',
        # Other video platforms
        'video-item', 'video-card', 'video-thumbnail', 'media-item',
        'content-tile', 'watch-card', 'video-link', 'playlist-item'
    ]

    # Check for YouTube/video platform specific classes
    for pattern in youtube_class_patterns:
        if pattern in class_name:
            return True

    # Check for video-related data attributes
    video_data_attrs = [
        'data-video-id', 'data-context-item-id', 'data-sessionlink',
        'data-ytid', 'data-vid', 'data-video-url'
    ]

    for attr in video_data_attrs:
        if attr in attributes:
            return True

    # 5. Custom elements and web components (often interactive)
    if '-' in tag_name and tag_name not in ['input', 'select', 'textarea']:
        # Common interactive custom element patterns
        interactive_custom_patterns = [
            'button', 'btn', 'icon', 'fab', 'chip', 'tab', 'menu',
            'toggle', 'switch', 'slider', 'card', 'tile', 'item',
            'option', 'picker', 'selector', 'trigger', 'action'
        ]
        for pattern in interactive_custom_patterns:
            if pattern in tag_name:
                return True
        # Assume most custom elements are interactive unless proven otherwise
        return True

    # 6. Elements with cursor pointer style (if available)
    style = attributes.get('style', '').lower()
    if 'cursor:pointer' in style.replace(' ', '') or 'cursor: pointer' in style:
        return True

    # 7. Data attributes suggesting interactivity
    interactive_data_attrs = [
        'data-toggle', 'data-dismiss', 'data-target', 'data-action',
        'data-click', 'data-href', 'data-url', 'data-link', 'data-command'
    ]

    for attr in interactive_data_attrs:
        if attr in attributes:
            return True

    # 8. Elements that commonly receive click handlers via JS
    # (expanded to catch more interactive containers)
    potentially_interactive_tags = ['div', 'span', 'img', 'i', 'svg', 'path',
                                   'section', 'article', 'header', 'footer',
                                   'nav', 'aside', 'main', 'figure', 'li',
                                   'tr', 'td', 'th', 'p', 'h1', 'h2', 'h3',
                                   'h4', 'h5', 'h6']

    if tag_name in potentially_interactive_tags:
        # AGGRESSIVE YOUTUBE DETECTION: If this looks like a YouTube video element, include it
        page_is_youtube = "youtube.com" in str(attributes.get("href", "")).lower() if attributes else False
        if (any(yt_class in class_name for yt_class in ["ytd-", "yt-"]) or
            any(video_word in class_name for video_word in ["video", "thumbnail", "watch"]) or
            any(attr_name in attributes for attr_name in ["data-video-id", "data-context-item-id"]) if attributes else False or
            page_is_youtube):
            return True
        # Check for common interactive indicators
        text_content = (element.text_content or '').lower().strip()
        interactive_text_patterns = [
            'click', 'tap', 'press', 'select', 'choose', 'submit',
            'cancel', 'close', 'open', 'show', 'hide', 'toggle',
            'next', 'previous', 'back', 'forward', 'more', 'less',
            'login', 'signup', 'register', 'subscribe', 'download',
            'play', 'pause', 'stop', 'edit', 'delete', 'remove',
            'add', 'create', 'new', 'save', 'update', 'refresh',
            'search', 'filter', 'sort', 'view', 'expand', 'collapse'
        ]

        # If element has suggestive text content
        if text_content and any(pattern in text_content for pattern in interactive_text_patterns):
            return True

        # If element has ID suggesting interactivity
        element_id = attributes.get('id', '').lower()
        if element_id and any(pattern in element_id for pattern in interactive_text_patterns):
            return True

        # Check if it's an icon element (often clickable)
        if tag_name in ['i', 'svg'] or 'icon' in class_name:
            return True

        # Check if it looks like a card or tile (often clickable)
        if any(pattern in class_name for pattern in ['card', 'tile', 'item', 'row']):
            return True

        # Special case for YouTube video content - if it has substantial text content
        # and YouTube-style classes, it's likely a video title/thumbnail
        if (text_content and len(text_content) > 10 and
            any(yt_pattern in class_name for yt_pattern in [
                'ytd-', 'yt-', 'video', 'watch', 'content', 'title', 'thumbnail'
            ])):
            return True

    # 9. Elements with ARIA attributes suggesting interactivity
    aria_interactive_attrs = [
        'aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked',
        'aria-haspopup', 'aria-controls'
    ]

    for attr in aria_interactive_attrs:
        if attr in attributes:
            return True

    # 10. Form-related elements
    form_attrs = ['form', 'formaction', 'formmethod', 'formtarget']
    for attr in form_attrs:
        if attr in attributes:
            return True

    # 11. FALLBACK: On YouTube pages, be much more aggressive
    # Any element with meaningful text content gets a chance
    if (element.text_content and len(element.text_content.strip()) > 5 and
        any(pattern in (element.text_content or "").lower() for pattern in
            ["video", "watch", "play", "subscribe", "channel", "playlist", "view", "ago", "minutes", "hours", "days", "weeks", "months", "years"])):
        return True

    return False

def generate_element_description(element: DOMElement) -> str:
    """
    Generate a human-readable description of an element
    """
    descriptions = []
    
    # Add tag type
    tag_descriptions = {
        'button': 'Button',
        'input': 'Input field',
        'textarea': 'Text area',
        'select': 'Dropdown',
        'a': 'Link'
    }
    descriptions.append(tag_descriptions.get(element.tag_name.lower(), element.tag_name))
    
    # Add text content if available
    if element.text_content and element.text_content.strip():
        descriptions.append(f'"{element.text_content.strip()[:30]}"')
    
    # Add placeholder if available
    placeholder = element.attributes.get('placeholder')
    if placeholder:
        descriptions.append(f'(placeholder: {placeholder[:20]})')
    
    # Add aria-label if available
    aria_label = element.attributes.get('aria-label')
    if aria_label:
        descriptions.append(f'(labeled: {aria_label[:20]})')
    
    return ' '.join(descriptions)

async def handle_action_planning(request: CommandRequest) -> ActionSequenceResponse:
    """
    Handle action planning commands using Gemini + LangGraph
    """
    try:
        logger.info(f"Starting action planning for: {request.query}")
        
        # Step 1: Plan actions using Gemini
        planned_actions = await gemini_planner.plan_actions(
            voice_command=request.query,
            page_context=request.page_context.model_dump()
        )
        
        if not planned_actions:
            # Fallback to simple action parsing
            planned_actions = fallback_handler.create_simple_actions(request.query)
        
        # Step 2: Validate actions against page context
        validated_actions = action_validator.validate_actions(
            planned_actions, 
            request.page_context.elements
        )
        
        # Step 3: Add execution metadata
        enriched_actions = []
        for i, action in enumerate(validated_actions):
            enriched_action = Action(
                id=str(uuid.uuid4()),
                action=action["action"],
                target=action.get("target", ""),
                text=action.get("text", ""),
                selector=action.get("selector", ""),
                coordinates=action.get("coordinates"),
                direction=action.get("direction", ""),
                amount=action.get("amount"),
                duration=action.get("duration"),
                wait_time=action.get("wait_time", 0.5),
                sequence_order=i + 1,
                confidence=action.get("confidence", 0.8)
            )
            enriched_actions.append(enriched_action)
        
        logger.info(f"Generated {len(enriched_actions)} validated actions")
        
        return ActionSequenceResponse(
            command_type="action_sequence",
            original_command=request.query,
            actions=enriched_actions,
            total_actions=len(enriched_actions),
            estimated_duration=sum(action.wait_time for action in enriched_actions),
            confidence_score=sum(action.confidence for action in enriched_actions) / len(enriched_actions) if enriched_actions else 0
        )
        
    except Exception as e:
        logger.error(f"Error in action planning: {str(e)}")
        
        # Create fallback response
        fallback_actions = fallback_handler.create_fallback_actions(request.query)
        return ActionSequenceResponse(
            command_type="action_sequence",
            original_command=request.query,
            actions=fallback_actions,
            total_actions=len(fallback_actions),
            estimated_duration=2.0,
            confidence_score=0.5,
            fallback_used=True,
            error_message=f"AI planning failed, using fallback: {str(e)}"
        )

# WebSocket endpoint for real-time communication
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time communication with frontend
    """
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from frontend
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "command":
                # Process command via WebSocket
                request = CommandRequest(**message["data"])
                
                # Send processing status
                await manager.send_message(client_id, {
                    "type": "status",
                    "message": "Processing command...",
                    "timestamp": datetime.now().isoformat()
                })
                
                # Process the command
                response = await process_command(request)
                
                # Send response back
                await manager.send_message(client_id, {
                    "type": "response",
                    "data": response.model_dump(),
                    "timestamp": datetime.now().isoformat()
                })
                
            elif message["type"] == "ping":
                # Respond to ping for connection health
                await manager.send_message(client_id, {
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {str(e)}")
        await manager.send_message(client_id, {
            "type": "error",
            "message": str(e),
            "timestamp": datetime.now().isoformat()
        })
        manager.disconnect(client_id)

# Batch processing endpoint for multiple commands
@app.post("/process-batch")
async def process_batch_commands(requests: List[CommandRequest]):
    """
    Process multiple commands in batch for efficiency
    """
    try:
        results = []
        for request in requests:
            result = await process_command(request)
            results.append(result)
        
        return {
            "batch_id": str(uuid.uuid4()),
            "total_commands": len(requests),
            "results": results,
            "processed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

# Command validation endpoint
@app.post("/validate-command")
async def validate_command(request: CommandRequest):
    """
    Validate a command without executing it
    """
    try:
        command_type = classify_command_fallback(request.query)
        
        if command_type == "show_numbers":
            validation_result = {
                "valid": True,
                "command_type": "show_numbers",
                "confidence": 1.0,
                "estimated_elements": len([e for e in request.page_context.elements if is_interactive_element(e)])
            }
        elif command_type == "number_command":
            validation_result = {
                "valid": True,
                "command_type": "number_command",
                "confidence": 0.95,
                "message": "Number-based command detected"
            }
        else:
            # Quick validation using Gemini
            validation_result = await gemini_planner.validate_command(
                request.query,
                request.page_context.model_dump()
            )
        
        return validation_result
        
    except Exception as e:
        logger.error(f"Command validation error: {str(e)}")
        return {
            "valid": False,
            "error": str(e),
            "suggestion": "Try rephrasing your command or use 'show numbers' mode"
        }

# Statistics endpoint for monitoring
@app.get("/stats")
async def get_statistics():
    """
    Get system statistics and health metrics
    """
    return {
        "active_connections": len(manager.active_connections),
        "gemini_status": "available" if gemini_planner.is_available() else "unavailable",
        "uptime": datetime.now().isoformat(),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", 8000))
    
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,  # Remove in production
        log_level="info"
    )