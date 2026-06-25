@echo off
cd /d "%~dp0"
title Managing T. Theera's Work

echo ============================================
echo  Managing T. Theera's Work
echo ============================================
echo.

:: Kill any existing process on port 8888
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8888 " ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
if %errorlevel%==0 echo [OK] Freed port 8888

:: Activate virtual environment
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo [OK] Virtual environment activated
) else (
    echo [WARN] Virtual environment not found, trying system Python
)

:: Build frontend (skip if already built)
if not exist "frontend\dist\index.html" (
    echo [BUILD] Building frontend...
    cd /d "%~dp0frontend"
    call npm install --silent
    call npm run build
    cd /d "%~dp0"
    echo [OK] Frontend built
) else (
    echo [OK] Frontend already built
)

:: Find local IP address
set "LOCAL_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        set "LOCAL_IP=%%j"
    )
)

echo.
echo ==================================================
echo Server running at:
echo   - Local:    http://localhost:8888
echo   - Network:  http://%LOCAL_IP%:8888 (for colleagues)
echo ==================================================
echo.
echo Press Ctrl+C to stop.
echo.

cd /d "%~dp0backend"
python main.py

echo.
echo Server stopped.
pause
