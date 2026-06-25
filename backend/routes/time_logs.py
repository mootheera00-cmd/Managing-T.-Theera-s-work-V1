from fastapi import APIRouter, HTTPException
from database import get_db
from models import TimeLogCreate
from typing import Optional

router = APIRouter(prefix="/api/time-logs", tags=["time-logs"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("")
def list_time_logs(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    project_id: Optional[int] = None,
):
    db = get_db()
    query = """
        SELECT tl.*, p.title as project_title,
               wr.requester, wr.customer_name, wr.work_type, wr.bearing_no,
               COALESCE(
                   (SELECT GROUP_CONCAT(report_number, ', ') FROM report_numbers WHERE project_id = tl.project_id ORDER BY id ASC),
                   ps.report_number,
                   ''
                ) as report_number
        FROM time_logs tl
        JOIN projects p ON tl.project_id = p.id
        LEFT JOIN work_requests wr ON tl.project_id = wr.project_id
        LEFT JOIN process_steps ps ON tl.project_id = ps.project_id
        WHERE 1=1
    """
    params = []
    if date_from:
        query += " AND tl.entry_date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND tl.entry_date <= ?"
        params.append(date_to)
    if project_id:
        query += " AND tl.project_id = ?"
        params.append(project_id)

    query += " ORDER BY tl.entry_date ASC, tl.project_id ASC"
    rows = db.execute(query, params).fetchall()
    db.close()
    return [dict_from_row(r) for r in rows]


@router.post("")
def create_time_log(payload: TimeLogCreate):
    db = get_db()
    # Check if entry exists for same project + task + date
    existing = db.execute(
        "SELECT id FROM time_logs WHERE project_id=? AND task_id=? AND entry_date=?",
        (payload.project_id, payload.task_id, payload.entry_date),
    ).fetchone()

    if existing:
        # Update existing entry
        db.execute(
            """UPDATE time_logs
               SET hours=?, slots_json=?, task_name=?, updated_at=CURRENT_TIMESTAMP
               WHERE id=?""",
            (payload.hours, payload.slots_json, payload.task_name, existing["id"]),
        )
        db.commit()
        row = dict_from_row(
            db.execute("SELECT * FROM time_logs WHERE id=?", (existing["id"],)).fetchone()
        )
        db.close()
        return row
    else:
        cursor = db.execute(
            "INSERT INTO time_logs (project_id, task_id, task_name, entry_date, hours, slots_json) VALUES (?, ?, ?, ?, ?, ?)",
            (payload.project_id, payload.task_id, payload.task_name, payload.entry_date, payload.hours, payload.slots_json),
        )
        entry_id = cursor.lastrowid
        db.commit()
        row = dict_from_row(
            db.execute("SELECT * FROM time_logs WHERE id=?", (entry_id,)).fetchone()
        )
        db.close()
        return row


@router.delete("/{entry_id}")
def delete_time_log(entry_id: int):
    db = get_db()
    entry = db.execute("SELECT id FROM time_logs WHERE id=?", (entry_id,)).fetchone()
    if not entry:
        db.close()
        raise HTTPException(status_code=404, detail="Time log entry not found")
    db.execute("DELETE FROM time_logs WHERE id=?", (entry_id,))
    db.commit()
    db.close()
    return {"ok": True}
