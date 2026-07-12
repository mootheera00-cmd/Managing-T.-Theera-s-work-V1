from fastapi import APIRouter, HTTPException, Header
from database import get_db
from models import (
    ProjectCreate, ProjectUpdate,
    WorkRequestUpdate, ReportNumberCreate, ReportNumberUpdate
)
from typing import Optional
import os
from routes.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


def get_full_project(project_id: int, db):
    project = dict_from_row(db.execute("""
        SELECT p.*, u.display_name as owner_display_name
        FROM projects p
        LEFT JOIN users u ON p.owner_username = u.username
        WHERE p.id=?
    """, (project_id,)).fetchone())
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
    project["report_numbers"] = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM report_numbers WHERE project_id=? ORDER BY id ASC", (project_id,)).fetchall()
    ]
    project["gantt_tasks"] = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC", (project_id,)).fetchall()
    ]
    return project


def calculate_project_progress(project_id: int, db) -> int:
    """Calculate overall project progress:
    - Work Request: 0%
    - Process: Steps 1-3 (10%) + Step 4 Gantt (80%) = up to 90%
    - Outputs: Steps 1-6 (10%) = up to 100%
    """
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        return 0
    
    stage = project["current_stage"]
    
    if stage == "completed":
        return 100
    if stage == "work_request":
        # Check how many fields are filled
        wr = dict_from_row(db.execute(
            "SELECT * FROM work_requests WHERE project_id=?", (project_id,)
        ).fetchone())
        if not wr:
            return 0
        fields = ["requester", "customer_name", "work_type", "bearing_no", "due_date"]
        filled = sum(1 for f in fields if wr.get(f) and str(wr[f]).strip())
        return int((filled / len(fields)) * 5)  # Max 5% for filled form
    
    if stage == "process":
        ps = dict_from_row(db.execute(
            "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
        ).fetchone())
        if not ps:
            return 10  # Just entered process
        
        # Steps 1-3: each gives 10/3 % when complete
        steps_123_done = sum(1 for i in range(1, 4) if ps.get(f"step{i}_complete"))
        progress_123 = (steps_123_done / 3) * 10

        # Step 4: Gantt tasks = 80%
        tasks = db.execute(
            "SELECT COUNT(*) as total FROM gantt_tasks WHERE project_id=?",
            (project_id,)
        ).fetchone()
        completed_tasks = db.execute(
            "SELECT COUNT(*) as total FROM gantt_tasks WHERE project_id=? AND progress >= 100",
            (project_id,)
        ).fetchone()
        total_tasks = tasks["total"] if tasks else 0
        done_tasks = completed_tasks["total"] if completed_tasks else 0
        
        if total_tasks > 0:
            progress_4 = (done_tasks / total_tasks) * 80
        elif ps.get("step4_complete"):
            progress_4 = 80
        else:
            progress_4 = 0

        return int(progress_123 + progress_4)
    
    if stage == "outputs":
        out = dict_from_row(db.execute(
            "SELECT * FROM outputs WHERE project_id=?", (project_id,)
        ).fetchone())
        if not out:
            return 90
        
        required_steps = sum(1 for i in range(1, 7) if out.get(f"step{i}_complete"))
        outputs_progress = int((required_steps / 6) * 10)
        return 90 + outputs_progress
    
    return 0


