import sqlite3
import os
import sys

# When frozen as a .exe, store the database next to the executable (not in the temp dir).
# When running normally, store it next to this file.
if getattr(sys, "frozen", False):
    _data_dir = os.path.dirname(sys.executable)
else:
    _data_dir = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(_data_dir, "theera_work.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        title TEXT NOT NULL,
        current_stage TEXT NOT NULL DEFAULT 'work_request'
            CHECK(current_stage IN ('work_request','process','outputs','completed')),
        progress_percent INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
            CHECK(status IN ('active','paused','completed')),
        pause_reason TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        requester TEXT DEFAULT '',
        customer_name TEXT DEFAULT '',
        work_type TEXT DEFAULT '',
        bearing_no TEXT DEFAULT '',
        due_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS process_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        comets_no TEXT DEFAULT '',
        email_from TEXT DEFAULT '',
        email_attachment_info TEXT DEFAULT '',
        order_confirmed INTEGER DEFAULT 0,
        report_number TEXT DEFAULT '',
        work_log_url TEXT DEFAULT 'http://aptc150-096.asia.ad.nsk.com/signin.php',
        test_status TEXT DEFAULT 'pending'
            CHECK(test_status IN ('pending','in_progress','completed')),
        report_status TEXT DEFAULT 'pending'
            CHECK(report_status IN ('pending','in_progress','completed')),
        check_status TEXT DEFAULT 'pending'
            CHECK(check_status IN ('pending','in_progress','completed')),
        issue_status TEXT DEFAULT 'pending'
            CHECK(issue_status IN ('pending','in_progress','completed')),
        is_paused INTEGER DEFAULT 0,
        pause_reason TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        report_approved INTEGER DEFAULT 0,
        report_revising INTEGER DEFAULT 0,
        revision_notes TEXT DEFAULT '',
        work_log_completed INTEGER DEFAULT 0,
        claim_record_completed INTEGER DEFAULT 0,
        eval_record_completed INTEGER DEFAULT 0,
        comets_submitted INTEGER DEFAULT 0,
        comets_no TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS file_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        stage TEXT NOT NULL DEFAULT 'work_request',
        step_name TEXT DEFAULT '',
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        mime_type TEXT DEFAULT '',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

    # Add new columns to existing databases
    conn = get_db()
    cursor = conn.cursor()
    for sql in [
        "ALTER TABLE outputs ADD COLUMN submission_date TEXT DEFAULT ''",
        "ALTER TABLE work_requests ADD COLUMN received_date TEXT DEFAULT ''",
    ]:
        try:
            cursor.execute(sql)
            conn.commit()
        except Exception:
            pass  # Column already exists
    conn.close()
