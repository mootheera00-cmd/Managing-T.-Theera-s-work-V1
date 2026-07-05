from pydantic import BaseModel
from typing import Optional

class ProjectCreate(BaseModel):
    year: int
    title: str
    requester: str = ''
    customer_name: str = ''
    work_type: str = ''
    bearing_no: str = ''
    received_date: str = ''
    due_date: str = ''
    notes: str = ''

class ProjectUpdate(BaseModel):
    year: Optional[int] = None
    title: Optional[str] = None
    current_stage: Optional[str] = None
    progress_percent: Optional[int] = None
    status: Optional[str] = None
    pause_reason: Optional[str] = None
    work_type: Optional[str] = None
    requester: Optional[str] = None
    customer_name: Optional[str] = None
    bearing_no: Optional[str] = None
    received_date: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None

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

# Process Step updates
class ProcessStepUpdate(BaseModel):
    step_num: int  # 1-5
    label: Optional[str] = None
    data: Optional[str] = None
    complete: Optional[bool] = None

class ProcessUpdate(BaseModel):
    comets_no: Optional[str] = None
    comets_url: Optional[str] = None
    email_from: Optional[str] = None
    email_attachment_info: Optional[str] = None
    order_confirmed: Optional[bool] = None
    report_number: Optional[str] = None
    folder_path: Optional[str] = None
    step1_data: Optional[str] = None
    step1_complete: Optional[bool] = None
    step2_data: Optional[str] = None
    step2_complete: Optional[bool] = None
    step3_data: Optional[str] = None
    step3_complete: Optional[bool] = None
    step4_data: Optional[str] = None
    step4_complete: Optional[bool] = None
    step5_data: Optional[str] = None
    step5_complete: Optional[bool] = None

class OutputUpdate(BaseModel):
    step1_complete: Optional[bool] = None
    step2_complete: Optional[bool] = None
    step3_complete: Optional[bool] = None
    step4_complete: Optional[bool] = None
    step5_complete: Optional[bool] = None
    step6_complete: Optional[bool] = None
    step7_complete: Optional[bool] = None
    step7_data: Optional[str] = None
    report_no: Optional[str] = None
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

# Gantt Task models
class GanttTaskCreate(BaseModel):
    name: str
    category: str = ''
    planned_start: str = ''
    planned_end: str = ''
    color: str = 'blue'

class GanttTaskUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    progress: Optional[int] = None
    color: Optional[str] = None
    task_order: Optional[int] = None

# Time Log models (CSV format)
class TimeLogCreate(BaseModel):
    project_id: int
    task_id: int = 0
    task_name: str = ''
    entry_date: str
    user_name: str = ''
    group_name: str = 'HUB'
    sales: str = ''
    category: str = ''
    customer: str = ''
    aptx: str = ''
    code: str = ''
    hours: float = 0
    comment: str = ''
    mode: str = 'log'

class TimeLogUpdate(BaseModel):
    task_id: Optional[int] = None
    task_name: Optional[str] = None
    user_name: Optional[str] = None
    group_name: Optional[str] = None
    sales: Optional[str] = None
    category: Optional[str] = None
    customer: Optional[str] = None
    aptx: Optional[str] = None
    code: Optional[str] = None
    hours: Optional[float] = None
    comment: Optional[str] = None
    mode: Optional[str] = None
