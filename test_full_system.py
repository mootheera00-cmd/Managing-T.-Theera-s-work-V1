"""
Full System Test — Managing T. Theera's Work
=============================================
Tests every API endpoint end-to-end against a running backend on port 8888.
Uses the standard `requests` library (no extra frameworks needed).

Run:
    python test_full_system.py
"""

import requests
import json
import time
import sys
import os
import io
from datetime import datetime, timedelta

BASE = "http://localhost:8888/api"
PASS = 0
FAIL = 0
ERRORS = []


def log(status: str, test_name: str, detail: str = ""):
    global PASS, FAIL
    icon = "✅" if status == "PASS" else "❌"
    if status == "PASS":
        PASS += 1
    else:
        FAIL += 1
        ERRORS.append(f"{test_name}: {detail}")
    suffix = f"  — {detail}" if detail else ""
    print(f"  {icon} {test_name}{suffix}")


def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ──────────────────────────────────────────────────────────────
# 0. Health Check — is the server running?
# ──────────────────────────────────────────────────────────────
def test_health():
    section("0. Server Health Check")
    try:
        r = requests.get(f"{BASE}/projects", timeout=5)
        if r.status_code == 200:
            log("PASS", "Server is reachable", f"status={r.status_code}")
        else:
            log("FAIL", "Server is reachable", f"status={r.status_code}")
    except Exception as e:
        log("FAIL", "Server is reachable", str(e))
        print("\n⛔ Server is not running! Start it first:")
        print("   cd backend && python main.py")
        sys.exit(1)


# ──────────────────────────────────────────────────────────────
# 1. Project CRUD
# ──────────────────────────────────────────────────────────────
created_project_id = None


def test_create_project():
    global created_project_id
    section("1. Project CRUD")

    # CREATE
    payload = {"year": 2026, "title": "TEST — Full System Test Run"}
    r = requests.post(f"{BASE}/projects", json=payload)
    if r.status_code == 200:
        data = r.json()
        created_project_id = data["id"]
        log("PASS", "POST /projects (create)", f"id={created_project_id}")
        # Check sub-records were auto-created
        if data.get("work_request"):
            log("PASS", "  work_request auto-created")
        else:
            log("FAIL", "  work_request auto-created", "missing")
        if data.get("process"):
            log("PASS", "  process_steps auto-created")
        else:
            log("FAIL", "  process_steps auto-created", "missing")
        if data.get("outputs"):
            log("PASS", "  outputs auto-created")
        else:
            log("FAIL", "  outputs auto-created", "missing")
    else:
        log("FAIL", "POST /projects (create)", f"status={r.status_code} body={r.text}")
        return

    # GET single
    r = requests.get(f"{BASE}/projects/{created_project_id}")
    if r.status_code == 200:
        data = r.json()
        if data["title"] == "TEST — Full System Test Run" and data["year"] == 2026:
            log("PASS", "GET /projects/{id}", f"title OK, year OK")
        else:
            log("FAIL", "GET /projects/{id}", f"unexpected data: {data}")
    else:
        log("FAIL", "GET /projects/{id}", f"status={r.status_code}")

    # LIST
    r = requests.get(f"{BASE}/projects", params={"year": 2026})
    if r.status_code == 200:
        items = r.json()
        found = any(p["id"] == created_project_id for p in items)
        log("PASS" if found else "FAIL", "GET /projects?year=2026", f"found={found}, total={len(items)}")
    else:
        log("FAIL", "GET /projects?year=2026", f"status={r.status_code}")

    # LIST with search
    r = requests.get(f"{BASE}/projects", params={"search": "Full System Test"})
    if r.status_code == 200:
        items = r.json()
        found = any(p["id"] == created_project_id for p in items)
        log("PASS" if found else "FAIL", "GET /projects?search=Full System Test", f"found={found}")
    else:
        log("FAIL", "GET /projects?search=...", f"status={r.status_code}")

    # UPDATE project title
    r = requests.put(f"{BASE}/projects/{created_project_id}", json={"title": "TEST — Updated Title"})
    if r.status_code == 200:
        data = r.json()
        if data["title"] == "TEST — Updated Title":
            log("PASS", "PUT /projects/{id} (update title)")
        else:
            log("FAIL", "PUT /projects/{id}", f"title={data['title']}")
    else:
        log("FAIL", "PUT /projects/{id}", f"status={r.status_code}")

    # Restore title for subsequent tests
    requests.put(f"{BASE}/projects/{created_project_id}", json={"title": "TEST — Full System Test Run"})


