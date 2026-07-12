import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  User, Briefcase, DoorOpen, CalendarDays, MoreHorizontal
} from 'lucide-react';
import {
  getCalendarNotes,
  createCalendarNote,
  deleteCalendarNote,
  getCalendarNotesByDate,
  getCalendarHolidays,
  addCalendarHoliday,
  removeCalendarHoliday,
  checkCalendarHoliday,
  getCalendarWorkingDays,
  addCalendarWorkingDay,
  removeCalendarWorkingDay,
  checkCalendarWorkingDay
} from '../api/client';
import type { CalendarNote, CalendarHoliday, CalendarWorkingDay } from '../types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const NOTE_TYPE_CONFIG: Record<string, { label: string; dot: string; bgLight: string; icon: typeof User; iconBg: string; iconText: string; badge: string }> = {
  leave:   { label: 'Leave',    dot: 'bg-red-500',     bgLight: 'bg-red-50 border-red-200',    icon: User,          iconBg: 'bg-red-100', iconText: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  meeting: { label: 'Meeting',  dot: 'bg-amber-500',   bgLight: 'bg-amber-50 border-amber-200', icon: Briefcase,     iconBg: 'bg-amber-100', iconText: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  outing:  { label: 'Outing',   dot: 'bg-violet-500',  bgLight: 'bg-violet-50 border-violet-200', icon: DoorOpen,    iconBg: 'bg-violet-100', iconText: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  general: { label: 'General',  dot: 'bg-blue-500',    bgLight: 'bg-blue-50 border-blue-200',   icon: CalendarDays, iconBg: 'bg-blue-100', iconText: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  other:   { label: 'Other',    dot: 'bg-gray-400',    bgLight: 'bg-gray-50 border-gray-200',   icon: MoreHorizontal, iconBg: 'bg-gray-200', iconText: 'text-gray-500', badge: 'bg-gray-200 text-gray-600' },
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  return today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [workingDays, setWorkingDays] = useState<CalendarWorkingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayNotes, setSelectedDayNotes] = useState<CalendarNote[]>([]);
  const [selectedIsHoliday, setSelectedIsHoliday] = useState(false);
  const [selectedIsWorkingDay, setSelectedIsWorkingDay] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newNoteType, setNewNoteType] = useState('general');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTime, setNewNoteTime] = useState('');
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const holidaysSet = new Set(holidays.map(h => h.holiday_date));
  const workingDaysSet = new Set(workingDays.map(w => w.work_date));

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const [notesData, holidaysData, workingDaysData] = await Promise.all([
        getCalendarNotes(monthKey),
        getCalendarHolidays(year),
        getCalendarWorkingDays(year)
      ]);
      setNotes(notesData);
      setHolidays(holidaysData);
      setWorkingDays(workingDaysData);
    } catch (e) {
      console.error('Failed to fetch calendar data', e);
    } finally {
      setLoading(false);
    }
  }, [monthKey, year]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const notesByDate = notes.reduce<Record<string, CalendarNote[]>>((acc, note) => {
    if (!acc[note.note_date]) acc[note.note_date] = [];
    acc[note.note_date].push(note);
    return acc;
  }, {});

  const openDay = async (dateStr: string) => {
    setSelectedDate(dateStr);
    try {
      const [dayNotes, holidayCheck, workingDayCheck] = await Promise.all([
        getCalendarNotesByDate(dateStr),
        checkCalendarHoliday(dateStr).catch(() => null),
        checkCalendarWorkingDay(dateStr).catch(() => null)
      ]);
      setSelectedDayNotes(dayNotes);
      setSelectedIsHoliday(!!holidayCheck?.id);
      setSelectedIsWorkingDay(!!workingDayCheck?.id);
    } catch {
      setSelectedDayNotes(notesByDate[dateStr] || []);
      setSelectedIsHoliday(false);
      setSelectedIsWorkingDay(false);
    }
    setNewNoteType('general');
    setNewNoteContent('');
    setNewNoteTime('');
    setShowModal(true);
  };

  const handleAddNote = async () => {
    if (!selectedDate || !newNoteContent.trim()) return;
    try {
      const finalContent = newNoteType === 'meeting' && newNoteTime.trim()
        ? `[${newNoteTime.trim()}] ${newNoteContent.trim()}`
        : newNoteContent.trim();
      await createCalendarNote({
        note_date: selectedDate,
        note_type: newNoteType,
        content: finalContent,
      });
      setNewNoteContent('');
      setNewNoteTime('');
      await fetchNotes();
      setShowModal(false);
    } catch (e) {
      console.error('Failed to create note', e);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!selectedDate) return;
    try {
      await deleteCalendarNote(noteId);
      const dayNotes = await getCalendarNotesByDate(selectedDate);
      setSelectedDayNotes(dayNotes);
      await fetchNotes();
    } catch (e) {
      console.error('Failed to delete note', e);
    }
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Team Calendar</h1>
      </div>

      {/* Calendar Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-white rounded-xl text-gray-500 hover:text-gray-800 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-800 tracking-wide">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-white rounded-xl text-gray-500 hover:text-gray-800 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7">
          {dayNames.map((name, col) => (
            <div
              key={name}
              className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider border-b border-gray-100 ${
                col === 0 || col === 6 ? 'text-red-400 bg-red-50/50' : 'text-gray-500'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => {
            const col = i;
            return (
              <div
                key={`empty-${i}`}
                className={`min-h-[100px] sm:min-h-[120px] border-b border-r border-gray-100 ${
                  col === 0 || col === 6 ? 'bg-red-50' : 'bg-gray-50/30'
                }`}
              />
            );
          })}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(year, month, day);
            const dayNotes = notesByDate[dateStr] || [];
            const isTodayCell = isToday(year, month, day);
            const col = (firstDay + i) % 7;
            const isWeekend = col === 0 || col === 6;
            const isHoliday = holidaysSet.has(dateStr);
            const isWorkingDay = workingDaysSet.has(dateStr);

            let bgClass = 'bg-white';
            if (isTodayCell) bgClass = 'bg-gray-100 ring-1 ring-inset ring-gray-400';
            else if (isHoliday || (isWeekend && !isWorkingDay)) bgClass = 'bg-red-50';

            return (
              <button
                key={day}
                onClick={() => openDay(dateStr)}
                className={`min-h-[100px] sm:min-h-[120px] border-b border-r border-gray-100 p-1.5 text-left transition-all
                  hover:bg-gray-100/50 hover:shadow-inner relative group ${bgClass}
                `}
              >
                {/* Day number */}
                <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium mb-1
                  ${isTodayCell ? 'bg-gray-800 text-white' : (isWeekend && !isWorkingDay) || isHoliday ? 'text-red-500' : 'text-gray-700'}
                `}>
                  {day}
                </div>

                {/* Holiday / Working Day badge */}
                {!isTodayCell && (
                  isHoliday || (isWeekend && !isWorkingDay) ? (
                    <div className="absolute top-1 right-1 text-[8px] font-semibold text-red-400 bg-red-100 rounded px-1 py-0.5 leading-none">
                      Holiday
                    </div>
                  ) : isWorkingDay ? (
                    <div className="absolute top-1 right-1 text-[8px] font-semibold text-blue-400 bg-blue-100 rounded px-1 py-0.5 leading-none">
                      Working
                    </div>
                  ) : null
                )}

                {/* Note lines */}
                {dayNotes.length > 0 && (
                  <div className="space-y-0.5 mt-0.5">
                    {dayNotes.slice(0, 4).map((note) => {
                      const cfg = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.general;
                      const maxLen = 22;
                      const text = note.content.length > maxLen
                        ? note.content.substring(0, maxLen) + '…'
                        : note.content;
                      return (
                        <div
                          key={note.id}
                          className="text-[10px] leading-tight text-gray-600 truncate"
                          title={`${cfg.label}: ${note.content}`}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1 align-middle`} />
                          <span className="align-middle">{text}</span>
                        </div>
                      );
                    })}
                    {dayNotes.length > 4 && (
                      <div className="text-[10px] text-gray-400 font-medium pl-2.5">
                        +{dayNotes.length - 4} more
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-2">
        <span className="text-xs font-medium text-gray-500">Type:</span>
        {Object.entries(NOTE_TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-gray-600">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Day Detail Modal ──────────────────────────────────── */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </h3>
                  <p className="text-[10px] text-gray-400">{selectedDate}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selectedDayNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notes for this day</p>
                  <p className="text-xs">Add the first note below</p>
                </div>
              ) : (
                selectedDayNotes.map((note) => {
                  const cfg = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.general;
                  const Icon = cfg.icon;
                  return (
                    <div key={note.id} className={`rounded-xl border p-3 ${cfg.bgLight} relative group`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.iconText}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge} inline-block`}>
                              {cfg.label}
                            </span>
                            {note.created_by && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <User className="w-3 h-3" /> {note.created_by}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Holiday Toggle */}
            <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${selectedIsHoliday ? 'bg-red-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-600">Company Holiday</span>
              </div>
              <button
                onClick={async () => {
                  if (!selectedDate) return;
                  try {
                    if (selectedIsHoliday) {
                      await removeCalendarHoliday(selectedDate);
                      setSelectedIsHoliday(false);
                    } else {
                      await addCalendarHoliday(selectedDate);
                      setSelectedIsHoliday(true);
                      if (selectedIsWorkingDay) {
                        await removeCalendarWorkingDay(selectedDate);
                        setSelectedIsWorkingDay(false);
                      }
                    }
                    await fetchNotes();
                  } catch (e) {
                    console.error('Failed to toggle holiday', e);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  selectedIsHoliday ? 'bg-red-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    selectedIsHoliday ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Working Day Toggle (for weekends) */}
            <div className="border-t-0 px-6 py-3 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${selectedIsWorkingDay ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium text-gray-600">Working Day (override weekend)</span>
              </div>
              <button
                onClick={async () => {
                  if (!selectedDate) return;
                  try {
                    if (selectedIsWorkingDay) {
                      await removeCalendarWorkingDay(selectedDate);
                      setSelectedIsWorkingDay(false);
                    } else {
                      await addCalendarWorkingDay(selectedDate);
                      setSelectedIsWorkingDay(true);
                      if (selectedIsHoliday) {
                        await removeCalendarHoliday(selectedDate);
                        setSelectedIsHoliday(false);
                      }
                    }
                    await fetchNotes();
                  } catch (e) {
                    console.error('Failed to toggle working day', e);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  selectedIsWorkingDay ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    selectedIsWorkingDay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Add Note Form */}
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {Object.entries(NOTE_TYPE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => { setNewNoteType(key); if (key !== 'meeting') setNewNoteTime(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        newNoteType === key
                          ? `${cfg.iconBg} ${cfg.iconText} ring-2 ring-offset-1 ${cfg.dot.replace('bg-', 'ring-')}`
                          : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {newNoteType === 'meeting' && (
                    <input
                      type="text"
                      placeholder="10:00-11:30"
                      value={newNoteTime}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                        let formatted = '';
                        if (raw.length <= 2) {
                          formatted = raw;
                        } else if (raw.length <= 4) {
                          formatted = raw.slice(0, 2) + ':' + raw.slice(2);
                        } else if (raw.length <= 6) {
                          formatted = raw.slice(0, 2) + ':' + raw.slice(2, 4) + '-' + raw.slice(4);
                        } else {
                          formatted = raw.slice(0, 2) + ':' + raw.slice(2, 4) + '-' + raw.slice(4, 6) + ':' + raw.slice(6, 8);
                        }
                        setNewNoteTime(formatted);
                      }}
                      className="w-28 px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-center font-mono"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Type your note here..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newNoteContent.trim()) handleAddNote(); }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
