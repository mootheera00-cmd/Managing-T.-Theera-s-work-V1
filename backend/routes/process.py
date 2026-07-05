from fastapi import APIRouter, HTTPException
from database import get_db
from models import ProcessStepUpdate, ProcessUpdate

router = APIRouter(prefix="/api/projects", tags=["process"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


def calculate_process_progress(project_id: int, db) -> int:
    """Calculate process stage progress:
    - Steps 1-3 complete = 10% of total project
    - Step 4 (Gantt tasks) = 80% of total project
    - Step 5 complete unlocks to outputs
    """
    ps = dict_from_row(db.execute(
        "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
    ).fetchone())
    if not ps:
        return 0

    # Steps 1-3: each gives 10/3 % when complete
    steps_123_done = sum(1 for i in range(1, 4) if ps.get(f"step{i}_complete"))
    progress_123 = (steps_123_done / 3) * 10  # 0 to 10

    # Step 4: Gantt tasks = 80%
    # Count total tasks and completed tasks
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


@router.get("/{project_id}/process")
def get_process(project_id: int):
    db = get_db()
    ps = dict_from_row(db.execute(
        "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
    ).fetchone())
    if not ps:
        db.close()
        raise HTTPException(status_code=404, detail="Process not found")
    
    # Get gantt tasks
    tasks = [
        dict_from_row(r) for r in
        db.execute("SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC", (project_id,)).fetchall()
    ]
    
    progress = calculate_process_progress(project_id, db)
    db.close()
    return {
        "process": ps,
        "gantt_tasks": tasks,
        "progress": progress
    }


@router.put("/{project_id}/process/step/{step_num}")
def update_process_step(project_id: int, step_num: int, data: ProcessStepUpdate):
    if step_num < 1 or step_num > 5:
        raise HTTPException(status_code=400, detail="Step number must be 1-5")
    
    db = get_db()
    ps = dict_from_row(db.execute(
        "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
    ).fetchone())
    if not ps:
        db.close()
        raise HTTPException(status_code=404, detail="Process not found")

    updates = {}
    if data.label is not None:
        updates[f"step{step_num}_label"] = data.label
    if data.data is not None:
        updates[f"step{step_num}_data"] = data.data
    if data.complete is not None:
        updates[f"step{step_num}_complete"] = 1 if data.complete else 0

    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE process_steps SET {set_clause} WHERE project_id=?", vals)
        db.commit()

    # Recalculate and update project progress
    progress = calculate_process_progress(project_id, db)
    
    # Check if all 5 steps are complete for advancement
    ps_updated = dict_from_row(db.execute(
        "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
    ).fetchone())
    
    all_steps_done = all(ps_updated.get(f"step{i}_complete") for i in range(1, 6))
    
    db.execute(
        "UPDATE projects SET progress_percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (progress, project_id)
    )
    db.commit()
    db.close()
    return {"success": True, "progress": progress, "all_steps_complete": bool(all_steps_done)}


@router.put("/{project_id}/process")
def update_process(project_id: int, data: ProcessUpdate):
    db = get_db()
    ps = dict_from_row(db.execute(
        "SELECT * FROM process_steps WHERE project_id=?", (project_id,)
    ).fetchone())
    if not ps:
        db.close()
        raise HTTPException(status_code=404, detail="Process not found")

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE process_steps SET {set_clause} WHERE project_id=?", vals)
        db.commit()

    progress = calculate_process_progress(project_id, db)
    db.execute(
        "UPDATE projects SET progress_percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (progress, project_id)
    )
    db.commit()
    db.close()
    return {"success": True, "progress": progress}