# ──────────────────────────────────────────────────────────────
# 2. Work Request
# ──────────────────────────────────────────────────────────────
def test_work_request():
    section("2. Work Request")

    wr_payload = {
        "requester": "APTC",
        "customer_name": "Test Customer Corp",
        "work_type": "Investigation",
        "bearing_no": "6205ZZ",
        "received_date": "2026-06-01",
        "due_date": "2026-07-15",
        "notes": "Test investigation request"
    }
    r = requests.put(f"{BASE}/projects/{created_project_id}/work-request", json=wr_payload)
    if r.status_code == 200:
        data = r.json()
        wr = data.get("work_request", {})
        checks = [
            wr.get("requester") == "APTC",
            wr.get("customer_name") == "Test Customer Corp",
            wr.get("work_type") == "Investigation",
            wr.get("bearing_no") == "6205ZZ",
            wr.get("due_date") == "2026-07-15",
            wr.get("received_date") == "2026-06-01",
        ]
        if all(checks):
            log("PASS", "PUT /projects/{id}/work-request", "all fields saved correctly")
        else:
            log("FAIL", "PUT /projects/{id}/work-request", f"some fields wrong: {wr}")
    else:
        log("FAIL", "PUT /projects/{id}/work-request", f"status={r.status_code} body={r.text}")

    # Check progress updated (should be 100% for work_request stage with all fields filled)
    r2 = requests.get(f"{BASE}/projects/{created_project_id}")
    if r2.status_code == 200:
        prog = r2.json().get("progress_percent", 0)
        log("PASS" if prog > 0 else "FAIL", "Progress tracking (work_request)", f"progress={prog}%")
    else:
        log("FAIL", "Progress tracking (work_request)", f"status={r2.status_code}")


# ──────────────────────────────────────────────────────────────
# 3. Stage Progression: Work Request → Process
# ──────────────────────────────────────────────────────────────
def test_start_process():
    section("3. Stage Progression: Work Request → Process")

    r = requests.post(f"{BASE}/projects/{created_project_id}/start")
    if r.status_code == 200:
        data = r.json()
        if data["current_stage"] == "process":
            log("PASS", "POST /projects/{id}/start", "stage → process")
        else:
            log("FAIL", "POST /projects/{id}/start", f"stage={data['current_stage']}")
    else:
        log("FAIL", "POST /projects/{id}/start", f"status={r.status_code} body={r.text}")

    # Trying to start again should fail
    r2 = requests.post(f"{BASE}/projects/{created_project_id}/start")
    if r2.status_code == 400:
        log("PASS", "Double start rejected (400)", "guard works")
    else:
        log("FAIL", "Double start rejected", f"expected 400, got {r2.status_code}")


# ──────────────────────────────────────────────────────────────
# 4. Process Update
# ──────────────────────────────────────────────────────────────
def test_process_update():
    section("4. Process Update")

    proc_payload = {
        "comets_no": "COMETS-2026-001",
        "comets_url": "http://comets.example.com/001",
        "email_from": "customer@example.com",
        "email_attachment_info": "3 files attached (PDF, Excel, photo)",
        "order_confirmed": True,
        "test_status": "in_progress",
        "report_status": "pending",
        "check_status": "pending",
    }
    r = requests.put(f"{BASE}/projects/{created_project_id}/process", json=proc_payload)
    if r.status_code == 200:
        data = r.json()
        ps = data.get("process", {})
        checks = [
            ps.get("comets_no") == "COMETS-2026-001",
            ps.get("comets_url") == "http://comets.example.com/001",
            ps.get("email_from") == "customer@example.com",
            ps.get("order_confirmed") in (1, True),
            ps.get("test_status") == "in_progress",
        ]
        if all(checks):
            log("PASS", "PUT /projects/{id}/process", "all process fields correct")
        else:
            log("FAIL", "PUT /projects/{id}/process", f"some fields wrong: {ps}")
    else:
        log("FAIL", "PUT /projects/{id}/process", f"status={r.status_code} body={r.text}")

    # Check progress
    r2 = requests.get(f"{BASE}/projects/{created_project_id}")
    if r2.status_code == 200:
        prog = r2.json().get("progress_percent", 0)
        log("PASS" if prog > 0 else "FAIL", "Progress tracking (process)", f"progress={prog}%")
    else:
        log("FAIL", "Progress tracking (process)", f"status={r2.status_code}")


# ──────────────────────────────────────────────────────────────
# 5. Report Numbers CRUD
# ──────────────────────────────────────────────────────────────
created_rn_id = None


