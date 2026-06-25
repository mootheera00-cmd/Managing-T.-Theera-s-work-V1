from fastapi import APIRouter, HTTPException
from database import get_db
from models import (
    GanttTaskModel,
    GanttInitializePayload,
    GanttTaskCreatePayload,
    GanttTaskUpdatePayload,
)

router = APIRouter(prefix="/api/projects", tags=["gantt"])


def dict_from_row(row):
    if row is None:
        return None
    d = dict(row)
    # Map start_date to start and end_date to end to match frontend expectations
    if "start_date" in d:
        d["start"] = d.pop("start_date")
    if "end_date" in d:
        d["end"] = d.pop("end_date")
    return d


@router.get("/{project_id}/gantt-tasks")
def list_gantt_tasks(project_id: int, step: str, report_number: str = ""):
    db = get_db()
    # Check if this combo is initialized
    init = db.execute(
        "SELECT 1 FROM gantt_initializations WHERE project_id=? AND step=? AND report_number=?",
        (project_id, step, report_number),
    ).fetchone()

    if not init:
        db.close()
        return {"initialized": False, "tasks": []}

    rows = db.execute(
        "SELECT * FROM gantt_tasks WHERE project_id=? AND step=? AND report_number=? ORDER BY created_at ASC",
        (project_id, step, report_number),
    ).fetchall()
    db.close()

    return {"initialized": True, "tasks": [dict_from_row(r) for r in rows]}


@router.post("/{project_id}/gantt-tasks/initialize")
def initialize_gantt_tasks(project_id: int, payload: GanttInitializePayload):
    db = get_db()
    
    # Check if project exists
    proj = db.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone()
    if not proj:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if already initialized
    init = db.execute(
        "SELECT 1 FROM gantt_initializations WHERE project_id=? AND step=? AND report_number=?",
        (project_id, payload.step, payload.report_number),
    ).fetchone()

    if init:
        # If already initialized, we don't overwrite with default values, just return existing
        rows = db.execute(
            "SELECT * FROM gantt_tasks WHERE project_id=? AND step=? AND report_number=? ORDER BY created_at ASC",
            (project_id, payload.step, payload.report_number),
        ).fetchall()
        db.close()
        return {"initialized": True, "tasks": [dict_from_row(r) for r in rows]}

    # Mark as initialized
    db.execute(
        "INSERT INTO gantt_initializations (project_id, step, report_number) VALUES (?, ?, ?)",
        (project_id, payload.step, payload.report_number),
    )

    # Insert default tasks
    for task in payload.tasks:
        db.execute(
            "INSERT INTO gantt_tasks (id, project_id, step, report_number, name, category, start_date, end_date, progress, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                task.id,
                project_id,
                payload.step,
                payload.report_number,
                task.name,
                task.category,
                task.start,
                task.end,
                task.progress,
                task.color,
            ),
        )

    db.commit()

    rows = db.execute(
        "SELECT * FROM gantt_tasks WHERE project_id=? AND step=? AND report_number=? ORDER BY created_at ASC",
        (project_id, payload.step, payload.report_number),
    ).fetchall()
    db.close()

    return {"initialized": True, "tasks": [dict_from_row(r) for r in rows]}


@router.post("/{project_id}/gantt-tasks")
def create_gantt_task(project_id: int, payload: GanttTaskCreatePayload):
    db = get_db()
    
    # Check if project exists
    proj = db.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone()
    if not proj:
        db.close()
        raise HTTPException(status_code=404, detail="Project not found")

    db.execute(
        "INSERT INTO gantt_tasks (id, project_id, step, report_number, name, category, start_date, end_date, progress, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            payload.id,
            project_id,
            payload.step,
            payload.report_number,
            payload.name,
            payload.category,
            payload.start,
            payload.end,
            payload.progress,
            payload.color,
        ),
    )
    db.commit()

    row = db.execute(
        "SELECT * FROM gantt_tasks WHERE id=? AND project_id=?",
        (payload.id, project_id),
    ).fetchone()
    db.close()

    return dict_from_row(row)


@router.put("/{project_id}/gantt-tasks/{task_id}")
def update_gantt_task(project_id: int, task_id: str, payload: GanttTaskUpdatePayload):
    db = get_db()
    task = db.execute(
        "SELECT * FROM gantt_tasks WHERE id=? AND project_id=?",
        (task_id, project_id),
    ).fetchone()
    if not task:
        db.close()
        raise HTTPException(status_code=404, detail="Gantt task not found")

    task = dict(task)
    name = payload.name if payload.name is not None else task["name"]
    category = payload.category if payload.category is not None else task["category"]
    start_date = payload.start if payload.start is not None else task["start_date"]
    end_date = payload.end if payload.end is not None else task["end_date"]
    progress = payload.progress if payload.progress is not None else task["progress"]
    color = payload.color if payload.color is not None else task["color"]

    db.execute(
        "UPDATE gantt_tasks SET name=?, category=?, start_date=?, end_date=?, progress=?, color=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?",
        (name, category, start_date, end_date, progress, color, task_id, project_id),
    )
    db.commit()

    row = db.execute(
        "SELECT * FROM gantt_tasks WHERE id=? AND project_id=?",
        (task_id, project_id),
    ).fetchone()
    db.close()

    return dict_from_row(row)


@router.delete("/{project_id}/gantt-tasks/{task_id}")
def delete_gantt_task(project_id: int, task_id: str):
    db = get_db()
    task = db.execute(
        "SELECT id FROM gantt_tasks WHERE id=? AND project_id=?",
        (task_id, project_id),
    ).fetchone()
    if not task:
        db.close()
        raise HTTPException(status_code=404, detail="Gantt task not found")

    db.execute("DELETE FROM gantt_tasks WHERE id=? AND project_id=?", (task_id, project_id))
    db.commit()
    db.close()

    return {"ok": True}
