#!/bin/bash
echo "============================================"
echo " Managing T. Theera's Work"
echo "============================================"
echo ""
echo "Starting server at http://localhost:5000"
echo "Press Ctrl+C to stop."
echo ""
cd "$(dirname "$0")/backend"

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5000 &
elif command -v open &> /dev/null; then
    open http://localhost:5000 &
fi

python3 main.py
