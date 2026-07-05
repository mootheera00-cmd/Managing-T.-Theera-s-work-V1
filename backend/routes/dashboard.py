from fastapi import APIRouter
from database import get_db
from datetime import date, datetime

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


@router.get("")
def get_dashboard():
    db = get_db()
    today = date.today().isoformat()
    today_dt = date.today()

    # 1. Today's tasks: gantt tasks where planned_start <= today <= planned_end
    today_tasks = []
    rows = db.execute("""
        SELECT gt.*, p.title as project_title, p.work_type, p.customer_name,
               p.due_date, p.id as project_id
        FROM gantt_tasks gt
        JOIN projects p ON gt.project_id = p.id
        WHERE gt.planned_start <= ? AND gt.planned_end >= ?
          AND p.status != 'completed'
        ORDER BY gt.planned_start ASC
    """, (today, today)).fetchall()

    for r in rows:
        task = dict_from_row(r)
        # Calculate progress
        if task.get("actual_end"):
            task["status"] = "completed"
        elif task.get("actual_start"):
            task["status"] = "in_progress"
        else:
            task["status"] = "pending"
        today_tasks.append(task)

    # 2. Active projects with upcoming deadlines (not completed, not paused)
    active_projects = []
    rows = db.execute("""
        SELECT p.*, wr.due_date as wr_due_date, wr.work_type as wr_work_type,
               wr.customer_name as wr_customer, wr.bearing_no as wr_bearing
        FROM projects p
        LEFT JOIN work_requests wr ON p.id = wr.project_id
        WHERE p.status = 'active' AND p.current_stage != 'completed'
        ORDER BY COALESCE(p.due_date, wr.due_date, '9999-12-31') ASC
    """).fetchall()

    for r in rows:
        proj = dict_from_row(r)
        due = proj.get("due_date") or proj.get("wr_due_date") or ""
        proj["due_date"] = due
        if due:
            try:
                due_dt = datetime.strptime(due[:10], "%Y-%m-%d").date()
                proj["days_remaining"] = (due_dt - today_dt).days
            except (ValueError, TypeError):
                proj["days_remaining"] = None
        else:
            proj["days_remaining"] = None
        proj["work_type"] = proj.get("work_type") or proj.get("wr_work_type") or ""
        proj["customer_name"] = proj.get("customer_name") or proj.get("wr_customer") or ""
        proj["bearing_no"] = proj.get("bearing_no") or proj.get("wr_bearing") or ""
        # Get gantt tasks count
        task_count = db.execute(
            "SELECT COUNT(*) as cnt FROM gantt_tasks WHERE project_id=?",
            (proj["id"],)
        ).fetchone()["cnt"]
        completed_tasks = db.execute(
            "SELECT COUNT(*) as cnt FROM gantt_tasks WHERE project_id=? AND progress >= 100",
            (proj["id"],)
        ).fetchone()["cnt"]
        proj["total_tasks"] = task_count
        proj["completed_tasks"] = completed_tasks
        # Attach process and outputs for stacked progress bar
        proj["process"] = dict_from_row(
            db.execute("SELECT * FROM process_steps WHERE project_id=?", (proj["id"],)).fetchone()
        )
        proj["outputs"] = dict_from_row(
            db.execute("SELECT * FROM outputs WHERE project_id=?", (proj["id"],)).fetchone()
        )
        active_projects.append(proj)

    # 3. Summary stats
    total_active = len(active_projects)
    overdue_count = sum(1 for p in active_projects if p.get("days_remaining") is not None and p["days_remaining"] < 0)
    due_soon_count = sum(1 for p in active_projects if p.get("days_remaining") is not None and 0 <= p["days_remaining"] <= 3)
    today_task_count = len(today_tasks)

    db.close()
    return {
        "today": today,
        "today_tasks": today_tasks,
        "active_projects": active_projects,
        "stats": {
            "total_active": total_active,
            "overdue_count": overdue_count,
            "due_soon_count": due_soon_count,
            "today_task_count": today_task_count,
        }
    }
