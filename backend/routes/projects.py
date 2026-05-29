from fastapi import APIRouter, HTTPException
from database import get_db
from models import (
    ProjectCreate, ProjectUpdate, PauseRequest,
    WorkRequestUpdate, ProcessUpdate, OutputUpdate
)
from typing import Optional

router = APIRouter(prefix="/api/projects", tags=["projects"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


def calculate_progress(project_id: int, current_stage: str, db) -> int:
    if current_stage == "completed":
        return 100

    if current_stage == "work_request":
        wr = dict_from_row(db.execute(
            "SELECT * FROM work_requests WHERE project_id=?", (project_id,)
        ).fetchone())
        if not wr:
            return 0
        fields = ["requester", "customer_name", "work_type", "bearing_no", "due_date"]
        filled = sum(1 for f in fields if wr.get(f) and str(wr[f]).strip())
        return int((filled / len(fields)) * 100)

    elif current_stage == "process":
        ps = dict_from_row(db.execute(
            "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
        ).fetchone())
        if not ps:
            return 0
        checks = [
            bool(ps.get("comets_no") and str(ps["comets_no"]).strip()),
            bool(ps.get("email_from") and str(ps["email_from"]).strip()),
            bool(ps.get("order_confirmed")),
            bool(ps.get("report_number") and str(ps["report_number"]).strip()),
            ps.get("test_status") == "completed",
            ps.get("report_status") == "completed",
            ps.get("check_status") == "completed",
            ps.get("issue_status") == "completed",
        ]
        done = sum(checks)
        return int((done / len(checks)) * 100)

    elif current_stage == "outputs":
        out = dict_from_row(db.execute(
            "SELECT * FROM outputs WHERE project_id=?", (project_id,)
        ).fetchone())
        wr = dict_from_row(db.execute(
            "SELECT * FROM work_requests WHERE project_id=?", (project_id,)
        ).fetchone())
        if not out:
            return 0
        work_type = wr.get("work_type", "") if wr else ""
        checks = [
            bool(out.get("report_approved")),
            bool(out.get("work_log_completed")),
            bool(out.get("comets_submitted")),
        ]
        if work_type in ("Investigation", "Investigation for Warranty"):
            checks.append(bool(out.get("claim_record_completed")))
        if work_type == "Evaluation":
            checks.append(bool(out.get("eval_record_completed")))
        total = len(checks)
        done = sum(checks)
        return int((done / total) * 100) if total > 0 else 0

    return 0


def check_auto_progression(project_id: int, db):
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project or project["status"] == "paused":
        return

    stage = project["current_stage"]

    if stage == "work_request":
        wr = dict_from_row(db.execute(
            "SELECT * FROM work_requests WHERE project_id=?", (project_id,)
        ).fetchone())
        if wr:
            fields = ["requester", "customer_name", "work_type", "bearing_no", "due_date"]
            all_filled = all(wr.get(f) and str(wr[f]).strip() for f in fields)
            if all_filled:
                db.execute("UPDATE work_requests SET is_complete=1 WHERE project_id=?", (project_id,))
                db.execute(
                    "UPDATE projects SET current_stage='process', updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (project_id,)
                )
                stage = "process"

    if stage == "process":
        ps = dict_from_row(db.execute(
            "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
        ).fetchone())
        if ps and not ps.get("is_paused"):
            checks = [
                bool(ps.get("comets_no") and str(ps["comets_no"]).strip()),
                bool(ps.get("email_from") and str(ps["email_from"]).strip()),
                bool(ps.get("order_confirmed")),
                bool(ps.get("report_number") and str(ps["report_number"]).strip()),
                ps.get("test_status") == "completed",
                ps.get("report_status") == "completed",
                ps.get("check_status") == "completed",
                ps.get("issue_status") == "completed",
            ]
            if all(checks):
                db.execute("UPDATE process_steps SET is_complete=1 WHERE project_id=?", (project_id,))
                db.execute(
                    "UPDATE projects SET current_stage='outputs', updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (project_id,)
                )
                stage = "outputs"

    if stage == "outputs":
        out = dict_from_row(db.execute(
            "SELECT * FROM outputs WHERE project_id=?", (project_id,)
        ).fetchone())
        wr = dict_from_row(db.execute(
            "SELECT * FROM work_requests WHERE project_id=?", (project_id,)
        ).fetchone())
        if out:
            work_type = wr.get("work_type", "") if wr else ""
            checks = [
                bool(out.get("report_approved")),
                bool(out.get("work_log_completed")),
                bool(out.get("comets_submitted")),
            ]
            if work_type in ("Investigation", "Investigation for Warranty"):
                checks.append(bool(out.get("claim_record_completed")))
            if work_type == "Evaluation":
                checks.append(bool(out.get("eval_record_completed")))
            if all(checks):
                db.execute("UPDATE outputs SET is_complete=1 WHERE project_id=?", (project_id,))
                db.execute(
                    "UPDATE projects SET current_stage='completed', status='completed', progress_percent=100, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (project_id,)
                )

    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if project and project["current_stage"] != "completed":
        progress = calculate_progress(project_id, project["current_stage"], db)
        db.execute("UPDATE projects SET progress_percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                   (progress, project_id))

    db.commit()


def get_full_project(project_id: int, db):
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        return None
    project["work_request"] = dict_from_row(
        db.execute("SELECT * FROM work_requests WHERE project_id=?", (project_id,)).fetchone()
    )
    project["process"] = dict_from_row(
        db.execute("SELECT * FROM process_steps WHERE project_id=?", (project_id,)).fetchone()
    )
    project["outputs"] = dict_from_row(
        db.execute("SELECT * FROM outputs WHERE project_id=?", (project_id,)).fetchone()
    )
    project["files"] = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM file_attachments WHERE project_id=? ORDER BY uploaded_at DESC", (project_id,)).fetchall()
    ]
    return project


@router.get("")
def list_projects(
    year: Optional[int] = None,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    db = get_db()
    query = "SELECT p.*, wr.requester, wr.customer_name, wr.work_type, wr.bearing_no, wr.due_date FROM projects p LEFT JOIN work_requests wr ON p.id = wr.project_id WHERE 1=1"
    params = []

    if year:
        query += " AND p.year = ?"
        params.append(year)
    if status:
        query += " AND p.status = ?"
        params.append(status)
    if stage:
        query += " AND p.current_stage = ?"
        params.append(stage)
    if search:
        query += " AND (p.title LIKE ? OR wr.customer_name LIKE ? OR wr.requester LIKE ? OR wr.bearing_no LIKE ?)"
        s = "%" + search + "%"
        params.extend([s, s, s, s])
    if date_from:
        query += " AND p.created_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND p.created_at <= ?"
        params.append(date_to + " 23:59:59")

    query += " ORDER BY p.updated_at DESC"
    rows = db.execute(query, params).fetchall()
    result = [dict_from_row(r) for r in rows]
    db.close()
    return result


@router.get("/summary")
def get_summary(
    year: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    db = get_db()
    base_where = " WHERE 1=1"
    params = []
    if year:
        base_where += " AND p.year = ?"
        params.append(year)
    if date_from:
        base_where += " AND p.created_at >= ?"
        params.append(date_from)
    if date_to:
        base_where += " AND p.created_at <= ?"
        params.append(date_to + " 23:59:59")

    base_from = "FROM projects p LEFT JOIN work_requests wr ON p.id = wr.project_id"

    total = db.execute(
        "SELECT COUNT(*) as cnt " + base_from + base_where, params
    ).fetchone()["cnt"]

    status_q = db.execute(
        "SELECT p.status, COUNT(*) as cnt " + base_from + base_where + " GROUP BY p.status", params
    ).fetchall()
    by_status = {r["status"]: r["cnt"] for r in status_q}

    stage_q = db.execute(
        "SELECT p.current_stage, COUNT(*) as cnt " + base_from + base_where + " GROUP BY p.current_stage", params
    ).fetchall()
    by_stage = {r["current_stage"]: r["cnt"] for r in stage_q}

    type_q = db.execute(
        "SELECT wr.work_type, COUNT(*) as cnt " + base_from + base_where + " AND wr.work_type IS NOT NULL AND wr.work_type != '' GROUP BY wr.work_type", params
    ).fetchall()
    by_type = {r["work_type"]: r["cnt"] for r in type_q}

    db.close()
    return {
        "total": total,
        "by_status": by_status,
        "by_stage": by_stage,
        "by_type": by_type,
    }


@router.post("")
def create_project(data: ProjectCreate):
    db = get_db()
    cursor = db.execute(
        "INSERT INTO projects (year, title) VALUES (?, ?)",
        (data.year, data.title)
    )
    project_id = cursor.lastrowid
    db.execute("INSERT INTO work_requests (project_id) VALUES (?)", (project_id,))
    db.execute("INSERT INTO process_steps (project_id) VALUES (?)", (project_id,))
    db.execute("INSERT INTO outputs (project_id) VALUES (?)", (project_id,))
    db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.get("/{project_id}")
def get_project(project_id: int):
    db = get_db()
    result = get_full_project(project_id, db)
    db.close()
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.put("/{project_id}")
def update_project(project_id: int, data: ProjectUpdate):
    db = get_db()
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE projects SET {set_clause}, updated_at=CURRENT_TIMESTAMP WHERE id=?", vals)
        db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.delete("/{project_id}")
def delete_project(project_id: int):
    db = get_db()
    project = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    import os
    files = db.execute("SELECT file_path FROM file_attachments WHERE project_id=?", (project_id,)).fetchall()
    for f in files:
        fp = f["file_path"]
        if os.path.exists(fp):
            os.remove(fp)
    db.execute("DELETE FROM projects WHERE id=?", (project_id,))
    db.commit()
    db.close()
    return {"message": "Project deleted successfully"}


@router.post("/{project_id}/pause")
def pause_project(project_id: int, data: PauseRequest):
    db = get_db()
    db.execute(
        "UPDATE projects SET status='paused', pause_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (data.reason, project_id)
    )
    db.execute(
        "UPDATE process_steps SET is_paused=1, pause_reason=? WHERE project_id=?",
        (data.reason, project_id)
    )
    db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.post("/{project_id}/resume")
def resume_project(project_id: int):
    db = get_db()
    db.execute(
        "UPDATE projects SET status='active', pause_reason='', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (project_id,)
    )
    db.execute(
        "UPDATE process_steps SET is_paused=0, pause_reason='' WHERE project_id=?",
        (project_id,)
    )
    db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.post("/{project_id}/start")
def start_process(project_id: int):
    db = get_db()
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    if project["current_stage"] != "work_request":
        db.close()
        raise HTTPException(status_code=400, detail="Project is not in work_request stage")
    db.execute("UPDATE work_requests SET is_complete=1 WHERE project_id=?", (project_id,))
    db.execute(
        "UPDATE projects SET current_stage='process', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (project_id,)
    )
    progress = calculate_progress(project_id, "process", db)
    db.execute("UPDATE projects SET progress_percent=? WHERE id=?", (progress, project_id))
    db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.put("/{project_id}/work-request")
def update_work_request(project_id: int, data: WorkRequestUpdate):
    db = get_db()
    wr = db.execute("SELECT * FROM work_requests WHERE project_id=?", (project_id,)).fetchone()
    if not wr:
        db.close()
        raise HTTPException(status_code=404, detail="Work request not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE work_requests SET {set_clause} WHERE project_id=?", vals)
        db.commit()
    check_auto_progression(project_id, db)
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.put("/{project_id}/process")
def update_process(project_id: int, data: ProcessUpdate):
    db = get_db()
    ps = db.execute("SELECT * FROM process_steps WHERE project_id=?", (project_id,)).fetchone()
    if not ps:
        db.close()
        raise HTTPException(status_code=404, detail="Process not found")
    updates = {}
    for k, v in data.model_dump().items():
        if v is not None:
            if isinstance(v, bool):
                updates[k] = 1 if v else 0
            else:
                updates[k] = v
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE process_steps SET {set_clause} WHERE project_id=?", vals)
        db.commit()
    check_auto_progression(project_id, db)
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.put("/{project_id}/outputs")
def update_outputs(project_id: int, data: OutputUpdate):
    db = get_db()
    out = db.execute("SELECT * FROM outputs WHERE project_id=?", (project_id,)).fetchone()
    if not out:
        db.close()
        raise HTTPException(status_code=404, detail="Outputs not found")
    updates = {}
    for k, v in data.model_dump().items():
        if v is not None:
            if isinstance(v, bool):
                updates[k] = 1 if v else 0
            else:
                updates[k] = v
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE outputs SET {set_clause} WHERE project_id=?", vals)
        db.commit()
    check_auto_progression(project_id, db)
    result = get_full_project(project_id, db)
    db.close()
    return result
