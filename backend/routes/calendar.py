from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import Optional
from database import get_db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def dict_from_row(row):
    if row is None:
        return None
    return dict(row)


class CalendarNoteCreate(BaseModel):
    note_date: str
    note_type: str = 'general'
    content: str = ''
    created_by: str = ''


class CalendarNoteUpdate(BaseModel):
    note_type: Optional[str] = None
    content: Optional[str] = None


@router.get("/notes")
def get_notes(month: str, authorization: str = Header('')):
    """Get all notes for a given month (YYYY-MM format)."""
    db = get_db()
    start_date = month + "-01"
    # Calculate end of month
    year, mon = month.split("-")
    next_month = int(mon) + 1
    next_year = int(year)
    if next_month > 12:
        next_month = 1
        next_year += 1
    end_date = f"{next_year}-{next_month:02d}-01"

    rows = db.execute("""
        SELECT * FROM team_calendar_notes
        WHERE note_date >= ? AND note_date < ?
        ORDER BY note_date ASC, created_at ASC
    """, (start_date, end_date)).fetchall()

    db.close()
    return [dict_from_row(r) for r in rows]


@router.get("/notes/{note_date}")
def get_notes_by_date(note_date: str, authorization: str = Header('')):
    """Get all notes for a specific date."""
    db = get_db()
    rows = db.execute("""
        SELECT * FROM team_calendar_notes
        WHERE note_date = ?
        ORDER BY created_at ASC
    """, (note_date,)).fetchall()
    db.close()
    return [dict_from_row(r) for r in rows]


@router.post("/notes")
def create_note(note: CalendarNoteCreate, authorization: str = Header('')):
    """Create a new calendar note."""
    db = get_db()
    created_by = note.created_by
    if authorization:
        try:
            u = get_current_user(authorization)
            created_by = u.get('display_name', '') or u.get('username', '')
        except Exception:
            pass

    cursor = db.execute("""
        INSERT INTO team_calendar_notes (note_date, note_type, content, created_by)
        VALUES (?, ?, ?, ?)
    """, (note.note_date, note.note_type, note.content, created_by))
    db.commit()
    note_id = cursor.lastrowid
    row = db.execute("SELECT * FROM team_calendar_notes WHERE id = ?", (note_id,)).fetchone()
    db.close()
    return dict_from_row(row)


@router.put("/notes/{note_id}")
def update_note(note_id: int, note: CalendarNoteUpdate, authorization: str = Header('')):
    """Update a calendar note."""
    db = get_db()
    updates = []
    params = []
    if note.note_type is not None:
        updates.append("note_type = ?")
        params.append(note.note_type)
    if note.content is not None:
        updates.append("content = ?")
        params.append(note.content)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(note_id)
        db.execute(f"UPDATE team_calendar_notes SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()

    row = db.execute("SELECT * FROM team_calendar_notes WHERE id = ?", (note_id,)).fetchone()
    db.close()
    return dict_from_row(row)


@router.delete("/notes/{note_id}")
def delete_note(note_id: int, authorization: str = Header('')):
    """Delete a calendar note."""
    db = get_db()
    db.execute("DELETE FROM team_calendar_notes WHERE id = ?", (note_id,))
    db.commit()
    db.close()
    return {"ok": True}


# ── Holidays ─────────────────────────────────────────────────────

class HolidayCreate(BaseModel):
    holiday_date: str
    description: str = ''


@router.get("/holidays")
def get_holidays(year: int):
    """Get all holidays for a given year."""
    db = get_db()
    start = f"{year}-01-01"
    end = f"{year + 1}-01-01"
    rows = db.execute("""
        SELECT * FROM team_calendar_holidays
        WHERE holiday_date >= ? AND holiday_date < ?
        ORDER BY holiday_date ASC
    """, (start, end)).fetchall()
    db.close()
    return [dict_from_row(r) for r in rows]


@router.post("/holidays")
def add_holiday(holiday: HolidayCreate):
    """Mark a date as a company holiday."""
    db = get_db()
    try:
        db.execute("""
            INSERT OR IGNORE INTO team_calendar_holidays (holiday_date, description)
            VALUES (?, ?)
        """, (holiday.holiday_date, holiday.description))
        db.commit()
        row = db.execute("SELECT * FROM team_calendar_holidays WHERE holiday_date = ?",
                         (holiday.holiday_date,)).fetchone()
        db.close()
        return dict_from_row(row)
    except Exception as e:
        db.close()
        return {"error": str(e)}


@router.delete("/holidays/{holiday_date}")
def remove_holiday(holiday_date: str):
    """Unmark a date as holiday."""
    db = get_db()
    db.execute("DELETE FROM team_calendar_holidays WHERE holiday_date = ?", (holiday_date,))
    db.commit()
    db.close()
    return {"ok": True}


@router.get("/holidays/{holiday_date}")
def check_holiday(holiday_date: str):
    """Check if a specific date is a holiday."""
    db = get_db()
    row = db.execute("SELECT * FROM team_calendar_holidays WHERE holiday_date = ?",
                     (holiday_date,)).fetchone()
    db.close()
    return dict_from_row(row)


# ── Working Days ────────────────────────────────────────────────

class WorkingDayCreate(BaseModel):
    work_date: str
    description: str = ''


@router.get("/working-days")
def get_working_days(year: int):
    """Get all working day overrides for a given year."""
    db = get_db()
    start = f"{year}-01-01"
    end = f"{year + 1}-01-01"
    rows = db.execute("""
        SELECT * FROM team_calendar_working_days
        WHERE work_date >= ? AND work_date < ?
        ORDER BY work_date ASC
    """, (start, end)).fetchall()
    db.close()
    return [dict_from_row(r) for r in rows]


@router.post("/working-days")
def add_working_day(working_day: WorkingDayCreate):
    """Mark a date as a working day (e.g. a Saturday that is working)."""
    db = get_db()
    try:
        db.execute("""
            INSERT OR IGNORE INTO team_calendar_working_days (work_date, description)
            VALUES (?, ?)
        """, (working_day.work_date, working_day.description))
        db.commit()
        row = db.execute("SELECT * FROM team_calendar_working_days WHERE work_date = ?",
                         (working_day.work_date,)).fetchone()
        db.close()
        return dict_from_row(row)
    except Exception as e:
        db.close()
        return {"error": str(e)}


@router.delete("/working-days/{work_date}")
def remove_working_day(work_date: str):
    """Unmark a date as a working day."""
    db = get_db()
    db.execute("DELETE FROM team_calendar_working_days WHERE work_date = ?", (work_date,))
    db.commit()
    db.close()
    return {"ok": True}


@router.get("/working-days/{work_date}")
def check_working_day(work_date: str):
    """Check if a specific date is marked as a working day."""
    db = get_db()
    row = db.execute("SELECT * FROM team_calendar_working_days WHERE work_date = ?",
                     (work_date,)).fetchone()
    db.close()
    return dict_from_row(row)
