from pydantic import BaseModel
from typing import Optional

class ProjectCreate(BaseModel):
    year: int
    title: str

class ProjectUpdate(BaseModel):
    year: Optional[int] = None
    title: Optional[str] = None
    current_stage: Optional[str] = None
    progress_percent: Optional[int] = None
    status: Optional[str] = None
    pause_reason: Optional[str] = None

class PauseRequest(BaseModel):
    reason: str = ""

class WorkRequestUpdate(BaseModel):
    requester: Optional[str] = None
    customer_name: Optional[str] = None
    work_type: Optional[str] = None
    bearing_no: Optional[str] = None
    received_date: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None

class ProcessUpdate(BaseModel):
    comets_no: Optional[str] = None
    comets_url: Optional[str] = None
    email_from: Optional[str] = None
    email_attachment_info: Optional[str] = None
    order_confirmed: Optional[bool] = None
    report_number: Optional[str] = None
    folder_path: Optional[str] = None
    test_status: Optional[str] = None
    report_status: Optional[str] = None
    store_report_status: Optional[str] = None
    check_status: Optional[str] = None
    is_paused: Optional[bool] = None
    pause_reason: Optional[str] = None

class OutputUpdate(BaseModel):
    report_approved: Optional[bool] = None
    report_revising: Optional[bool] = None
    revision_notes: Optional[str] = None
    work_log_completed: Optional[bool] = None
    claim_record_completed: Optional[bool] = None
    eval_record_completed: Optional[bool] = None
    comets_submitted: Optional[bool] = None
    comets_no: Optional[str] = None
    submission_date: Optional[str] = None

class EvalProcessEntryCreate(BaseModel):
    entry_date: str
    tasks_today: Optional[str] = ""
    tasks_tomorrow: Optional[str] = ""

class EvalProcessEntryUpdate(BaseModel):
    tasks_today: Optional[str] = None
    tasks_tomorrow: Optional[str] = None

class ReportNumberCreate(BaseModel):
    report_number: str
    item_description: str = ""
    folder_path: str = ""

class ReportNumberUpdate(BaseModel):
    report_number: Optional[str] = None
    item_description: Optional[str] = None
    folder_path: Optional[str] = None

class GanttTaskModel(BaseModel):
    id: str
    name: str
    category: str
    start: str
    end: str
    progress: int
    color: str

class GanttInitializePayload(BaseModel):
    step: str
    report_number: str
    tasks: list[GanttTaskModel]

class GanttTaskCreatePayload(BaseModel):
    id: str
    step: str
    report_number: str
    name: str
    category: str
    start: str
    end: str
    progress: int
    color: str

class GanttTaskUpdatePayload(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    progress: Optional[int] = None
    color: Optional[str] = None


class TimeLogCreate(BaseModel):
    project_id: int
    task_id: str
    task_name: str
    entry_date: str
    hours: float
    slots_json: str


