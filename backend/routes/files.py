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


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    stage: str = Form("work_request"),
    step_name: str = Form(""),
):
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    stored_name = str(uuid.uuid4()) + ext
    file_path = os.path.join(UPLOAD_DIR, stored_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    file_size = len(contents)

    db = get_db()
    cursor = db.execute(
        "INSERT INTO file_attachments (project_id, stage, step_name, original_filename, stored_filename, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (project_id, stage, step_name, file.filename, stored_name, file_path, file_size, mime)
    )
    file_id = cursor.lastrowid
    db.commit()

    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    db.close()
    return row


@router.get("/{file_id}/download")
def download_file(file_id: int):
    db = get_db()
    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(row["file_path"]):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=row["file_path"],
        filename=row["original_filename"],
        media_type=row["mime_type"],
    )


@router.get("/{file_id}/view")
def view_file(file_id: int):
    db = get_db()
    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(row["file_path"]):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=row["file_path"],
        filename=row["original_filename"],
        media_type=row["mime_type"],
        headers={"Content-Disposition": "inline"},
    )


@router.delete("/{file_id}")
def delete_file(file_id: int):
    db = get_db()
    row = dict_from_row(db.execute("SELECT * FROM file_attachments WHERE id=?", (file_id,)).fetchone())
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.exists(row["file_path"]):
        os.remove(row["file_path"])
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
