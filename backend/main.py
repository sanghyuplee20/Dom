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
        
        # Step 1: Parse and classify the command
        command_type = classify_command(request.query)
        
        if command_type == "show_numbers":
            # Step 2a: Handle "show numbers" command
            return await handle_show_numbers(request)
        else:
            # Step 2b: Handle action planning command
            return await handle_action_planning(request)
            
    except Exception as e:
        logger.error(f"Error processing command: {str(e)}")
        
        # Return fallback response
        fallback_response = await fallback_handler.handle_error(request, str(e))
        return fallback_response

def classify_command(query: str) -> str:
    """
    Classify the type of command to determine processing path
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
    
    # Check for direct number commands (when numbers are already showing)
    if "number" in query_lower and any(str(i) in query_lower for i in range(1, 21)):
        return "number_command"
    
    # Default to action planning
    return "action_planning"

async def handle_show_numbers(request: CommandRequest) -> ShowNumbersResponse:
    """
    Handle "show numbers" command - identify interactive elements for numbering
    """
    try:
        # Filter DOM elements to find interactive ones
        interactive_elements = []
        element_counter = 1
        
        for element in request.page_context.elements:
            if is_interactive_element(element):
                numbered_element = {
                    "number": element_counter,
                    "element": element.dict(),
                    "description": generate_element_description(element)
                }
                interactive_elements.append(numbered_element)
                element_counter += 1
        
        logger.info(f"Found {len(interactive_elements)} interactive elements")
        
        return ShowNumbersResponse(
            command_type="show_numbers",
            numbered_elements=interactive_elements,
            total_elements=len(interactive_elements),
            instructions="Interactive elements have been numbered. Say 'click number X' or 'type [text] in number X' to interact."
        )
        
    except Exception as e:
        logger.error(f"Error in handle_show_numbers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process show numbers: {str(e)}")

def is_interactive_element(element: DOMElement) -> bool:
    """
    Determine if a DOM element is interactive and should be numbered
    """
    interactive_tags = ['button', 'input', 'textarea', 'select', 'a']
    interactive_roles = ['button', 'link', 'textbox', 'combobox', 'tab']
    interactive_attributes = ['onclick', 'href', 'tabindex']
    
    # Check tag name
    if element.tag_name.lower() in interactive_tags:
        # Skip hidden inputs
        if element.tag_name.lower() == 'input' and element.attributes.get('type') == 'hidden':
            return False
        return True
    
    # Check role attribute
    if element.attributes.get('role') in interactive_roles:
        return True
    
    # Check for interactive attributes
    for attr in interactive_attributes:
        if attr in element.attributes:
            return True
    
    # Check for common interactive classes
    class_name = element.attributes.get('class', '').lower()
    interactive_classes = ['btn', 'button', 'link', 'clickable', 'interactive']
    if any(cls in class_name for cls in interactive_classes):
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
            page_context=request.page_context.dict()
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
                    "data": response.dict(),
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
        command_type = classify_command(request.query)
        
        if command_type == "show_numbers":
            validation_result = {
                "valid": True,
                "command_type": "show_numbers",
                "confidence": 1.0,
                "estimated_elements": len([e for e in request.page_context.elements if is_interactive_element(e)])
            }
        else:
            # Quick validation using Gemini
            validation_result = await gemini_planner.validate_command(
                request.query, 
                request.page_context.dict()
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