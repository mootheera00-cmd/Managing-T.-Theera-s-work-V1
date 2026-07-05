from fastapi import APIRouter, HTTPException
from database import get_db
from models import GanttTaskCreate, GanttTaskUpdate
from typing import Optional

router = APIRouter(prefix="/api/projects", tags=["gantt"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("/{project_id}/gantt-tasks")
def list_gantt_tasks(project_id: int):
    db = get_db()
    tasks = [
        dict_from_row(r) for r in
        db.execute(
            "SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC",
            (project_id,)
        ).fetchall()
    ]
    db.close()
    return tasks


@router.post("/{project_id}/gantt-tasks")
def create_gantt_task(project_id: int, data: GanttTaskCreate):
    db = get_db()
    
    # Get next order
    max_order = db.execute(
        "SELECT COALESCE(MAX(task_order), 0) as mx FROM gantt_tasks WHERE project_id=?",
        (project_id,)
    ).fetchone()["mx"]
    
    cursor = db.execute(
        """INSERT INTO gantt_tasks 
           (project_id, task_order, name, category, planned_start, planned_end, color)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (project_id, max_order + 1, data.name, data.category,
         data.planned_start, data.planned_end, data.color)
    )
    task_id = cursor.lastrowid
    db.commit()
    
    # Mark step 4 as having data
    db.execute(
        "UPDATE process_steps SET step4_complete=1 WHERE project_id=? AND step4_complete=0",
        (project_id,)
    )
    db.commit()
    
    task = dict_from_row(db.execute(
        "SELECT * FROM gantt_tasks WHERE id=?", (task_id,)
    ).fetchone())
    db.close()
    return task


@router.put("/{project_id}/gantt-tasks/{task_id}")
def update_gantt_task(project_id: int, task_id: int, data: GanttTaskUpdate):
    db = get_db()
    existing = dict_from_row(db.execute(
        "SELECT * FROM gantt_tasks WHERE id=? AND project_id=?", (task_id, project_id)
    ).fetchone())
    if not existing:
        db.close()
        raise HTTPException(status_code=404, detail="Gantt task not found")

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        vals = list(updates.values())
        vals.append(task_id)
        vals.append(project_id)
        db.execute(f"UPDATE gantt_tasks SET {set_clause}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?", vals)
        db.commit()

    task = dict_from_row(db.execute(
        "SELECT * FROM gantt_tasks WHERE id=?", (task_id,)
    ).fetchone())
    db.close()
    return task


@router.delete("/{project_id}/gantt-tasks/{task_id}")
def delete_gantt_task(project_id: int, task_id: int):
    db = get_db()
    db.execute("DELETE FROM gantt_tasks WHERE id=? AND project_id=?", (task_id, project_id))
    db.commit()
    
    # Reorder remaining tasks
    remaining = db.execute(
        "SELECT id FROM gantt_tasks WHERE project_id=? ORDER BY task_order ASC",
        (project_id,)
    ).fetchall()
    for idx, r in enumerate(remaining):
        db.execute("UPDATE gantt_tasks SET task_order=? WHERE id=?", (idx + 1, r["id"]))
    db.commit()
    db.close()
    return {"success": True}


@router.post("/{project_id}/gantt-tasks/reorder")
def reorder_gantt_tasks(project_id: int, data: dict):
    """Reorder tasks. Expects {"order": [id1, id2, id3, ...]}"""
    order = data.get("order", [])
    db = get_db()
    for idx, task_id in enumerate(order):
        db.execute(
            "UPDATE gantt_tasks SET task_order=? WHERE id=? AND project_id=?",
            (idx + 1, task_id, project_id)
        )
    db.commit()
    db.close()
    return {"success": True}
