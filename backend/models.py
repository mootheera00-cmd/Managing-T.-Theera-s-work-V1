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
    email_from: Optional[str] = None
    email_attachment_info: Optional[str] = None
    order_confirmed: Optional[bool] = None
    report_number: Optional[str] = None
    test_status: Optional[str] = None
    report_status: Optional[str] = None
    check_status: Optional[str] = None
    issue_status: Optional[str] = None
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