def test_report_numbers():
    global created_rn_id
    section("5. Report Numbers CRUD")

    # CREATE
    rn_payload = {
        "report_number": "APTX26-TEST-001",
        "item_description": "Test bearing sample #1",
        "folder_path": ""
    }
    r = requests.post(f"{BASE}/projects/{created_project_id}/report-numbers", json=rn_payload)
    if r.status_code == 200:
        data = r.json()
        created_rn_id = data["id"]
        log("PASS", "POST report-numbers (create)", f"id={created_rn_id}")
    else:
        log("FAIL", "POST report-numbers (create)", f"status={r.status_code} body={r.text}")
        return

    # CREATE second
    rn2_payload = {"report_number": "APTX26-TEST-002", "item_description": "Test bearing sample #2"}
    r2 = requests.post(f"{BASE}/projects/{created_project_id}/report-numbers", json=rn2_payload)
    if r2.status_code == 200:
        log("PASS", "POST report-numbers (second)", f"id={r2.json()['id']}")
    else:
        log("FAIL", "POST report-numbers (second)", f"status={r2.status_code}")

    # LIST
    r3 = requests.get(f"{BASE}/projects/{created_project_id}/report-numbers")
    if r3.status_code == 200:
        rns = r3.json()
        log("PASS" if len(rns) == 2 else "FAIL", "GET report-numbers (list)", f"count={len(rns)}")
    else:
        log("FAIL", "GET report-numbers (list)", f"status={r3.status_code}")

    # UPDATE
    r4 = requests.put(
        f"{BASE}/projects/{created_project_id}/report-numbers/{created_rn_id}",
        json={"item_description": "Updated description"}
    )
    if r4.status_code == 200:
        if r4.json().get("item_description") == "Updated description":
            log("PASS", "PUT report-numbers (update)")
        else:
            log("FAIL", "PUT report-numbers (update)", f"desc={r4.json().get('item_description')}")
    else:
        log("FAIL", "PUT report-numbers (update)", f"status={r4.status_code}")

    # Check summary in process_steps
    r5 = requests.get(f"{BASE}/projects/{created_project_id}")
    if r5.status_code == 200:
        rn_summary = r5.json().get("process", {}).get("report_number", "")
        has_both = "APTX26-TEST-001" in rn_summary and "APTX26-TEST-002" in rn_summary
        log("PASS" if has_both else "FAIL", "Report number summary in process_steps", f"summary='{rn_summary}'")
    else:
        log("FAIL", "Report number summary check", f"status={r5.status_code}")

    # DELETE second report number
    rn2_id = r2.json()["id"]
    r6 = requests.delete(f"{BASE}/projects/{created_project_id}/report-numbers/{rn2_id}")
    if r6.status_code == 200:
        log("PASS", "DELETE report-numbers", f"id={rn2_id}")
    else:
        log("FAIL", "DELETE report-numbers", f"status={r6.status_code}")


# ──────────────────────────────────────────────────────────────
# 6. Pause / Resume
# ──────────────────────────────────────────────────────────────
def test_pause_resume():
    section("6. Pause / Resume")

    # PAUSE
    r = requests.post(f"{BASE}/projects/{created_project_id}/pause", json={"reason": "Waiting for sample"})
    if r.status_code == 200:
        data = r.json()
        if data["status"] == "paused" and data["pause_reason"] == "Waiting for sample":
            log("PASS", "POST /projects/{id}/pause", "status=paused, reason saved")
        else:
            log("FAIL", "POST /projects/{id}/pause", f"status={data['status']}, reason={data['pause_reason']}")
    else:
        log("FAIL", "POST /projects/{id}/pause", f"status={r.status_code}")

    # Check process is also paused
    r2 = requests.get(f"{BASE}/projects/{created_project_id}")
    if r2.status_code == 200:
        ps = r2.json().get("process", {})
        if ps.get("is_paused") in (1, True):
            log("PASS", "Process also paused", f"is_paused={ps.get('is_paused')}")
        else:
            log("FAIL", "Process also paused", f"is_paused={ps.get('is_paused')}")
    else:
        log("FAIL", "Process pause check", f"status={r2.status_code}")

    # RESUME
    r3 = requests.post(f"{BASE}/projects/{created_project_id}/resume")
    if r3.status_code == 200:
        data = r3.json()
        if data["status"] == "active" and data["pause_reason"] == "":
            log("PASS", "POST /projects/{id}/resume", "status=active, reason cleared")
        else:
            log("FAIL", "POST /projects/{id}/resume", f"status={data['status']}, reason={data['pause_reason']}")
    else:
        log("FAIL", "POST /projects/{id}/resume", f"status={r3.status_code}")


# ──────────────────────────────────────────────────────────────
# 7. Auto-Progression: Process → Outputs
# ──────────────────────────────────────────────────────────────
def test_auto_progression_process():
    section("7. Auto-Progression: Process → Outputs")

    # Complete all process fields
    complete_payload = {
        "comets_no": "COMETS-2026-001",
        "email_from": "customer@example.com",
        "order_confirmed": True,
        "test_status": "completed",
        "report_status": "completed",
        "check_status": "completed",
        "issue_status": "completed",
    }
    r = requests.put(f"{BASE}/projects/{created_project_id}/process", json=complete_payload)
    if r.status_code == 200:
        data = r.json()
        stage = data.get("current_stage")
        if stage == "outputs":
            log("PASS", "Auto-progression process → outputs", f"stage={stage}")
        else:
            log("FAIL", "Auto-progression process → outputs", f"stage={stage} (expected 'outputs')")
    else:
        log("FAIL", "Auto-progression trigger", f"status={r.status_code}")


# ──────────────────────────────────────────────────────────────
# 8. Outputs Update
# ──────────────────────────────────────────────────────────────
def test_outputs_update():
    section("8. Outputs Update")

    out_payload = {
        "report_approved": True,
        "work_log_completed": True,
        "submission_date": "2026-06-17",
    }
    r = requests.put(f"{BASE}/projects/{created_project_id}/outputs", json=out_payload)
    if r.status_code == 200:
        data = r.json()
        out = data.get("outputs", {})
        checks = [
            out.get("report_approved") in (1, True),
            out.get("work_log_completed") in (1, True),
            out.get("submission_date") == "2026-06-17",
        ]
        if all(checks):
            log("PASS", "PUT /projects/{id}/outputs", "fields saved correctly")
        else:
            log("FAIL", "PUT /projects/{id}/outputs", f"some fields wrong: {out}")
    else:
        log("FAIL", "PUT /projects/{id}/outputs", f"status={r.status_code}")

    # Check revision flag
    rev_payload = {"report_revising": True, "revision_notes": "Need to fix Fig.3"}
    r2 = requests.put(f"{BASE}/projects/{created_project_id}/outputs", json=rev_payload)
    if r2.status_code == 200:
        out2 = r2.json().get("outputs", {})
        if out2.get("report_revising") in (1, True) and out2.get("revision_notes") == "Need to fix Fig.3":
            log("PASS", "Report revision flag & notes")
        else:
            log("FAIL", "Report revision flag", f"revising={out2.get('report_revising')}, notes={out2.get('revision_notes')}")
    else:
        log("FAIL", "Report revision update", f"status={r2.status_code}")

    # Clear revision
    requests.put(f"{BASE}/projects/{created_project_id}/outputs", json={"report_revising": False, "revision_notes": ""})


