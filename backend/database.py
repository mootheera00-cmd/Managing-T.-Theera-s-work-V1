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
    conn = sqlite3.connect(DB_PATH, timeout=60.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
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
        work_type TEXT DEFAULT '',
        requester TEXT DEFAULT '',
        customer_name TEXT DEFAULT '',
        bearing_no TEXT DEFAULT '',
        received_date TEXT DEFAULT '',
        due_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        completed_at TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Work Request (waiting state before starting process)
    CREATE TABLE IF NOT EXISTS work_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        requester TEXT DEFAULT '',
        customer_name TEXT DEFAULT '',
        work_type TEXT DEFAULT '',
        bearing_no TEXT DEFAULT '',
        received_date TEXT DEFAULT '',
        due_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Process with 5 steps
    -- Steps 1-3 = 10% of project each (collectively)
    -- Step 4 = 80% (Gantt tasks divided equally)
    -- Step 5 = transitional
    CREATE TABLE IF NOT EXISTS process_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        step1_label TEXT DEFAULT 'Order Receiving',
        step1_data TEXT DEFAULT '',
        step1_complete INTEGER DEFAULT 0,
        step2_label TEXT DEFAULT 'Order Confirmation',
        step2_data TEXT DEFAULT '',
        step2_complete INTEGER DEFAULT 0,
        step3_label TEXT DEFAULT 'Report Number Assignment',
        step3_data TEXT DEFAULT '',
        step3_complete INTEGER DEFAULT 0,
        step4_data TEXT DEFAULT '',
        step4_complete INTEGER DEFAULT 0,
        step5_label TEXT DEFAULT 'Final Review',
        step5_data TEXT DEFAULT '',
        step5_complete INTEGER DEFAULT 0,
        comets_no TEXT DEFAULT '',
        comets_url TEXT DEFAULT '',
        email_from TEXT DEFAULT '',
        email_attachment_info TEXT DEFAULT '',
        order_confirmed INTEGER DEFAULT 0,
        report_number TEXT DEFAULT '',
        folder_path TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Gantt Tasks for Process Step 4 (with planned AND actual dates)
    CREATE TABLE IF NOT EXISTS gantt_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        task_order INTEGER DEFAULT 0,
        name TEXT NOT NULL DEFAULT '',
        category TEXT DEFAULT '',
        planned_start TEXT DEFAULT '',
        planned_end TEXT DEFAULT '',
        actual_start TEXT DEFAULT '',
        actual_end TEXT DEFAULT '',
        progress INTEGER DEFAULT 0,
        color TEXT DEFAULT 'blue',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Outputs (6 required steps + 1 optional = 10% of project)
    CREATE TABLE IF NOT EXISTS outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        step1_complete INTEGER DEFAULT 0,
        step2_complete INTEGER DEFAULT 0,
        step3_complete INTEGER DEFAULT 0,
        step4_complete INTEGER DEFAULT 0,
        step5_complete INTEGER DEFAULT 0,
        step6_complete INTEGER DEFAULT 0,
        step7_complete INTEGER DEFAULT 0,
        step7_data TEXT DEFAULT '',
        report_no TEXT DEFAULT '',
        report_approved INTEGER DEFAULT 0,
        work_log_completed INTEGER DEFAULT 0,
        claim_record_completed INTEGER DEFAULT 0,
        eval_record_completed INTEGER DEFAULT 0,
        comets_submitted INTEGER DEFAULT 0,
        comets_no TEXT DEFAULT '',
        submission_date TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- File attachments
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

    -- Report Numbers
    CREATE TABLE IF NOT EXISTS report_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        report_number TEXT NOT NULL,
        item_description TEXT DEFAULT '',
        folder_path TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Time Logs (CSV format matching Daily_Week_*.csv)
    -- Columns: Date, User, Group, Sales, Category, Customer, APTX, Code, Hours, Comment, Mode
    CREATE TABLE IF NOT EXISTS time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        task_id INTEGER DEFAULT 0,
        task_name TEXT DEFAULT '',
        entry_date TEXT NOT NULL,
        user_name TEXT DEFAULT '',
        group_name TEXT DEFAULT 'HUB',
        sales TEXT DEFAULT '',
        category TEXT DEFAULT '',
        customer TEXT DEFAULT '',
        aptx TEXT DEFAULT '',
        code TEXT DEFAULT '',
        hours REAL DEFAULT 0,
        comment TEXT DEFAULT '',
        mode TEXT DEFAULT 'log',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Evaluation process entries
    CREATE TABLE IF NOT EXISTS eval_process_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        entry_date TEXT NOT NULL,
        tasks_today TEXT DEFAULT '',
        tasks_tomorrow TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Gantt initializations tracking
    CREATE TABLE IF NOT EXISTS gantt_initializations (
        project_id INTEGER NOT NULL,
        step TEXT NOT NULL,
        report_number TEXT NOT NULL,
        PRIMARY KEY (project_id, step, report_number),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

    # Add new columns to existing databases (safe migration)
    conn = get_db()
    cursor = conn.cursor()
    for sql in [
        "ALTER TABLE projects ADD COLUMN work_type TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN requester TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN customer_name TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN bearing_no TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN received_date TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN due_date TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN notes TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN completed_at TEXT DEFAULT ''",
        "ALTER TABLE gantt_tasks ADD COLUMN planned_start TEXT DEFAULT ''",
        "ALTER TABLE gantt_tasks ADD COLUMN planned_end TEXT DEFAULT ''",
        "ALTER TABLE gantt_tasks ADD COLUMN actual_start TEXT DEFAULT ''",
        "ALTER TABLE gantt_tasks ADD COLUMN actual_end TEXT DEFAULT ''",
        "ALTER TABLE gantt_tasks ADD COLUMN task_order INTEGER DEFAULT 0",
        "ALTER TABLE time_logs ADD COLUMN user_name TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN group_name TEXT DEFAULT 'HUB'",
        "ALTER TABLE time_logs ADD COLUMN sales TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN category TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN customer TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN aptx TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN code TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN comment TEXT DEFAULT ''",
        "ALTER TABLE time_logs ADD COLUMN mode TEXT DEFAULT 'log'",
        "ALTER TABLE time_logs ADD COLUMN task_name TEXT DEFAULT ''",
        "ALTER TABLE outputs ADD COLUMN step1_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step2_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step3_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step4_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step5_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step6_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step7_complete INTEGER DEFAULT 0",
        "ALTER TABLE outputs ADD COLUMN step7_data TEXT DEFAULT ''",
        "ALTER TABLE outputs ADD COLUMN report_no TEXT DEFAULT ''",
        "ALTER TABLE process_steps ADD COLUMN step1_label TEXT DEFAULT 'Order Receiving'",
        "ALTER TABLE process_steps ADD COLUMN step1_data TEXT DEFAULT ''",
        "ALTER TABLE process_steps ADD COLUMN step1_complete INTEGER DEFAULT 0",
        "ALTER TABLE process_steps ADD COLUMN step2_label TEXT DEFAULT 'Order Confirmation'",
        "ALTER TABLE process_steps ADD COLUMN step2_data TEXT DEFAULT ''",
        "ALTER TABLE process_steps ADD COLUMN step2_complete INTEGER DEFAULT 0",
        "ALTER TABLE process_steps ADD COLUMN step3_label TEXT DEFAULT 'Report Number Assignment'",
        "ALTER TABLE process_steps ADD COLUMN step3_data TEXT DEFAULT ''",
        "ALTER TABLE process_steps ADD COLUMN step3_complete INTEGER DEFAULT 0",
        "ALTER TABLE process_steps ADD COLUMN step4_data TEXT DEFAULT ''",
        "ALTER TABLE process_steps ADD COLUMN step4_complete INTEGER DEFAULT 0",
        "ALTER TABLE process_steps ADD COLUMN step5_label TEXT DEFAULT 'Final Review'",
        "ALTER TABLE process_steps ADD COLUMN step5_data TEXT DEFAULT ''",
        "ALTER TABLE process_steps ADD COLUMN step5_complete INTEGER DEFAULT 0",
    ]:
        try:
            cursor.execute(sql)
            conn.commit()
        except Exception:
            pass  # Column already exists

    conn.close()
