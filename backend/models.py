# VoiceForward Backend Data Models
# File: models.py

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import uuid

class DOMElement(BaseModel):
    """Represents a DOM element from the frontend"""
    tag_name: str
    text_content: Optional[str] = ""
    attributes: Dict[str, Any] = Field(default_factory=dict)
    selector: Optional[str] = ""
    xpath: Optional[str] = ""
    position: Optional[Dict[str, float]] = Field(default_factory=dict)  # {x, y, width, height}
    is_visible: bool = True
    is_interactive: bool = False

    @validator('tag_name')
    def tag_name_must_be_lowercase(cls, v):
        return v.lower()

class PageContext(BaseModel):
    """Context information about the current page"""
    url: str
    title: str
    elements: List[DOMElement]
    viewport: Optional[Dict[str, int]] = Field(default_factory=dict)  # {width, height}
    scroll_position: Optional[Dict[str, int]] = Field(default_factory=dict)  # {x, y}
    timestamp: datetime = Field(default_factory=datetime.now)

class CommandRequest(BaseModel):
    """Request model for command processing"""
    query: str = Field(..., description="The voice command transcribed by frontend")
    page_context: PageContext
    client_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: Optional[str] = ""
    timestamp: datetime = Field(default_factory=datetime.now)

    @validator('query')
    def query_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Query cannot be empty')
        return v.strip()

class Action(BaseModel):
    """Represents a single action to be executed"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str = Field(..., description="Type of action: click, type, scroll, wait, navigate")
    target: Optional[str] = Field("", description="Description of target element")
    text: Optional[str] = Field("", description="Text to type (for type actions)")
    selector: Optional[str] = Field("", description="CSS selector for target element")
    xpath: Optional[str] = Field("", description="XPath for target element")
    url: Optional[str] = Field("", description="URL for navigate actions")
    coordinates: Optional[Dict[str, float]] = None  # {x, y} for coordinate-based clicking
    wait_time: float = Field(0.5, description="Time to wait after action (seconds)")
    sequence_order: int = Field(1, description="Order in action sequence")
    confidence: float = Field(0.8, description="Confidence score for this action")
    
    @validator('action')
    def action_must_be_valid(cls, v):
        valid_actions = ['click', 'type', 'scroll', 'wait', 'navigate', 'hover', 'focus']
        if v.lower() not in valid_actions:
            raise ValueError(f'Action must be one of: {valid_actions}')
        return v.lower()
    
    @validator('confidence')
    def confidence_must_be_valid(cls, v):
        if not 0 <= v <= 1:
            raise ValueError('Confidence must be between 0 and 1')
        return v

class NumberedElement(BaseModel):
    """Represents an element with assigned number for user interaction"""
    number: int
    element: Dict[str, Any]  # DOMElement as dict
    description: str
    confidence: float = 1.0

class ShowNumbersResponse(BaseModel):
    """Response for 'show numbers' commands"""
    command_type: str = "show_numbers"
    numbered_elements: List[NumberedElement]
    total_elements: int
    instructions: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ActionSequenceResponse(BaseModel):
    """Response for action planning commands"""
    command_type: str = "action_sequence"
    original_command: str
    actions: List[Action]
    total_actions: int
    estimated_duration: float  # Total estimated time in seconds
    confidence_score: float  # Average confidence of all actions
    fallback_used: bool = False
    error_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

# Union type for command responses
CommandResponse = Union[ShowNumbersResponse, ActionSequenceResponse]

class ValidationResult(BaseModel):
    """Result of command validation"""
    valid: bool
    command_type: str
    confidence: float
    issues: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    estimated_elements: Optional[int] = None
    estimated_actions: Optional[int] = None

class WebSocketMessage(BaseModel):
    """WebSocket message format"""
    type: str  # command, response, status, error, ping, pong
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    client_id: Optional[str] = None

class BatchRequest(BaseModel):
    """Batch processing request"""
    commands: List[CommandRequest]
    batch_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    parallel: bool = False  # Whether to process in parallel

class BatchResponse(BaseModel):
    """Batch processing response"""
    batch_id: str
    total_commands: int
    successful: int
    failed: int
    results: List[CommandResponse]
    errors: List[str] = Field(default_factory=list)
    processed_at: datetime = Field(default_factory=datetime.now)

class SystemStats(BaseModel):
    """System statistics and health metrics"""
    active_connections: int
    total_commands_processed: int
    average_response_time: float
    gemini_api_status: str
    uptime: str
    version: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ErrorResponse(BaseModel):
    """Standardized error response"""
    error: bool = True
    error_type: str
    message: str
    details: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)