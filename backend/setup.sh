# File: startup.sh
#!/bin/bash

# VoiceForward Backend Startup Script

echo "Starting VoiceForward Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Please copy .env.example to .env and configure your API keys."
    exit 1
fi

# Load environment variables
export $(cat .env | xargs)

# Check if Gemini API key is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "Error: GEMINI_API_KEY not set in .env file"
    exit 1
fi

# Install dependencies if requirements.txt is newer than last install
if [ requirements.txt -nt .last_install ] || [ ! -f .last_install ]; then
    echo "Installing/updating dependencies..."
    pip install -r requirements.txt
    touch .last_install
fi

# Run database migrations or setup if needed
echo "Running setup tasks..."

# Start the server
echo "Starting server on port ${PORT:-8000}..."
if [ "$DEBUG" = "True" ]; then
    echo "Running in DEBUG mode with auto-reload"
    uvicorn main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --reload --log-level debug
else
    echo "Running in PRODUCTION mode"
    uvicorn main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --workers 4
fi