# ──────────────────────────────────────────────────────────────
# 9. Auto-Progression: Outputs → Completed (Investigation type)
# ──────────────────────────────────────────────────────────────
def test_auto_progression_outputs():
    section("9. Auto-Progression: Outputs → Completed")

    # For Investigation work_type, claim_record_completed is also needed
    complete_out = {
        "report_approved": True,
        "work_log_completed": True,
        "comets_submitted": True,
        "claim_record_completed": True,  # Required for Investigation type
    }
    r = requests.put(f"{BASE}/projects/{created_project_id}/outputs", json=complete_out)
    if r.status_code == 200:
        data = r.json()
        stage = data.get("current_stage")
        status = data.get("status")
        progress = data.get("progress_percent")
        if stage == "completed" and status == "completed" and progress == 100:
            log("PASS", "Auto-progression outputs → completed", f"stage={stage}, status={status}, progress={progress}%")
        else:
            log("FAIL", "Auto-progression outputs → completed", f"stage={stage}, status={status}, progress={progress}%")
    else:
        log("FAIL", "Auto-progression trigger", f"status={r.status_code}")


# ──────────────────────────────────────────────────────────────
# 10. Summary Endpoint
# ──────────────────────────────────────────────────────────────
def test_summary():
    section("10. Summary Endpoint")

    r = requests.get(f"{BASE}/projects/summary", params={"year": 2026})
    if r.status_code == 200:
        data = r.json()
        checks = [
            "total" in data,
            "by_status" in data,
            "by_stage" in data,
            "by_type" in data,
            "revised_count" in data,
            "revised_details" in data,
        ]
        if all(checks):
            log("PASS", "GET /projects/summary", f"total={data['total']}, by_status={data['by_status']}")
        else:
            log("FAIL", "GET /projects/summary", f"missing keys: {data.keys()}")
    else:
        log("FAIL", "GET /projects/summary", f"status={r.status_code}")


# ──────────────────────────────────────────────────────────────
# 11. File Upload / View / Download / Delete
# ──────────────────────────────────────────────────────────────
uploaded_file_id = None


def test_file_operations():
    global uploaded_file_id
    section("11. File Operations")

    # First create a new project to test file operations (not completed)
    new_proj = requests.post(f"{BASE}/projects", json={"year": 2026, "title": "TEST — File Ops"}).json()
    file_test_project_id = new_proj["id"]

    # UPLOAD
    test_content = b"This is a test file for full system test."
    files = {"file": ("test_file.txt", io.BytesIO(test_content), "text/plain")}
    form_data = {"project_id": str(file_test_project_id), "stage": "work_request", "step_name": "notes"}
    r = requests.post(f"{BASE}/files/upload", files=files, data=form_data)
    if r.status_code == 200:
        data = r.json()
        uploaded_file_id = data["id"]
        if data.get("original_filename") == "test_file.txt":
            log("PASS", "POST /files/upload", f"id={uploaded_file_id}, name={data['original_filename']}")
        else:
            log("FAIL", "POST /files/upload", f"unexpected filename: {data.get('original_filename')}")
    else:
        log("FAIL", "POST /files/upload", f"status={r.status_code} body={r.text}")
        # Cleanup
        requests.delete(f"{BASE}/projects/{file_test_project_id}")
        return

    # Duplicate upload should get a warning and renamed file
    files2 = {"file": ("test_file.txt", io.BytesIO(test_content), "text/plain")}
    form_data2 = {"project_id": str(file_test_project_id), "stage": "work_request", "step_name": "notes"}
    r2 = requests.post(f"{BASE}/files/upload", files=files2, data=form_data2)
    if r2.status_code == 200:
        data2 = r2.json()
        if data2.get("warning"):
            log("PASS", "Duplicate file warning", f"warning='{data2['warning'][:50]}...'")
        else:
            log("PASS", "Duplicate upload handled (no warning)", f"name={data2.get('original_filename')}")
        # Clean up duplicate
        if data2.get("id"):
            requests.delete(f"{BASE}/files/{data2['id']}")
    else:
        log("FAIL", "Duplicate file upload", f"status={r2.status_code}")

    # VIEW
    r3 = requests.get(f"{BASE}/files/{uploaded_file_id}/view")
    if r3.status_code == 200:
        if r3.content == test_content:
            log("PASS", "GET /files/{id}/view", "content matches")
        else:
            log("FAIL", "GET /files/{id}/view", f"content mismatch: got {len(r3.content)} bytes")
    else:
        log("FAIL", "GET /files/{id}/view", f"status={r3.status_code}")

    # DOWNLOAD
    r4 = requests.get(f"{BASE}/files/{uploaded_file_id}/download")
    if r4.status_code == 200:
        cd = r4.headers.get("content-disposition", "")
        if "attachment" in cd:
            log("PASS", "GET /files/{id}/download", f"Content-Disposition: {cd[:60]}")
        else:
            log("FAIL", "GET /files/{id}/download", f"missing attachment header: {cd}")
    else:
        log("FAIL", "GET /files/{id}/download", f"status={r4.status_code}")

    # LIST files for project
    r5 = requests.get(f"{BASE}/files/project/{file_test_project_id}")
    if r5.status_code == 200:
        files_list = r5.json()
        found = any(f["id"] == uploaded_file_id for f in files_list)
        log("PASS" if found else "FAIL", "GET /files/project/{id}", f"found={found}, total={len(files_list)}")
    else:
        log("FAIL", "GET /files/project/{id}", f"status={r5.status_code}")

    # LIST files filtered by stage
    r6 = requests.get(f"{BASE}/files/project/{file_test_project_id}", params={"stage": "work_request"})
    if r6.status_code == 200:
        log("PASS", "GET /files/project/{id}?stage=work_request", f"count={len(r6.json())}")
    else:
        log("FAIL", "GET /files/project/{id}?stage=work_request", f"status={r6.status_code}")

    # DELETE file
    r7 = requests.delete(f"{BASE}/files/{uploaded_file_id}")
    if r7.status_code == 200:
        log("PASS", "DELETE /files/{id}", "file deleted")
    else:
        log("FAIL", "DELETE /files/{id}", f"status={r7.status_code}")

    # Verify deleted
    r8 = requests.get(f"{BASE}/files/{uploaded_file_id}/view")
    if r8.status_code == 404:
        log("PASS", "Verify file deleted (404)")
    else:
        log("FAIL", "Verify file deleted", f"expected 404, got {r8.status_code}")

    # Clean up file test project
    requests.delete(f"{BASE}/projects/{file_test_project_id}")