@router.get("")
def list_projects(
    year: Optional[int] = None,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    search: Optional[str] = None,
    work_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    owner: Optional[str] = None,
    authorization: str = Header(''),
):
    db = get_db()
    query = """SELECT p.*, wr.requester as wr_requester, wr.customer_name as wr_customer, 
               wr.work_type as wr_work_type, wr.bearing_no as wr_bearing_no, 
               wr.due_date as wr_due_date,
               u.display_name as owner_display_name
               FROM projects p 
               LEFT JOIN work_requests wr ON p.id = wr.project_id 
               LEFT JOIN users u ON p.owner_username = u.username
               WHERE 1=1"""
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
    if work_type:
        query += " AND (p.work_type = ? OR wr.work_type = ?)"
        params.extend([work_type, work_type])
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
    if owner:
        query += " AND p.owner_username = ?"
        params.append(owner)

    query += " ORDER BY p.updated_at DESC"
    rows = db.execute(query, params).fetchall()
    result = []
    for r in rows:
        p = dict_from_row(r)
        # Map work_request fields
        p["requester"] = p.pop("wr_requester", "") or ""
        p["customer_name"] = p.pop("wr_customer", "") or ""
        p["work_type"] = p.pop("wr_work_type", "") or p.get("work_type", "") or ""
        p["bearing_no"] = p.pop("wr_bearing_no", "") or ""
        p["due_date"] = p.pop("wr_due_date", "") or ""
        
        # Attach report_numbers
        p["report_numbers"] = [
            dict_from_row(rn) for rn in
            db.execute("SELECT * FROM report_numbers WHERE project_id=? ORDER BY id ASC", (p["id"],)).fetchall()
        ]
        # Attach process, gantt_tasks, outputs for stacked progress bar
        p["process"] = dict_from_row(
            db.execute("SELECT * FROM process_steps WHERE project_id=?", (p["id"],)).fetchone()
        )
        p["gantt_tasks"] = [
            dict_from_row(r) for r in
            db.execute("SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC", (p["id"],)).fetchall()
        ]
        p["outputs"] = dict_from_row(
            db.execute("SELECT * FROM outputs WHERE project_id=?", (p["id"],)).fetchone()
        )
        result.append(p)

    db.close()
    return result


@router.get("/summary")
def get_summary(year: Optional[int] = None, owner: Optional[str] = None):
    db = get_db()
    base_where = " WHERE 1=1"
    params = []
    if year:
        base_where += " AND p.year = ?"
        params.append(year)
    if owner:
        base_where += " AND p.owner_username = ?"
        params.append(owner)

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
        "SELECT COALESCE(p.work_type, wr.work_type, '') as wt, COUNT(*) as cnt " + base_from + base_where + " GROUP BY wt",
        params
    ).fetchall()
    by_type = {r["wt"]: r["cnt"] for r in type_q if r["wt"]}

    db.close()
    return {
        "total": total,
        "by_status": by_status,
        "by_stage": by_stage,
        "by_type": by_type,
    }


@router.get("/group")
def list_group_projects(year: Optional[int] = None, authorization: str = Header('')):
    """Return ALL projects for the group view (read-only for non-owners)."""
    db = get_db()
    query = """SELECT p.* FROM projects p WHERE 1=1"""
    params = []
    if year:
        query += " AND p.year = ?"
        params.append(year)
    query += " ORDER BY p.work_type, p.updated_at DESC"
    rows = db.execute(query, params).fetchall()
    result = []
    for r in rows:
        p = dict_from_row(r)
        p["process"] = dict_from_row(
            db.execute("SELECT * FROM process_steps WHERE project_id=?", (p["id"],)).fetchone()
        )
        p["gantt_tasks"] = [
            dict_from_row(r) for r in
            db.execute("SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC", (p["id"],)).fetchall()
        ]
        p["outputs"] = dict_from_row(
            db.execute("SELECT * FROM outputs WHERE project_id=?", (p["id"],)).fetchone()
        )
        result.append(p)
    db.close()
    return result


