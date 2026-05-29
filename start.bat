@echo off
echo ============================================
echo  Managing T. Theera's Work
echo ============================================
echo.
echo Starting server at http://localhost:5000
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0backend"
start http://localhost:5000
python main.py
pause
