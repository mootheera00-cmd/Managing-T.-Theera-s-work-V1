from fastapi import APIRouter, HTTPException
from database import get_db
from models import TimeLogCreate, TimeLogUpdate
from typing import Optional

router = APIRouter(prefix="/api/time-logs", tags=["time_logs"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("")
def list_time_logs(
    date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    project_id: Optional[int] = None,
):
    db = get_db()
    query = "SELECT tl.*, p.title as project_title, p.work_type FROM time_logs tl LEFT JOIN projects p ON tl.project_id = p.id WHERE 1=1"
    params = []

    if date:
        query += " AND tl.entry_date = ?"
        params.append(date)
    if date_from:
        query += " AND tl.entry_date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND tl.entry_date <= ?"
        params.append(date_to)
    if project_id is not None:
        query += " AND tl.project_id = ?"
        params.append(project_id)

    query += " ORDER BY tl.entry_date DESC, tl.id ASC"
    rows = db.execute(query, params).fetchall()
    result = [dict_from_row(r) for r in rows]
    db.close()
    return result


@router.post("")
def create_time_log(data: TimeLogCreate):
    db = get_db()
    
    # Check daily hour limit for this date
    date_total = db.execute(
        "SELECT COALESCE(SUM(hours), 0) as total FROM time_logs WHERE entry_date=? AND project_id=?",
        (data.entry_date, data.project_id)
    ).fetchone()["total"]
    
    new_total = date_total + data.hours
    
    # 8 hours normal, up to 13 with OT (8 + 5)
    if new_total > 13:
        db.close()
        raise HTTPException(
            status_code=400,
            detail=f"Daily hours cannot exceed 13 (8 normal + 5 OT). Current: {date_total}, attempted: {new_total}"
        )
    
    # Get project details for auto-fill
    project = dict_from_row(db.execute(
        "SELECT * FROM projects WHERE id=?", (data.project_id,)
    ).fetchone())
    
    work_type = project["work_type"] if project else ""
    customer = project["customer_name"] if project else ""
    
    # Get task details if task specified
    task_name = data.task_name
    if data.task_id > 0 and not task_name:
        task = dict_from_row(db.execute(
            "SELECT * FROM gantt_tasks WHERE id=? AND project_id=?",
            (data.task_id, data.project_id)
        ).fetchone())
        if task:
            task_name = task["name"]
    
    cursor = db.execute(
        """INSERT INTO time_logs 
           (project_id, task_id, task_name, entry_date, user_name, group_name, 
            sales, category, customer, aptx, code, hours, comment, mode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data.project_id, data.task_id, task_name, data.entry_date,
            data.user_name or "S.Nattiwat", data.group_name or "HUB",
            data.sales or work_type, data.category or work_type,
            data.customer or customer, data.aptx or "",
            data.code or "", data.hours, data.comment or "",
            data.mode or "log"
        )
    )
    log_id = cursor.lastrowid
    db.commit()
    
    # Get the full day's logs
    day_logs = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM time_logs WHERE entry_date=? ORDER BY id ASC", (data.entry_date,)).fetchall()
    ]
    
    # Update gantt task actual dates if task_id is specified
    if data.task_id > 0:
        # Update actual_start if not set
        existing = dict_from_row(db.execute(
            "SELECT * FROM gantt_tasks WHERE id=? AND project_id=?", (data.task_id, data.project_id)
        ).fetchone())
        if existing:
            if not existing["actual_start"] or existing["actual_start"] > data.entry_date:
                db.execute(
                    "UPDATE gantt_tasks SET actual_start=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (data.entry_date, data.task_id)
                )
            if not existing["actual_end"] or existing["actual_end"] < data.entry_date:
                db.execute(
                    "UPDATE gantt_tasks SET actual_end=?, progress=100, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (data.entry_date, data.task_id)
                )
            db.commit()
    
    db.close()
    return {
        "id": log_id,
        "day_logs": day_logs,
        "date_total": new_total,
        "exceeds_normal": new_total > 8,
        "overtime_hours": max(0, new_total - 8)
    }


@router.put("/{log_id}")
def update_time_log(log_id: int, data: TimeLogUpdate):
    db = get_db()
    existing = dict_from_row(db.execute("SELECT * FROM time_logs WHERE id=?", (log_id,)).fetchone())
    if not existing:
        db.close()
        raise HTTPException(status_code=404, detail="Time log not found")

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # If hours is being updated, check daily limit
    if "hours" in updates:
        date_total = db.execute(
            "SELECT COALESCE(SUM(hours), 0) as total FROM time_logs WHERE entry_date=? AND id!=?",
            (existing["entry_date"], log_id)
        ).fetchone()["total"]
        new_total = date_total + updates["hours"]
        if new_total > 13:
            db.close()
            raise HTTPException(
                status_code=400,
                detail=f"Daily hours cannot exceed 13 (8 normal + 5 OT). Current: {date_total}, attempted: {new_total}"
            )

    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(log_id)
        db.execute(f"UPDATE time_logs SET {set_clause}, updated_at=CURRENT_TIMESTAMP WHERE id=?", vals)
        db.commit()

    log = dict_from_row(db.execute("SELECT * FROM time_logs WHERE id=?", (log_id,)).fetchone())
    
    # Get day total
    day_total = db.execute(
        "SELECT COALESCE(SUM(hours), 0) as total FROM time_logs WHERE entry_date=?",
        (log["entry_date"],)
    ).fetchone()["total"]
    
    db.close()
    return {
        "log": log,
        "date_total": day_total
    }


@router.delete("/{log_id}")
def delete_time_log(log_id: int):
    db = get_db()
    log = dict_from_row(db.execute("SELECT * FROM time_logs WHERE id=?", (log_id,)).fetchone())
    if not log:
        db.close()
        raise HTTPException(status_code=404, detail="Time log not found")
    
    entry_date = log["entry_date"]
    db.execute("DELETE FROM time_logs WHERE id=?", (log_id,))
    db.commit()
    
    # Get updated day total
    day_total = db.execute(
        "SELECT COALESCE(SUM(hours), 0) as total FROM time_logs WHERE entry_date=?",
        (entry_date,)
    ).fetchone()["total"]
    
    day_logs = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM time_logs WHERE entry_date=? ORDER BY id ASC", (entry_date,)).fetchall()
    ]
    
    db.close()
    return {
        "success": True,
        "day_logs": day_logs,
        "date_total": day_total
    }


@router.get("/active-projects")
def get_active_projects_for_timesheet():
    """Get all active (non-completed) projects grouped by work type"""
    db = get_db()
    rows = db.execute(
        """SELECT p.*, wr.requester, wr.customer_name, wr.work_type, wr.bearing_no, wr.due_date
           FROM projects p 
           LEFT JOIN work_requests wr ON p.id = wr.project_id
           WHERE p.current_stage IN ('work_request', 'process', 'outputs')
           AND p.status = 'active'
           ORDER BY wr.work_type ASC, p.title ASC"""
    ).fetchall()
    
    projects = []
    for r in rows:
        p = dict_from_row(r)
        # Get gantt tasks
        p["gantt_tasks"] = [
            dict_from_row(t) for t in
            db.execute("SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC", (p["id"],)).fetchall()
        ]
        projects.append(p)
    
    db.close()
    return projects


@router.get("/check-hours/{date}")
def check_daily_hours(date: str):
    db = get_db()
    total = db.execute(
        "SELECT COALESCE(SUM(hours), 0) as total FROM time_logs WHERE entry_date=?",
        (date,)
    ).fetchone()["total"]
    db.close()
    return {
        "date": date,
        "total_hours": total,
        "normal_limit": 8,
        "ot_limit": 13,
        "is_full": total >= 8,
        "can_add_overtime": total < 13,
        "remaining_normal": max(0, 8 - total),
        "remaining_with_ot": max(0, 13 - total)
    }


@router.get("/{log_id}")
def get_time_log(log_id: int):
    db = get_db()
    log = dict_from_row(db.execute("SELECT * FROM time_logs WHERE id=?", (log_id,)).fetchone())
    db.close()
    if not log:
        raise HTTPException(status_code=404, detail="Time log not found")
    return log
