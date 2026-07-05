from fastapi import APIRouter, HTTPException
from database import get_db
from models import OutputUpdate

router = APIRouter(prefix="/api/projects", tags=["outputs"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("/{project_id}/outputs")
def get_outputs(project_id: int):
    db = get_db()
    out = dict_from_row(db.execute(
        "SELECT * FROM outputs WHERE project_id=?", (project_id,)
    ).fetchone())
    if not out:
        db.close()
        raise HTTPException(status_code=404, detail="Outputs not found")
    
    # Calculate progress (6 required steps = 10% of project, each step = 10/6 %)
    required_steps = sum(1 for i in range(1, 7) if out.get(f"step{i}_complete"))
    progress = int((required_steps / 6) * 10)
    
    db.close()
    return {
        "outputs": out,
        "progress": progress,
        "all_required_complete": required_steps >= 6
    }


@router.put("/{project_id}/outputs")
def update_outputs(project_id: int, data: OutputUpdate):
    db = get_db()
    out = dict_from_row(db.execute(
        "SELECT * FROM outputs WHERE project_id=?", (project_id,)
    ).fetchone())
    if not out:
        db.close()
        raise HTTPException(status_code=404, detail="Outputs not found")

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(project_id)
        db.execute(f"UPDATE outputs SET {set_clause} WHERE project_id=?", vals)
        db.commit()

    # Recalculate progress
    out_updated = dict_from_row(db.execute(
        "SELECT * FROM outputs WHERE project_id=?", (project_id,)
    ).fetchone())
    
    required_steps = sum(1 for i in range(1, 7) if out_updated.get(f"step{i}_complete"))
    outputs_progress = int((required_steps / 6) * 10)
    
    # Total project progress = 90 (from process) + outputs_progress
    project = dict_from_row(db.execute(
        "SELECT * FROM projects WHERE id=?", (project_id,)
    ).fetchone())
    
    if project and project["current_stage"] == "outputs":
        total_progress = 90 + outputs_progress
        if total_progress > 100:
            total_progress = 100
        db.execute(
            "UPDATE projects SET progress_percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (total_progress, project_id)
        )
        db.commit()

    db.close()
    return {"success": True, "progress": outputs_progress}


@router.post("/{project_id}/complete-outputs")
def complete_outputs(project_id: int):
    db = get_db()
    project = dict_from_row(db.execute(
        "SELECT * FROM projects WHERE id=?", (project_id,)
    ).fetchone())
    if not project:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")

    out = dict_from_row(db.execute(
        "SELECT * FROM outputs WHERE project_id=?", (project_id,)
    ).fetchone())
    
    if not out:
        db.close()
        raise HTTPException(status_code=404, detail="Outputs not found")

    # Check all 6 required steps are complete
    required_done = all(out.get(f"step{i}_complete") for i in range(1, 7))
    if not required_done:
        db.close()
        raise HTTPException(status_code=400, detail="All 6 required output steps must be completed first")

    from datetime import date
    today = date.today().isoformat()
    
    db.execute("UPDATE outputs SET is_complete=1 WHERE project_id=?", (project_id,))
    db.execute(
        "UPDATE projects SET current_stage='completed', status='completed', progress_percent=100, completed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (today, project_id)
    )
    db.commit()
    db.close()
    return {"success": True, "message": "Project completed successfully"}
