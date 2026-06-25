from fastapi import APIRouter, HTTPException
from database import get_db
from models import EvalProcessEntryCreate, EvalProcessEntryUpdate

router = APIRouter(prefix="/api/projects", tags=["eval-process"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("/{project_id}/eval-process")
def list_eval_entries(project_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM eval_process_entries WHERE project_id=? ORDER BY entry_date ASC",
        (project_id,),
    ).fetchall()
    db.close()
    return [dict_from_row(r) for r in rows]


@router.post("/{project_id}/eval-process")
def create_eval_entry(project_id: int, payload: EvalProcessEntryCreate):
    db = get_db()
    # Verify project exists
    proj = db.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone()
    if not proj:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")

    # Prevent duplicate dates
    existing = db.execute(
        "SELECT id FROM eval_process_entries WHERE project_id=? AND entry_date=?",
        (project_id, payload.entry_date),
    ).fetchone()
    if existing:
        db.close()
        raise HTTPException(status_code=409, detail="Entry for this date already exists")

    cursor = db.execute(
        "INSERT INTO eval_process_entries (project_id, entry_date, tasks_today, tasks_tomorrow) VALUES (?, ?, ?, ?)",
        (project_id, payload.entry_date, payload.tasks_today or "", payload.tasks_tomorrow or ""),
    )
    entry_id = cursor.lastrowid
    db.commit()
    row = dict_from_row(db.execute("SELECT * FROM eval_process_entries WHERE id=?", (entry_id,)).fetchone())
    db.close()
    return row


@router.put("/{project_id}/eval-process/{entry_id}")
def update_eval_entry(project_id: int, entry_id: int, payload: EvalProcessEntryUpdate):
    db = get_db()
    entry = db.execute(
        "SELECT * FROM eval_process_entries WHERE id=? AND project_id=?",
        (entry_id, project_id),
    ).fetchone()
    if not entry:
        db.close()
        raise HTTPException(status_code=404, detail="Entry not found")

    entry = dict_from_row(entry)
    tasks_today = payload.tasks_today if payload.tasks_today is not None else entry["tasks_today"]
    tasks_tomorrow = payload.tasks_tomorrow if payload.tasks_tomorrow is not None else entry["tasks_tomorrow"]

    db.execute(
        "UPDATE eval_process_entries SET tasks_today=?, tasks_tomorrow=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (tasks_today, tasks_tomorrow, entry_id),
    )
    db.commit()
    row = dict_from_row(db.execute("SELECT * FROM eval_process_entries WHERE id=?", (entry_id,)).fetchone())
    db.close()
    return row


@router.delete("/{project_id}/eval-process/{entry_id}")
def delete_eval_entry(project_id: int, entry_id: int):
    db = get_db()
    entry = db.execute(
        "SELECT id FROM eval_process_entries WHERE id=? AND project_id=?",
        (entry_id, project_id),
    ).fetchone()
    if not entry:
        db.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    db.execute("DELETE FROM eval_process_entries WHERE id=?", (entry_id,))
    db.commit()
    db.close()
    return {"ok": True}
