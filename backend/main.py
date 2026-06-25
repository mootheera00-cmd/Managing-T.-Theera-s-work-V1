import os
import sys
import threading
import webbrowser
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import init_db
from routes.projects import router as projects_router
from routes.files import router as files_router
from routes.eval_process import router as eval_process_router
from routes.gantt import router as gantt_router
from routes.time_logs import router as time_logs_router


# When running as a PyInstaller bundle, files are extracted to sys._MEIPASS.
# When running normally, use the directory of this file.
def get_base_dir():
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
frontend_dist = os.path.join(BASE_DIR, "..", "frontend", "dist")
frontend_dist = os.path.normpath(frontend_dist)

app = FastAPI(title="Managing T. Theera's Work", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(files_router)
app.include_router(eval_process_router)
app.include_router(gantt_router)
app.include_router(time_logs_router)



@app.on_event("startup")
def startup():
    init_db()
    print("Database initialized.")
    
    # Get local IP address
    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass

    print("==================================================")
    print("Server running at:")
    print("  - Local:    http://localhost:8888")
    print(f"  - Network:  http://{local_ip}:8888 (for colleagues)")
    print("==================================================")
    
    if os.path.isdir(frontend_dist):
        print("Serving frontend from: " + frontend_dist)
    else:
        print("Frontend not built yet. Run 'npm run build' in the frontend directory first.")


if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


def open_browser():
    """Open browser after a short delay to let the server start."""
    import time
    time.sleep(1.5)
    webbrowser.open("http://localhost:8888")


if __name__ == "__main__":
    # Auto-open browser when launched directly (including as .exe)
    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8888)