@router.post("")
def create_project(data: ProjectCreate, authorization: str = Header('')):
    owner = ''
    if authorization:
        try:
            u = get_current_user(authorization)
            owner = u.get('username', '')
        except: pass
    db = get_db()
    cursor = db.execute(
        "INSERT INTO projects (year, title, work_type, requester, customer_name, bearing_no, received_date, due_date, notes, owner_username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (data.year, data.title, data.work_type, data.requester, data.customer_name, data.bearing_no, data.received_date, data.due_date, data.notes, owner)
    )
    project_id = cursor.lastrowid
    db.execute(
        "INSERT INTO work_requests (project_id, requester, customer_name, work_type, bearing_no, received_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (project_id, data.requester, data.customer_name, data.work_type, data.bearing_no, data.received_date, data.due_date, data.notes)
    )
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
def update_project(project_id: int, data: ProjectUpdate, authorization: str = Header('')):
    db = get_db()
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    # Owner check
    if authorization:
        try:
            u = get_current_user(authorization)
            if project.get('owner_username') and project['owner_username'] != u.get('username'):
                if u.get('role') != 'admin':
                    db.close(); raise HTTPException(status_code=403, detail="Not your project")
        except: pass
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
def delete_project(project_id: int, authorization: str = Header('')):
    db = get_db()
    project = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    # Owner check
    if authorization:
        try:
            u = get_current_user(authorization)
            if project['owner_username'] and project['owner_username'] != u.get('username'):
                if u.get('role') != 'admin':
                    db.close(); raise HTTPException(status_code=403, detail="Not your project")
        except: pass
    
    # Delete associated files
    files = db.execute("SELECT file_path FROM file_attachments WHERE project_id=?", (project_id,)).fetchall()
    for f in files:
        fp = f["file_path"]
        if os.path.exists(fp):
            try:
                os.remove(fp)
            except Exception:
                pass
    
    # Delete project folder if exists
    try:
        from pathlib import Path
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        uploads_dir = os.path.join(base_dir, "uploads")
        project_folder = os.path.join(uploads_dir, f"{project['received_date']}_{project['work_type']}_{project['title']}".replace(" ", "_"))
        project_folder2 = os.path.join(uploads_dir, str(project['id']))
        for folder in [project_folder, project_folder2]:
            if os.path.exists(folder):
                import shutil
                shutil.rmtree(folder)
    except Exception:
        pass
    
    # CASCADE will delete related records
    db.execute("DELETE FROM projects WHERE id=?", (project_id,))
    db.commit()
    db.close()
    return {"success": True}


@router.post("/{project_id}/start")
def start_process(project_id: int, authorization: str = Header('')):
    """Move project from Work Request to Process stage"""
    db = get_db()
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    # Owner check
    if authorization:
        try:
            u = get_current_user(authorization)
            if project.get('owner_username') and project['owner_username'] != u.get('username'):
                if u.get('role') != 'admin':
                    db.close(); raise HTTPException(status_code=403, detail="Not your project")
        except: pass
    
    if project["current_stage"] != "work_request":
        db.close()
        raise HTTPException(status_code=400, detail="Project is not in Work Request stage")
    
    # Update stage
    db.execute(
        "UPDATE projects SET current_stage='process', progress_percent=10, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (project_id,)
    )
    db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.post("/{project_id}/advance-to-outputs")
def advance_to_outputs(project_id: int):
    """Advance from Process to Outputs stage"""
    db = get_db()
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project["current_stage"] != "process":
        db.close()
        raise HTTPException(status_code=400, detail="Project is not in Process stage")
    
    # Check all 5 steps complete
    ps = dict_from_row(db.execute(
        "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
    ).fetchone())
    
    if not ps:
        db.close()
        raise HTTPException(status_code=400, detail="Process data not found")
    
    all_steps_done = all(ps.get(f"step{i}_complete") for i in range(1, 6))
    if not all_steps_done:
        db.close()
        raise HTTPException(status_code=400, detail="All 5 process steps must be completed first")

    # Check all Gantt tasks are 100% complete
    incomplete = db.execute(
        "SELECT COUNT(*) as cnt FROM gantt_tasks WHERE project_id=? AND progress < 100",
        (project_id,)
    ).fetchone()["cnt"]
    if incomplete > 0:
        db.close()
        raise HTTPException(status_code=400, detail=f"Cannot advance: {incomplete} Gantt task(s) are not at 100% yet")

    db.execute("UPDATE process_steps SET is_complete=1 WHERE project_id=?", (project_id,))
    db.execute(
        "UPDATE projects SET current_stage='outputs', progress_percent=90, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (project_id,)
    )
    db.commit()
    result = get_full_project(project_id, db)
    db.close()
    return result


