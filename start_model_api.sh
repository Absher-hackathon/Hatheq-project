#!/bin/bash
# Script to start the Python model API server

echo "Starting Python Model API Server..."
echo "Make sure you have installed requirements: pip install -r requirements.txt"
echo ""
echo "Note: Using port 5001 (port 5000 is often used by macOS AirPlay)"
echo ""

# Allow port to be specified as argument: ./start_model_api.sh 5002
PORT=${1:-5001}

python3 model_api.py $PORT