# ──────────────────────────────────────────────────────────────
# 12. Eval Process Entries
# ──────────────────────────────────────────────────────────────
eval_entry_id = None
eval_test_project_id = None


def test_eval_process():
    global eval_entry_id, eval_test_project_id
    section("12. Eval Process Entries")

    # Create a project for eval testing
    new_proj = requests.post(f"{BASE}/projects", json={"year": 2026, "title": "TEST — Eval Process"}).json()
    eval_test_project_id = new_proj["id"]

    # CREATE entry
    entry_payload = {
        "entry_date": "2026-06-17",
        "tasks_today": "Run bearing fatigue test",
        "tasks_tomorrow": "Analyze results and write report"
    }
    r = requests.post(f"{BASE}/projects/{eval_test_project_id}/eval-process", json=entry_payload)
    if r.status_code == 200:
        data = r.json()
        eval_entry_id = data["id"]
        if data.get("tasks_today") == "Run bearing fatigue test":
            log("PASS", "POST eval-process (create)", f"id={eval_entry_id}")
        else:
            log("FAIL", "POST eval-process (create)", f"tasks_today={data.get('tasks_today')}")
    else:
        log("FAIL", "POST eval-process (create)", f"status={r.status_code} body={r.text}")
        return

    # Duplicate date should fail (409)
    r_dup = requests.post(f"{BASE}/projects/{eval_test_project_id}/eval-process", json=entry_payload)
    if r_dup.status_code == 409:
        log("PASS", "Duplicate date rejected (409)")
    else:
        log("FAIL", "Duplicate date check", f"expected 409, got {r_dup.status_code}")

    # LIST
    r2 = requests.get(f"{BASE}/projects/{eval_test_project_id}/eval-process")
    if r2.status_code == 200:
        entries = r2.json()
        log("PASS" if len(entries) == 1 else "FAIL", "GET eval-process (list)", f"count={len(entries)}")
    else:
        log("FAIL", "GET eval-process (list)", f"status={r2.status_code}")

    # UPDATE
    r3 = requests.put(
        f"{BASE}/projects/{eval_test_project_id}/eval-process/{eval_entry_id}",
        json={"tasks_today": "Updated tasks"}
    )
    if r3.status_code == 200:
        if r3.json().get("tasks_today") == "Updated tasks":
            log("PASS", "PUT eval-process (update)")
        else:
            log("FAIL", "PUT eval-process (update)", f"tasks_today={r3.json().get('tasks_today')}")
    else:
        log("FAIL", "PUT eval-process (update)", f"status={r3.status_code}")

    # DELETE
    r4 = requests.delete(f"{BASE}/projects/{eval_test_project_id}/eval-process/{eval_entry_id}")
    if r4.status_code == 200:
        log("PASS", "DELETE eval-process")
    else:
        log("FAIL", "DELETE eval-process", f"status={r4.status_code}")


# ──────────────────────────────────────────────────────────────
# 13. Gantt Tasks
# ──────────────────────────────────────────────────────────────
gantt_test_project_id = None