@router.put("/{project_id}/work-request")
def update_work_request(project_id: int, data: WorkRequestUpdate):
    db = get_db()
    wr = dict_from_row(db.execute(
        "SELECT * FROM work_requests WHERE project_id=?", (project_id,)
    ).fetchone())
    if not wr:
        db.close()
        raise HTTPException(status_code=404, detail="Work request not found")

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE work_requests SET {set_clause} WHERE project_id=?", vals)
        
        # Also update project denormalized fields
        proj_updates = {}
        if "requester" in updates:
            proj_updates["requester"] = updates["requester"]
        if "customer_name" in updates:
            proj_updates["customer_name"] = updates["customer_name"]
        if "work_type" in updates:
            proj_updates["work_type"] = updates["work_type"]
        if "bearing_no" in updates:
            proj_updates["bearing_no"] = updates["bearing_no"]
        if "received_date" in updates:
            proj_updates["received_date"] = updates["received_date"]
        if "due_date" in updates:
            proj_updates["due_date"] = updates["due_date"]
        if "notes" in updates:
            proj_updates["notes"] = updates["notes"]
        
        if proj_updates:
            p_set = ", ".join(f"{k}=?" for k in proj_updates.keys())
            p_vals = list(proj_updates.values())
            p_vals.append(project_id)
            db.execute(f"UPDATE projects SET {p_set}, updated_at=CURRENT_TIMESTAMP WHERE id=?", p_vals)
        
        db.commit()
    
    result = get_full_project(project_id, db)
    db.close()
    return result


# --- Report Numbers ---
@router.get("/{project_id}/report-numbers")
def list_report_numbers(project_id: int):
    db = get_db()
    rns = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM report_numbers WHERE project_id=? ORDER BY id ASC", (project_id,)).fetchall()
    ]
    db.close()
    return rns


@router.post("/{project_id}/report-numbers")
def create_report_number(project_id: int, data: ReportNumberCreate):
    db = get_db()
    cursor = db.execute(
        "INSERT INTO report_numbers (project_id, report_number, item_description, folder_path) VALUES (?, ?, ?, ?)",
        (project_id, data.report_number, data.item_description, data.folder_path)
    )
    db.commit()
    rn = dict_from_row(db.execute(
        "SELECT * FROM report_numbers WHERE id=?", (cursor.lastrowid,)
    ).fetchone())
    db.close()
    return rn


@router.put("/{project_id}/report-numbers/{rn_id}")
def update_report_number(project_id: int, rn_id: int, data: ReportNumberUpdate):
    db = get_db()
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(rn_id)
        vals.append(project_id)
        db.execute(f"UPDATE report_numbers SET {set_clause} WHERE id=? AND project_id=?", vals)
        db.commit()
    rn = dict_from_row(db.execute(
        "SELECT * FROM report_numbers WHERE id=?", (rn_id,)
    ).fetchone())
    db.close()
    return rn


@router.delete("/{project_id}/report-numbers/{rn_id}")
def delete_report_number(project_id: int, rn_id: int):
    db = get_db()
    db.execute("DELETE FROM report_numbers WHERE id=? AND project_id=?", (rn_id, project_id))
    db.commit()
    db.close()
    return {"success": True}


@router.post("/{project_id}/pause")
def pause_project(project_id: int, data: dict):
    reason = data.get("reason", "")
    db = get_db()
    db.execute(
        "UPDATE projects SET status='paused', pause_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (reason, project_id)
    )
    db.commit()
    db.close()
    return {"success": True}


@router.post("/{project_id}/resume")
def resume_project(project_id: int):
    db = get_db()
    db.execute(
        "UPDATE projects SET status='active', pause_reason='', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (project_id,)
    )
    db.commit()
    db.close()
    return {"success": True}


@router.post("/{project_id}/revert-stage")
def revert_stage(project_id: int):
    db = get_db()
    project = dict_from_row(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")
    
    stage_order = ["work_request", "process", "outputs"]
    current = project["current_stage"]
    if current in stage_order:
        idx = stage_order.index(current)
        if idx > 0:
            prev_stage = stage_order[idx - 1]
            db.execute(
                "UPDATE projects SET current_stage=?, progress_percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (prev_stage, calculate_project_progress(project_id, db), project_id)
            )
            db.commit()
    
    result = get_full_project(project_id, db)
    db.close()
    return result
