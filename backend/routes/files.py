import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from database import get_db
import os
import uuid
import mimetypes

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
    Folder name format: YYYY-MM-DD_SanitizedProjectTitle
    Uses submission_date from outputs table, falls back to project created_at.
    """
    project = dict_from_row(db.execute(
        """SELECT p.title, o.submission_date, p.created_at
           FROM projects p
           LEFT JOIN outputs o ON o.project_id = p.id
           WHERE p.id = ?""",
        (project_id,)
    ).fetchone())

    if not project:
        return UPLOAD_DIR

    # Use submission_date if available, otherwise use created_at date part
    date_str = (project.get("submission_date") or "")[:10]
    if not date_str:
        date_str = (project.get("created_at") or "")[:10]
    if not date_str:
        date_str = "0000-00-00"

    title = project.get("title", "unnamed")
    folder_name = f"{date_str}_{sanitize_folder_name(title)}"
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
        warning_message = f"ไฟล์ชื่อ '{file.filename}' ซ้ำกับไฟล์ในโปรเจค '{proj_title}' (ID: {proj_id})"

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
