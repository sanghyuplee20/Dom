#!/usr/bin/env python3
"""
Test script for number command processing
"""
import sys
import re
from typing import List

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
    # More comprehensive number detection patterns
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

def parse_number_command(query: str) -> List[dict]:
    """
    Parse number-based commands like "click on 2" or "type hello in 3"
    """
    query_lower = query.lower().strip()
    print(f"Processing: '{query_lower}'")
    
    # Extract numbers and actions from the command
    actions = []
    
    # Pattern to match "click [on] [number] N" where N can be digit or word
    click_pattern = r'\b(click|tap|press|select|choose)\s+(?:on\s+)?(?:number\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b'
    click_matches = re.findall(click_pattern, query_lower)
    print(f"Click matches: {click_matches}")
    
    # Pattern to match "type X [in] [number] N"
    type_pattern = r'\b(type|enter|input)\s+([^,]+?)\s+(?:in|into|on)\s+(?:number\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b'
    type_matches = re.findall(type_pattern, query_lower)
    print(f"Type matches: {type_matches}")
    
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
    
    return actions

def test_commands():
    """Test various command patterns"""
    test_cases = [
        "show numbers",
        "click on 2",
        "click 2", 
        "click on two",
        "click two",
        "press 5",
        "select number 3",
        "type hello in 4",
        "type hello in number 4", 
        "enter text on 6",
        "just number 7",
        "7",
        "hello world",  # should be action_planning
    ]
    
    for query in test_cases:
        print(f"\n--- Testing: '{query}' ---")
        command_type = classify_command(query)
        print(f"Command type: {command_type}")
        
        if command_type == "number_command":
            actions = parse_number_command(query)
            print(f"Generated actions: {actions}")

if __name__ == "__main__":
    test_commands()