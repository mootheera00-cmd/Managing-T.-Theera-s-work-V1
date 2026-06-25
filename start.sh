#!/bin/bash
echo "============================================"
echo " Managing T. Theera's Work"
echo "============================================"
echo ""
echo "Starting server at http://localhost:8888"
echo "Press Ctrl+C to stop."
echo ""
cd "$(dirname "$0")/backend"
python3 main.py
