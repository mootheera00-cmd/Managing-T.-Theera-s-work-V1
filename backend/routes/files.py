import re
import subprocess
import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from database import get_db
import os
import uuid
import mimetypes


class FolderAction(BaseModel):
    folder_path: str
    target_folder: str = ""


router = APIRouter(prefix="/api/files", tags=["files"])

router = APIRouter(prefix="/api/files", tags=["files"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


def sanitize_folder_name(name: str) -> str:
    """Remove characters that are invalid in Windows folder names."""
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
    sanitized = sanitized.rstrip('. ')
    if not sanitized:
        sanitized = "unnamed"
    return sanitized


def get_project_folder_path(project_id: int, db) -> str:
    """
    Get (or create) the project folder path under uploads/.
    Folder name format: YYYY-MM-DD_WorkType_Title
    Uses received_date from project, work_type, and title.
    """
    project = dict_from_row(db.execute(
        """SELECT p.title, p.work_type, p.received_date, p.created_at
           FROM projects p
           WHERE p.id = ?""",
        (project_id,)
    ).fetchone())

    if not project:
        return UPLOAD_DIR

    # Use received_date if available, otherwise use created_at date part
    date_str = (project.get("received_date") or "")[:10]
    if not date_str:
        date_str = (project.get("created_at") or "")[:10]
    if not date_str:
        date_str = "0000-00-00"

    work_type = sanitize_folder_name(project.get("work_type", "General"))
    title = sanitize_folder_name(project.get("title", "unnamed"))
    folder_name = f"{date_str}_{work_type}_{title}"
    folder_path = os.path.join(UPLOAD_DIR, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    return folder_path


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    stage: str = Form("work_request"),
    step_name: str = Form(""),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    base, ext = os.path.splitext(file.filename)
    db = get_db()

    # Determine project folder (YYYY-MM-DD_Title)
    project_folder = get_project_folder_path(project_id, db)

    # Query database for existing file with same original_filename
    existing = db.execute(
        """
        SELECT f.original_filename, f.project_id, p.title as project_title
        FROM file_attachments f
        JOIN projects p ON f.project_id = p.id
        WHERE f.original_filename = ?
        ORDER BY f.id DESC LIMIT 1
        """,
        (file.filename,)
    ).fetchone()

    warning_message = None
    new_filename = file.filename

    if existing:
        proj_title = existing["project_title"]
        proj_id = existing["project_id"]
        warning_message = f"File '{file.filename}' already exists in project '{proj_title}' (ID: {proj_id})"

        # Generate a new unique name by appending Copy1, Copy2...
        counter = 1
        while True:
            candidate_name = f"{base}Copy{counter}{ext}"
            dup_db = db.execute("SELECT 1 FROM file_attachments WHERE original_filename = ?", (candidate_name,)).fetchone()
            dup_disk = os.path.exists(os.path.join(project_folder, candidate_name))
            if not dup_db and not dup_disk:
                new_filename = candidate_name
                break
            counter += 1
    else:
        # Check if it physically exists on disk even if not in DB
        if os.path.exists(os.path.join(project_folder, new_filename)):
            counter = 1
            while True:
                candidate_name = f"{base}Copy{counter}{ext}"
                dup_db = db.execute("SELECT 1 FROM file_attachments WHERE original_filename = ?", (candidate_name,)).fetchone()
                dup_disk = os.path.exists(os.path.join(project_folder, candidate_name))
                if not dup_db and not dup_disk:
                    new_filename = candidate_name
                    break
                counter += 1

    stored_name = new_filename
    file_path = os.path.join(project_folder, stored_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    file_size = len(contents)

    cursor = db.execute(
        "INSERT INTO file_attachments (project_id, stage, step_name, original_filename, stored_filename, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (project_id, stage, step_name, new_filename, stored_name, file_path, file_size, mime)
    )
    file_id = cursor.lastrowid
    db.commit()

    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    db.close()

    res_dict = dict(row) if row else {}
    res_dict["warning"] = warning_message
    return res_dict


from urllib.parse import quote


def _resolve_file_path(row: dict) -> str:
    """Resolve the actual file path.  Try stored path first, then fall back to flat UPLOAD_DIR for legacy files."""
    fp = row.get("file_path") or ""
    if os.path.exists(fp):
        return fp
    # Legacy fallback: file may be stored directly in UPLOAD_DIR
    legacy = os.path.join(UPLOAD_DIR, row.get("stored_filename", ""))
    if os.path.exists(legacy):
        return legacy
    return fp


@router.get("/{file_id}/download")
def download_file(file_id: int):
    db = get_db()
    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = _resolve_file_path(row)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    safe_filename = quote(row["original_filename"])
    return FileResponse(
        path=file_path,
        media_type=row["mime_type"],
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"},
    )


@router.get("/{file_id}/view")
def view_file(file_id: int):
    db = get_db()
    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = _resolve_file_path(row)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    safe_filename = quote(row["original_filename"])
    return FileResponse(
        path=file_path,
        media_type=row["mime_type"],
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{safe_filename}"},
    )


@router.delete("/{file_id}")
def delete_file(file_id: int):
    db = get_db()
    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="File not found")

    file_path = _resolve_file_path(row)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.execute("DELETE FROM file_attachments WHERE id=?", (file_id,))
    db.commit()
    db.close()
    return {"message": "File deleted successfully"}


@router.get("/project/{project_id}")
def list_project_files(project_id: int, stage: str = None):
    db = get_db()
    if stage:
        rows = db.execute(
            "SELECT * FROM file_attachments WHERE project_id=? AND stage=? ORDER BY uploaded_at DESC",
            (project_id, stage)
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM file_attachments WHERE project_id=? ORDER BY uploaded_at DESC",
            (project_id,)
        ).fetchall()
    result = [dict_from_row(r) for r in rows]
    db.close()
    return result


@router.post("/open-folder")
def open_folder(data: FolderAction):
    """Open a folder path in Windows Explorer."""
    folder_path = data.folder_path.strip().strip('"').strip("'")
    
    if not folder_path:
        raise HTTPException(status_code=400, detail="Folder path is empty")
    
    # Normalize path
    folder_path = os.path.normpath(folder_path)
    
    if not os.path.isdir(folder_path):
        # Maybe it's a UNC path that's not currently accessible
        try:
            # Try to open anyway — Explorer will show error if invalid
            subprocess.Popen(["explorer", folder_path])
            return {"success": True, "message": f"Opened: {folder_path}"}
        except Exception:
            raise HTTPException(status_code=404, detail=f"Folder not found: {folder_path}")
    
    try:
        subprocess.Popen(["explorer", folder_path])
        return {"success": True, "message": f"Opened: {folder_path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")


@router.post("/list-folder")
def list_folder(data: FolderAction):
    """List files and subdirectories in a given folder path."""
    folder_path = data.folder_path.strip().strip('"').strip("'")
    
    if not folder_path:
        raise HTTPException(status_code=400, detail="Folder path is empty")
    
    folder_path = os.path.normpath(folder_path)
    
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder not found: {folder_path}")
    
    try:
        items = []
        for entry in os.scandir(folder_path):
            stat_info = entry.stat()
            items.append({
                "name": entry.name,
                "path": entry.path,
                "is_dir": entry.is_dir(),
                "size": stat_info.st_size if entry.is_file() else 0,
                "modified": stat_info.st_mtime,
            })
        
        # Sort: directories first, then by name
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
        return {
            "success": True,
            "folder_path": folder_path,
            "parent_path": os.path.dirname(folder_path),
            "items": items
        }
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {folder_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list folder: {str(e)}")


@router.post("/copy-to-folder")
def copy_file_to_folder(data: FolderAction):
    """Copy a file from source path to target folder."""
    source = data.folder_path.strip().strip('"').strip("'")
    target_dir = data.target_folder.strip().strip('"').strip("'")
    
    if not source or not target_dir:
        raise HTTPException(status_code=400, detail="Both source file and target folder are required")
    
    source = os.path.normpath(source)
    target_dir = os.path.normpath(target_dir)
    
    if not os.path.isfile(source):
        raise HTTPException(status_code=404, detail=f"Source file not found: {source}")
    
    if not os.path.isdir(target_dir):
        try:
            os.makedirs(target_dir, exist_ok=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create target folder: {str(e)}")
    
    try:
        import shutil
        filename = os.path.basename(source)
        dest_path = os.path.join(target_dir, filename)
        
        # Handle name collision
        base, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(dest_path):
            dest_path = os.path.join(target_dir, f"{base}Copy{counter}{ext}")
            counter += 1
        
        shutil.copy2(source, dest_path)
        return {
            "success": True,
            "message": f"Copied to: {dest_path}",
            "dest_path": dest_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to copy file: {str(e)}")
