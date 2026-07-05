"""
Build script for creating a standalone .exe for Managing T. Theera's Work.

Usage:
    python build_exe.py

This will:
1. Build the React frontend (npm run build)
2. Bundle everything into a single .exe using PyInstaller
"""

import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

def run(cmd, cwd=None):
    print(f"Running: {cmd}")
    subprocess.run(cmd, shell=True, cwd=cwd or BASE_DIR, check=True)

def main():
    print("=" * 60)
    print("  Building Managing T. Theera's Work - Standalone .exe")
    print("=" * 60)

    # Step 1: Clean old builds
    print("\n[1/5] Cleaning old builds...")
    for folder in ["dist", "build", "*.spec"]:
        path = os.path.join(BASE_DIR, folder)
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
    for f in os.listdir(BASE_DIR):
        if f.endswith(".spec"):
            os.remove(os.path.join(BASE_DIR, f))

    # Step 2: Build frontend
    print("\n[2/5] Building frontend...")
    if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
        run("npm install", cwd=FRONTEND_DIR)
    run("npm run build", cwd=FRONTEND_DIR)

    frontend_dist = os.path.join(FRONTEND_DIR, "dist")
    if not os.path.exists(frontend_dist):
        print("ERROR: Frontend build failed!")
        sys.exit(1)
    print("Frontend built successfully!")

    # Step 3: Install backend dependencies
    print("\n[3/5] Installing backend dependencies...")
    run(f'"{sys.executable}" -m pip install -r requirements.txt', cwd=BACKEND_DIR)

    # Step 4: Create PyInstaller spec and build
    print("\n[4/5] Creating standalone executable...")
    
    # Path to main.py
    main_py = os.path.join(BACKEND_DIR, "main.py")
    
    # Data files to include
    datas = [
        (frontend_dist, "frontend/dist"),  # Frontend static files
    ]
    
    # Hidden imports
    hidden_imports = [
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "fastapi",
        "pydantic",
        "multipart",
        "aiofiles",
        "sqlite3",
        "routes",
        "routes.projects",
        "routes.files",
        "routes.eval_process",
        "routes.gantt",
        "routes.time_logs",
        "routes.process",
        "routes.outputs",
    ]
    
    # Build PyInstaller command
    cmd = [
        f'"{sys.executable}"', "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",  # No console window (GUI mode)
        f'--name=Managing_Theera_Work',
        f'--distpath={os.path.join(BASE_DIR, "dist_exe")}',
        f'--workpath={os.path.join(BASE_DIR, "build_temp")}',
        f'--specpath={os.path.join(BASE_DIR, "build_temp")}',
    ]
    
    # Add data files
    for src, dst in datas:
        cmd.append(f'--add-data={src}{os.pathsep}{dst}')
    
    # Add hidden imports
    for imp in hidden_imports:
        cmd.append(f'--hidden-import={imp}')
    
    cmd.append(main_py)
    
    run(" ".join(cmd))

    # Step 5: Copy database to output folder
    print("\n[5/5] Finalizing...")
    dist_dir = os.path.join(BASE_DIR, "dist_exe")
    if os.path.exists(dist_dir):
        # Create a portable start script
        bat_content = """@echo off
title Managing T. Theera's Work
echo ============================================
echo  Managing T. Theera's Work
echo ============================================
echo.
echo Starting application...
start "" "%~dp0Managing_Theera_Work.exe"
echo.
echo Application started!
echo The database will be created next to this executable.
echo.
pause
"""
        with open(os.path.join(dist_dir, "start.bat"), "w", encoding="utf-8") as f:
            f.write(bat_content)
        
        print(f"\n✅ Build complete!")
        print(f"   Executable: {os.path.join(dist_dir, 'Managing_Theera_Work.exe')}")
        print(f"   Double-click the .exe or start.bat to run!")
        print(f"   Database will be created in the same folder.")

    # Clean up temp build files
    for folder in ["build_temp"]:
        path = os.path.join(BASE_DIR, folder)
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)

    print("\nDone!")


if __name__ == "__main__":
    main()