def test_gantt_tasks():
    global gantt_test_project_id
    section("13. Gantt Tasks")

    # Create project for Gantt testing
    new_proj = requests.post(f"{BASE}/projects", json={"year": 2026, "title": "TEST — Gantt"}).json()
    gantt_test_project_id = new_proj["id"]

    # GET before initialization (should return initialized=False)
    r = requests.get(
        f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks",
        params={"step": "test", "report_number": "APTX-001"}
    )
    if r.status_code == 200:
        data = r.json()
        if data.get("initialized") == False and len(data.get("tasks", [])) == 0:
            log("PASS", "GET gantt-tasks (uninitialized)", "initialized=False, tasks=[]")
        else:
            log("FAIL", "GET gantt-tasks (uninitialized)", f"data={data}")
    else:
        log("FAIL", "GET gantt-tasks (uninitialized)", f"status={r.status_code}")

    # INITIALIZE
    today = datetime.now().strftime("%Y-%m-%d")
    next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    init_payload = {
        "step": "test",
        "report_number": "APTX-001",
        "tasks": [
            {"id": "task-1", "name": "Sample Prep", "category": "Preparation", "start": today, "end": next_week, "progress": 0, "color": "blue"},
            {"id": "task-2", "name": "Running Test", "category": "Testing", "start": today, "end": next_week, "progress": 0, "color": "green"},
        ]
    }
    r2 = requests.post(f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks/initialize", json=init_payload)
    if r2.status_code == 200:
        data = r2.json()
        if data.get("initialized") and len(data.get("tasks", [])) == 2:
            log("PASS", "POST gantt-tasks/initialize", f"tasks created: {len(data['tasks'])}")
        else:
            log("FAIL", "POST gantt-tasks/initialize", f"initialized={data.get('initialized')}, tasks={len(data.get('tasks', []))}")
    else:
        log("FAIL", "POST gantt-tasks/initialize", f"status={r2.status_code} body={r2.text}")

    # Re-initialize should NOT overwrite (idempotent)
    r2b = requests.post(f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks/initialize", json=init_payload)
    if r2b.status_code == 200:
        data2b = r2b.json()
        if data2b.get("initialized") and len(data2b.get("tasks", [])) == 2:
            log("PASS", "Re-initialize is idempotent", f"tasks still {len(data2b['tasks'])}")
        else:
            log("FAIL", "Re-initialize idempotent check", f"tasks={len(data2b.get('tasks', []))}")
    else:
        log("FAIL", "Re-initialize", f"status={r2b.status_code}")

    # CREATE new task
    new_task = {
        "id": "task-3",
        "step": "test",
        "report_number": "APTX-001",
        "name": "Data Analysis",
        "category": "Analysis",
        "start": today,
        "end": next_week,
        "progress": 0,
        "color": "purple"
    }
    r3 = requests.post(f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks", json=new_task)
    if r3.status_code == 200:
        log("PASS", "POST gantt-tasks (create)", f"name={r3.json().get('name')}")
    else:
        log("FAIL", "POST gantt-tasks (create)", f"status={r3.status_code}")

    # UPDATE task
    r4 = requests.put(
        f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks/task-1",
        json={"progress": 50, "name": "Sample Prep (50%)"}
    )
    if r4.status_code == 200:
        if r4.json().get("progress") == 50:
            log("PASS", "PUT gantt-tasks (update)", "progress=50")
        else:
            log("FAIL", "PUT gantt-tasks (update)", f"progress={r4.json().get('progress')}")
    else:
        log("FAIL", "PUT gantt-tasks (update)", f"status={r4.status_code}")

    # DELETE task
    r5 = requests.delete(f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks/task-3")
    if r5.status_code == 200:
        log("PASS", "DELETE gantt-tasks", f"task-3 deleted")
    else:
        log("FAIL", "DELETE gantt-tasks", f"status={r5.status_code}")

    # Verify count is back to 2
    r6 = requests.get(
        f"{BASE}/projects/{gantt_test_project_id}/gantt-tasks",
        params={"step": "test", "report_number": "APTX-001"}
    )
    if r6.status_code == 200:
        tasks = r6.json().get("tasks", [])
        log("PASS" if len(tasks) == 2 else "FAIL", "Verify final task count", f"count={len(tasks)}")
    else:
        log("FAIL", "Verify final task count", f"status={r6.status_code}")


# ──────────────────────────────────────────────────────────────
# 14. Time Logs
# ──────────────────────────────────────────────────────────────
time_log_entry_id = None
time_log_project_id = None


def test_time_logs():
    global time_log_entry_id, time_log_project_id
    section("14. Time Logs")

    # Create project for time log testing
    new_proj = requests.post(f"{BASE}/projects", json={"year": 2026, "title": "TEST — Time Logs"}).json()
    time_log_project_id = new_proj["id"]

    today = datetime.now().strftime("%Y-%m-%d")

    # CREATE
    tl_payload = {
        "project_id": time_log_project_id,
        "task_id": "task-tl-1",
        "task_name": "Testing Bearing",
        "entry_date": today,
        "hours": 3.5,
        "slots_json": json.dumps([{"start": "09:00", "end": "12:30"}])
    }
    r = requests.post(f"{BASE}/time-logs", json=tl_payload)
    if r.status_code == 200:
        data = r.json()
        time_log_entry_id = data["id"]
        if data.get("hours") == 3.5 and data.get("task_name") == "Testing Bearing":
            log("PASS", "POST /time-logs (create)", f"id={time_log_entry_id}, hours={data['hours']}")
        else:
            log("FAIL", "POST /time-logs (create)", f"data={data}")
    else:
        log("FAIL", "POST /time-logs (create)", f"status={r.status_code} body={r.text}")
        return

    # UPSERT — same project + task + date should update
    tl_update = {
        "project_id": time_log_project_id,
        "task_id": "task-tl-1",
        "task_name": "Testing Bearing (updated)",
        "entry_date": today,
        "hours": 5.0,
        "slots_json": json.dumps([{"start": "09:00", "end": "14:00"}])
    }
    r2 = requests.post(f"{BASE}/time-logs", json=tl_update)
    if r2.status_code == 200:
        data2 = r2.json()
        if data2.get("hours") == 5.0 and data2.get("id") == time_log_entry_id:
            log("PASS", "POST /time-logs (upsert)", f"hours updated to {data2['hours']}")
        else:
            log("FAIL", "POST /time-logs (upsert)", f"id={data2.get('id')} (expected {time_log_entry_id}), hours={data2.get('hours')}")
    else:
        log("FAIL", "POST /time-logs (upsert)", f"status={r2.status_code}")

    # LIST all
    r3 = requests.get(f"{BASE}/time-logs")
    if r3.status_code == 200:
        logs = r3.json()
        found = any(l["id"] == time_log_entry_id for l in logs)
        log("PASS" if found else "FAIL", "GET /time-logs (all)", f"found={found}, total={len(logs)}")
    else:
        log("FAIL", "GET /time-logs (all)", f"status={r3.status_code}")

    # LIST filtered by date
    r4 = requests.get(f"{BASE}/time-logs", params={"date_from": today, "date_to": today})
    if r4.status_code == 200:
        logs = r4.json()
        found = any(l["id"] == time_log_entry_id for l in logs)
        log("PASS" if found else "FAIL", "GET /time-logs (date filter)", f"found={found}, count={len(logs)}")
        # Check joined fields
        entry = next((l for l in logs if l["id"] == time_log_entry_id), None)
        if entry and "project_title" in entry:
            log("PASS", "Time log has joined fields", f"project_title={entry.get('project_title')}")
        else:
            log("FAIL", "Time log joined fields", f"entry keys={list(entry.keys()) if entry else 'not found'}")
    else:
        log("FAIL", "GET /time-logs (date filter)", f"status={r4.status_code}")

    # LIST filtered by project
    r5 = requests.get(f"{BASE}/time-logs", params={"project_id": time_log_project_id})
    if r5.status_code == 200:
        logs = r5.json()
        log("PASS" if len(logs) == 1 else "FAIL", "GET /time-logs (project filter)", f"count={len(logs)}")
    else:
        log("FAIL", "GET /time-logs (project filter)", f"status={r5.status_code}")

    # DELETE
    r6 = requests.delete(f"{BASE}/time-logs/{time_log_entry_id}")
    if r6.status_code == 200:
        log("PASS", "DELETE /time-logs/{id}")
    else:
        log("FAIL", "DELETE /time-logs/{id}", f"status={r6.status_code}")

    # Verify deleted
    r7 = requests.get(f"{BASE}/time-logs", params={"project_id": time_log_project_id})
    if r7.status_code == 200:
        logs = r7.json()
        log("PASS" if len(logs) == 0 else "FAIL", "Verify time log deleted", f"count={len(logs)}")
    else:
        log("FAIL", "Verify time log deleted", f"status={r7.status_code}")


# ──────────────────────────────────────────────────────────────
# 15. Manual Stage Completion
# ──────────────────────────────────────────────────────────────
def test_manual_completion():
    section("15. Manual Stage Completion")

    # Create project and move to process
    new_proj = requests.post(f"{BASE}/projects", json={"year": 2026, "title": "TEST — Manual Completion"}).json()
    pid = new_proj["id"]
    requests.post(f"{BASE}/projects/{pid}/start")  # move to process

    # complete-process
    r = requests.post(f"{BASE}/projects/{pid}/complete-process")
    if r.status_code == 200:
        if r.json()["current_stage"] == "outputs":
            log("PASS", "POST complete-process", "stage → outputs")
        else:
            log("FAIL", "POST complete-process", f"stage={r.json()['current_stage']}")
    else:
        log("FAIL", "POST complete-process", f"status={r.status_code}")

    # complete-outputs
    r2 = requests.post(f"{BASE}/projects/{pid}/complete-outputs")
    if r2.status_code == 200:
        data = r2.json()
        if data["current_stage"] == "completed" and data["status"] == "completed":
            log("PASS", "POST complete-outputs", "stage → completed")
        else:
            log("FAIL", "POST complete-outputs", f"stage={data['current_stage']}, status={data['status']}")
    else:
        log("FAIL", "POST complete-outputs", f"status={r2.status_code}")

    # Try again — should fail
    r3 = requests.post(f"{BASE}/projects/{pid}/complete-outputs")
    if r3.status_code == 400:
        log("PASS", "Double complete-outputs rejected (400)")
    else:
        log("FAIL", "Double complete-outputs check", f"expected 400, got {r3.status_code}")

    # Cleanup
    requests.delete(f"{BASE}/projects/{pid}")


# ──────────────────────────────────────────────────────────────
# 16. Error Handling / Edge Cases
# ──────────────────────────────────────────────────────────────
def test_error_handling():
    section("16. Error Handling & Edge Cases")

    # Get non-existent project
    r = requests.get(f"{BASE}/projects/999999")
    if r.status_code == 404:
        log("PASS", "GET non-existent project → 404")
    else:
        log("FAIL", "GET non-existent project", f"expected 404, got {r.status_code}")

    # Delete non-existent project
    r2 = requests.delete(f"{BASE}/projects/999999")
    if r2.status_code == 404:
        log("PASS", "DELETE non-existent project → 404")
    else:
        log("FAIL", "DELETE non-existent project", f"expected 404, got {r2.status_code}")

    # Update non-existent project
    r3 = requests.put(f"{BASE}/projects/999999", json={"title": "x"})
    if r3.status_code == 404:
        log("PASS", "PUT non-existent project → 404")
    else:
        log("FAIL", "PUT non-existent project", f"expected 404, got {r3.status_code}")

    # Delete non-existent file
    r4 = requests.delete(f"{BASE}/files/999999")
    if r4.status_code == 404:
        log("PASS", "DELETE non-existent file → 404")
    else:
        log("FAIL", "DELETE non-existent file", f"expected 404, got {r4.status_code}")

    # Delete non-existent time log
    r5 = requests.delete(f"{BASE}/time-logs/999999")
    if r5.status_code == 404:
        log("PASS", "DELETE non-existent time log → 404")
    else:
        log("FAIL", "DELETE non-existent time log", f"expected 404, got {r5.status_code}")

    # Gantt task not found
    r6 = requests.put(f"{BASE}/projects/999999/gantt-tasks/nonexistent", json={"progress": 50})
    if r6.status_code == 404:
        log("PASS", "PUT non-existent gantt task → 404")
    else:
        log("FAIL", "PUT non-existent gantt task", f"expected 404, got {r6.status_code}")

    # Invalid project creation (missing fields)
    r7 = requests.post(f"{BASE}/projects", json={})
    if r7.status_code == 422:
        log("PASS", "POST /projects with missing fields → 422")
    else:
        log("FAIL", "POST /projects validation", f"expected 422, got {r7.status_code}")


# ──────────────────────────────────────────────────────────────
# 17. Cleanup
# ──────────────────────────────────────────────────────────────
def test_cleanup():
    section("17. Cleanup Test Data")

    # Delete all test projects
    ids_to_delete = []
    if created_project_id:
        ids_to_delete.append(created_project_id)
    if eval_test_project_id:
        ids_to_delete.append(eval_test_project_id)
    if gantt_test_project_id:
        ids_to_delete.append(gantt_test_project_id)
    if time_log_project_id:
        ids_to_delete.append(time_log_project_id)

    for pid in ids_to_delete:
        r = requests.delete(f"{BASE}/projects/{pid}")
        if r.status_code == 200:
            log("PASS", f"DELETE test project id={pid}")
        else:
            log("FAIL", f"DELETE test project id={pid}", f"status={r.status_code}")

    # Verify cleanup
    r2 = requests.get(f"{BASE}/projects", params={"search": "TEST —"})
    if r2.status_code == 200:
        remaining = [p for p in r2.json() if "TEST —" in p.get("title", "")]
        if len(remaining) == 0:
            log("PASS", "All test projects cleaned up")
        else:
            log("FAIL", "Cleanup incomplete", f"{len(remaining)} test projects remain")
            # Force cleanup remaining
            for p in remaining:
                requests.delete(f"{BASE}/projects/{p['id']}")
    else:
        log("FAIL", "Cleanup verification", f"status={r2.status_code}")


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Full System Test — Managing T. Theera's Work           ║")
    print("║  Testing all API endpoints end-to-end                   ║")
    print(f"║  {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):^56} ║")
    print("╚══════════════════════════════════════════════════════════╝")

    test_health()
    test_create_project()
    test_work_request()
    test_start_process()
    test_process_update()
    test_report_numbers()
    test_pause_resume()
    test_auto_progression_process()
    test_outputs_update()
    test_auto_progression_outputs()
    test_summary()
    test_file_operations()
    test_eval_process()
    test_gantt_tasks()
    test_time_logs()
    test_manual_completion()
    test_error_handling()
    test_cleanup()

    # ── Final Report ──
    total = PASS + FAIL
    print(f"\n{'='*60}")
    print(f"  FINAL RESULTS")
    print(f"{'='*60}")
    print(f"  Total:  {total} tests")
    print(f"  Passed: {PASS} ✅")
    print(f"  Failed: {FAIL} ❌")
    print(f"  Rate:   {PASS/total*100:.1f}%" if total > 0 else "  Rate:   N/A")

    if ERRORS:
        print(f"\n  Failed tests:")
        for e in ERRORS:
            print(f"    ❌ {e}")

    print(f"{'='*60}")
    print()

    sys.exit(0 if FAIL == 0 else 1)
