from fastapi import APIRouter, HTTPException
from database import get_db
from models import EvalProcessEntryCreate, EvalProcessEntryUpdate

router = APIRouter(prefix="/api/projects", tags=["eval_process"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("/{project_id}/eval-process")
def list_entries(project_id: int):
    db = get_db()
    entries = [
        dict_from_row(r) for r in
        db.execute(
            "SELECT * FROM eval_process_entries WHERE project_id=? ORDER BY entry_date DESC",
            (project_id,)
        ).fetchall()
    ]
    db.close()
    return entries


@router.post("/{project_id}/eval-process")
def create_entry(project_id: int, data: EvalProcessEntryCreate):
    db = get_db()
    cursor = db.execute(
        "INSERT INTO eval_process_entries (project_id, entry_date, tasks_today, tasks_tomorrow) VALUES (?, ?, ?, ?)",
        (project_id, data.entry_date, data.tasks_today, data.tasks_tomorrow)
    )
    db.commit()
    entry = dict_from_row(db.execute(
        "SELECT * FROM eval_process_entries WHERE id=?", (cursor.lastrowid,)
    ).fetchone())
    db.close()
    return entry


@router.put("/{project_id}/eval-process/{entry_id}")
def update_entry(project_id: int, entry_id: int, data: EvalProcessEntryUpdate):
    db = get_db()
    existing = dict_from_row(db.execute(
        "SELECT * FROM eval_process_entries WHERE id=? AND project_id=?", (entry_id, project_id)
    ).fetchone())
    if not existing:
        db.close()
        raise HTTPException(status_code=404, detail="Entry not found")

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(entry_id)
        db.execute(f"UPDATE eval_process_entries SET {set_clause}, updated_at=CURRENT_TIMESTAMP WHERE id=?", vals)
        db.commit()

    entry = dict_from_row(db.execute(
        "SELECT * FROM eval_process_entries WHERE id=?", (entry_id,)
    ).fetchone())
    db.close()
    return entry


@router.delete("/{project_id}/eval-process/{entry_id}")
def delete_entry(project_id: int, entry_id: int):
    db = get_db()
    db.execute("DELETE FROM eval_process_entries WHERE id=? AND project_id=?", (entry_id, project_id))
    db.commit()
    db.close()
    return {"success": True}
