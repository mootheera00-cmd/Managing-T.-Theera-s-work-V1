#!/usr/bin/env python3
"""
Build script to create a standalone .exe for Managing T. Theera's Work
Prerequisites:
  - Python 3.10+
  - Node.js 18+
  - pip install pyinstaller
"""
import subprocess
import os
import sys
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(ROOT, "frontend")
BACKEND = os.path.join(ROOT, "backend")
DIST_DIR = os.path.join(FRONTEND, "dist")

def run(cmd, cwd=None):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"Command failed with code {result.returncode}")
        sys.exit(1)

def main():
    print("=" * 60)
    print("Building Managing T. Theera's Work")
    print("=" * 60)

    # Step 1: Install frontend dependencies
    print("\n[1/4] Installing frontend dependencies...")
    run("npm install", cwd=FRONTEND)

    # Step 2: Build frontend
    print("\n[2/4] Building frontend...")
    run("npm run build", cwd=FRONTEND)

    if not os.path.isdir(DIST_DIR):
        print("ERROR: Frontend build failed - dist directory not found")
        sys.exit(1)

    # Step 3: Install backend dependencies
    print("\n[3/4] Installing backend dependencies...")
    req_file = os.path.join(BACKEND, 'requirements.txt')
    run(f'"{sys.executable}" -m pip install -r "{req_file}"')
    run(f'"{sys.executable}" -m pip install pyinstaller')

    # Step 4: Build .exe with PyInstaller
    print("\n[4/4] Building .exe with PyInstaller...")

    # Ensure uploads directory exists
    uploads_dir = os.path.join(BACKEND, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    # On Windows the separator in --add-data is semicolon, on Unix it's colon.
    SEP = os.pathsep  # ';' on Windows, ':' on Unix

    pyinstaller_cmd = (
        f"pyinstaller "
        f"--name ManagingTheeraWork "
        f"--onefile "
        f"--console "
        f"--add-data \"{DIST_DIR}{SEP}frontend/dist\" "
        f"--add-data \"{uploads_dir}{SEP}uploads\" "
        f"--hidden-import uvicorn.logging "
        f"--hidden-import uvicorn.loops "
        f"--hidden-import uvicorn.loops.auto "
        f"--hidden-import uvicorn.protocols "
        f"--hidden-import uvicorn.protocols.http "
        f"--hidden-import uvicorn.protocols.http.auto "
        f"--hidden-import uvicorn.protocols.websockets "
        f"--hidden-import uvicorn.protocols.websockets.auto "
        f"--hidden-import uvicorn.lifespan "
        f"--hidden-import uvicorn.lifespan.on "
        f"--hidden-import aiosqlite "
        f"--hidden-import sqlite3 "
        f"--collect-all uvicorn "
        f"--collect-all fastapi "
        f"--collect-all anyio "
        f"--paths \"{BACKEND}\" "
        f"\"{os.path.join(BACKEND, 'main.py')}\""
    )
    run(pyinstaller_cmd, cwd=ROOT)

    print()
    print("=" * 60)
    print("BUILD COMPLETE!")
    print(f"Executable: {os.path.join(ROOT, 'dist', 'ManagingTheeraWork.exe')}")
    print("Double-click the .exe to start the application.")
    print("Open http://localhost:5000 in your browser.")
    print("=" * 60)

if __name__ == "__main__":
    main()
