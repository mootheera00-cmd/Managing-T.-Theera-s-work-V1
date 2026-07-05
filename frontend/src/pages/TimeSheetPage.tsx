import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Download, Plus, X, Trash2, Pencil, Calendar, AlertCircle, CheckCircle2
} from 'lucide-react';
import {
  getTimeLogs, createTimeLog, updateTimeLog, deleteTimeLog,
  getActiveProjectsForTimesheet, checkDailyHours
} from '../api/client';
import type { Project, TimeLogEntry, GanttTask } from '../types';

/* ── Date helpers ── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/* ── CSV Row interface matches time_logs table ── */
interface CsvRow {
  id: string;
  date: string;
  user: string;
  group: string;
  sales: string;
  category: string;
  customer: string;
  aptx: string;
  code: string;
  hours: number;
  comment: string;
  mode: string;
  logId?: number;
  project_id?: number;
  task_id?: number;
}

/* ── Work type colors (match ProjectCard) ── */
const workTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  'Evaluation': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Investigation': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Investigation for Benchmark': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'Investigation for Warranty': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Maintenance': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Improvement': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Others': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

export default function TimeSheetPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showHourPopup, setShowHourPopup] = useState(false);
  const [showOtConfirm, setShowOtConfirm] = useState(false);
  const [otConfirmData, setOtConfirmData] = useState<{ currentTotal: number; newHours: number; otHours: number } | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [hourInput, setHourInput] = useState(1);
  const [commentInput, setCommentInput] = useState('');
  const [userNameInput, setUserNameInput] = useState(() => localStorage.getItem('app_user_name') || 'T.Theera');
  const [codeInput, setCodeInput] = useState('');
  const [modeInput, setModeInput] = useState('log');
  const [editingLog, setEditingLog] = useState<TimeLogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateHours, setDateHours] = useState<Record<string, { total: number; is_full: boolean; can_ot: boolean }>>({});
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const fetchProjects = useCallback(async () => {
    try {
      const projects = await getActiveProjectsForTimesheet();
      setActiveProjects(projects);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchLogs = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const logs = await getTimeLogs({ date });
      setTimeLogs(logs);
      
      // Check hours for this date
      const hoursInfo = await checkDailyHours(date);
      setDateHours(prev => ({
        ...prev,
        [date]: { total: hoursInfo.total_hours, is_full: hoursInfo.is_full, can_ot: hoursInfo.can_add_overtime }
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch hours for all days of the week
  // Save user name to localStorage whenever it changes
  useEffect(() => {
    if (userNameInput) localStorage.setItem('app_user_name', userNameInput);
  }, [userNameInput]);

  const fetchWeekHours = useCallback(async (start: Date) => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(formatDate(addDays(start, i)));
    }
    const results: Record<string, { total: number; is_full: boolean; can_ot: boolean }> = {};
    for (const d of days) {
      try {
        const info = await checkDailyHours(d);
        results[d] = { total: info.total_hours, is_full: info.is_full, can_ot: info.can_add_overtime };
      } catch { /* ignore */ }
    }
    setDateHours(prev => ({ ...prev, ...results }));
  }, []);

  useEffect(() => {
    fetchWeekHours(weekStart);
  }, [weekStart, fetchWeekHours]);

  useEffect(() => {
    fetchLogs(selectedDate);
  }, [selectedDate, fetchLogs]);

  // Group active projects by work type
  const groupedProjects = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    activeProjects.forEach(p => {
      const wt = p.work_type || 'Uncategorized';
      if (!groups[wt]) groups[wt] = [];
      groups[wt].push(p);
    });
    return groups;
  }, [activeProjects]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  const navigateWeek = (direction: number) => {
    const newStart = addDays(weekStart, direction * 7);
    setWeekStart(newStart);
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTask(null);
    setSelectedProject(null);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setSelectedTask(null);
  };

  const handleSelectTask = (task: GanttTask) => {
    setSelectedTask(task);
    setShowHourPopup(true);
    setHourInput(1);
    setCommentInput('');
    setUserNameInput(localStorage.getItem('app_user_name') || 'T.Theera');
    setCodeInput('');
    setModeInput('log');
    setEditingLog(null);
  };

  const handleAddHour = async () => {
    if (!selectedProject) return;
    if (hourInput <= 0) return;

    try {
      // Check hours first
      const hoursInfo = await checkDailyHours(selectedDate);
      const newTotal = hoursInfo.total_hours + hourInput;
      
      if (newTotal > 8 && newTotal <= 13) {
        const ot = newTotal - 8;
        setOtConfirmData({ currentTotal: hoursInfo.total_hours, newHours: hourInput, otHours: ot });
        setShowOtConfirm(true);
        return;
      } else if (newTotal > 13) {
        alert(`Cannot exceed 13 hours per day (8 normal + 5 OT). Current: ${hoursInfo.total_hours}h`);
        return;
      }

      await submitTimeLog();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to add hours');
    }
  };

  const submitTimeLog = async () => {
    if (!selectedProject) return;
    try {
      await createTimeLog({
        project_id: selectedProject.id,
        task_id: selectedTask?.id || 0,
        task_name: selectedTask?.name || selectedProject.title,
        entry_date: selectedDate,
        hours: hourInput,
        comment: commentInput,
        user_name: userNameInput || 'S.Nattiwat',
        group_name: 'HUB',
        sales: selectedProject.work_type || '',
        category: selectedProject.work_type || '',
        customer: selectedProject.customer_name || '',
        aptx: selectedProject.bearing_no || '',
        code: codeInput || undefined,
        mode: modeInput || 'log',
      });
      
      setShowHourPopup(false);
      await fetchLogs(selectedDate);
      setSelectedTask(null);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to add hours');
    }
  };

  const handleEditLog = (log: TimeLogEntry) => {
    setEditingLog(log);
    setHourInput(log.hours);
    setCommentInput(log.comment || '');
    setUserNameInput(log.user_name || 'S.Nattiwat');
    setCodeInput(log.code || '');
    setModeInput(log.mode || 'log');
    setShowHourPopup(true);
  };

  const handleUpdateLog = async () => {
    if (!editingLog) return;
    try {
      await updateTimeLog(editingLog.id, {
        hours: hourInput,
        comment: commentInput,
        user_name: userNameInput,
        code: codeInput,
        mode: modeInput,
        task_id: editingLog.task_id,
        task_name: editingLog.task_name
      });
      setShowHourPopup(false);
      setEditingLog(null);
      await fetchLogs(selectedDate);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to update');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteTimeLog(logId);
      await fetchLogs(selectedDate);
    } catch (e) {
      console.error(e);
    }
  };

  const exportToCsv = () => {
    if (timeLogs.length === 0) return;
    
    // Properly escape CSV fields
    const esc = (val: string | number | null | undefined) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    
    const headers = ['Date', 'User', 'Group', 'Sales', 'Category', 'Customer', 'APTX', 'Code', 'Hours', 'Comment', 'Mode'];
    const rows = timeLogs.map(log => [
      log.entry_date,
      log.user_name,
      log.group_name,
      log.sales,
      log.category,
      log.customer,
      log.aptx,
      log.code,
      log.hours.toString(),
      log.comment,
      log.mode
    ].map(esc));
    
    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const userName = userNameInput.replace(/\s+/g, '_');
    a.download = `Daily_Week_${formatDate(weekStart)}_to_${formatDate(addDays(weekStart, 6))}_${userName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hoursInfo = dateHours[selectedDate] || { total: 0, is_full: false, can_ot: true };

  return (
    <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">Time Sheet</h1>
          <button onClick={exportToCsv} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={timeLogs.length === 0}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-3">
        {/* Left Sidebar - Projects */}
        <div className="lg:col-span-1 space-y-2 lg:space-y-3">
          {/* Date Selector */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateWeek(-1)} className="p-1 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold">
                {MONTH_NAMES[weekStart.getMonth()]} {weekStart.getFullYear()}
              </span>
              <button onClick={() => navigateWeek(1)} className="p-1 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>
              ))}
              {weekDays.map((day, i) => {
                const dateStr = formatDate(day);
                const isToday = dateStr === formatDate(new Date());
                const isSelected = dateStr === selectedDate;
                const dayInfo = dateHours[dateStr];
                const dayTotal = dayInfo?.total || 0;
                let dayBorder = '';
                if (dayTotal > 0) {
                  if (dayTotal >= 8) dayBorder = 'ring-2 ring-green-400';
                  if (dayTotal > 8) dayBorder = 'ring-2 ring-orange-400';
                }
                return (
                  <button
                    key={i}
                    onClick={() => selectDate(dateStr)}
                    className={`text-center text-xs py-1.5 rounded-lg transition-all ${dayBorder} ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : isToday
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                const today = new Date();
                setWeekStart(getMonday(today));
                setSelectedDate(formatDate(today));
              }}
              className="w-full mt-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg py-1.5 transition-colors"
            >
              📅 Today
            </button>
          </div>

          {/* Day Summary */}
          <div className={`bg-white rounded-xl border shadow-sm p-4 ${
            hoursInfo.total === 0 ? 'border-gray-100' :
            hoursInfo.total >= 8 ? 'border-green-200' : 'border-yellow-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {selectedDate}
              </span>
              {hoursInfo.total >= 8 ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : hoursInfo.total > 0 ? (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              ) : null}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900">{hoursInfo.total.toFixed(1)}</span>
              <span className="text-sm text-gray-500 mb-1">/ 8 hrs</span>
            </div>
            {hoursInfo.total > 0 && hoursInfo.total < 8 && (
              <p className="text-xs text-yellow-600 mt-1">⚠ Not yet full ({8 - hoursInfo.total}h remaining)</p>
            )}
            {hoursInfo.total >= 8 && hoursInfo.total < 13 && (
              <p className="text-xs text-green-600 mt-1">✓ Full day + OT {(hoursInfo.total - 8).toFixed(1)}h</p>
            )}
            {hoursInfo.total >= 13 && (
              <p className="text-xs text-red-600 mt-1">★ Max reached (13h)</p>
            )}
          </div>

          {/* Projects by Work Type */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 max-h-[600px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Projects</h3>
            {Object.entries(groupedProjects).map(([type, projects]) => (
              <div key={type} className="mb-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-1.5 px-2 ${
                  type === 'Evaluation' ? 'text-orange-600' :
                  type === 'Investigation' ? 'text-blue-600' :
                  type === 'Investigation for Benchmark' ? 'text-cyan-600' :
                  type === 'Investigation for Warranty' ? 'text-red-600' :
                  type === 'Maintenance' ? 'text-green-600' :
                  type === 'Improvement' ? 'text-purple-600' :
                  'text-gray-500'
                }`}>{type}</h4>
                {projects.map(p => {
                  const pc = workTypeColors[p.work_type || ''] || workTypeColors['Others'];
                  const isSelected = selectedProject?.id === p.id;
                  return (
                  <div key={p.id}>
                    <button
                      onClick={() => handleSelectProject(p)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 flex items-center gap-2 ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                          : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        p.work_type === 'Evaluation' ? 'bg-orange-500' :
                        p.work_type === 'Investigation' ? 'bg-blue-500' :
                        p.work_type === 'Investigation for Benchmark' ? 'bg-cyan-500' :
                        p.work_type === 'Investigation for Warranty' ? 'bg-red-500' :
                        p.work_type === 'Maintenance' ? 'bg-green-500' :
                        p.work_type === 'Improvement' ? 'bg-purple-500' :
                        'bg-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="truncate block font-medium">{p.title}</span>
                        {p.customer_name && (
                          <span className={`text-[11px] ${pc.text} truncate block`}>{p.customer_name}</span>
                        )}
                      </div>
                    </button>
                    {/* Tasks shown inline when project is selected */}
                    {isSelected && p.gantt_tasks && p.gantt_tasks.length > 0 && (
                      <div className="ml-5 pl-2 border-l-2 border-blue-200 space-y-0.5 mb-1">
                        {p.gantt_tasks.map(task => (
                          <button
                            key={task.id}
                            onClick={() => handleSelectTask(task)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                              selectedTask?.id === task.id
                                ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                                : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{task.name}</span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{task.progress}%</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ))}
            {Object.keys(groupedProjects).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No active projects</p>
            )}
          </div>
        </div>

        {/* Right - Time Sheet Table */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header with date info */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-bold text-gray-900">Daily Timesheet</h2>
                <span className="text-sm text-gray-500">{selectedDate}</span>
                <span className="text-xs text-gray-400">({timeLogs.length} entries)</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-gray-700">Total: {hoursInfo.total.toFixed(1)}h</span>
                {hoursInfo.total >= 8 ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">Full Day</span>
                ) : hoursInfo.total > 0 ? (
                  <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-200">{8 - hoursInfo.total}h left</span>
                ) : null}
                {hoursInfo.total > 8 && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">+OT {(hoursInfo.total - 8).toFixed(1)}h</span>
                )}
              </div>
            </div>

            {/* CSV-style table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">User</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Group</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Sales</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Category</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Customer</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">APTX</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Code</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Hours</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Comment</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Mode</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {timeLogs.length === 0 ? (
                    <tr>
                      <td colSpan={12}>
                        <div className="text-center py-16 text-gray-400">
                          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No entries for this date</p>
                          <p className="text-xs mt-1">Select a project and task on the left to add hours</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    timeLogs.map((log, idx) => {
                      const tc = workTypeColors[log.sales || log.category] || workTypeColors['Others'];
                      return (
                      <tr key={log.id} className={`${tc.bg} hover:bg-blue-50/30 transition-colors border-l-4 ${tc.border}`}>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{log.entry_date}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{log.user_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{log.group_name}</td>
                        <td className={`px-4 py-3 text-sm ${tc.text} font-semibold whitespace-nowrap`}>{log.sales}</td>
                        <td className={`px-4 py-3 text-sm ${tc.text} whitespace-nowrap`}>{log.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap max-w-[120px] truncate" title={log.customer}>{log.customer}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{log.aptx}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{log.code}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right whitespace-nowrap">{log.hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={log.comment}>{log.comment}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{log.mode}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEditLog(log)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Hour Entry Popup */}
      {showHourPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-96 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingLog ? 'Edit Hours' : 'Log Hours'}
              </h3>
              <button onClick={() => { setShowHourPopup(false); setEditingLog(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Project</label>
                <p className="text-sm font-semibold text-gray-800">{selectedProject?.title || editingLog?.project_title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Task</label>
                <p className="text-sm text-gray-700">{selectedTask?.name || editingLog?.task_name || 'General'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Date</label>
                <p className="text-sm text-gray-700">{selectedDate}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Hours</label>
                <input
                  type="number"
                  min="0.5"
                  max="13"
                  step="0.5"
                  className="input-base w-full text-lg font-bold"
                  value={hourInput}
                  onFocus={e => e.target.select()}
                  onChange={e => setHourInput(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-400 mt-1">Min 0.5h · Normal ≤8h · Max 13h (8+5 OT)</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Comment (optional)</label>
                <input
                  type="text"
                  className="input-base w-full"
                  placeholder="What did you work on?"
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">User</label>
                  <input
                    type="text"
                    className="input-base w-full"
                    placeholder="User name"
                    value={userNameInput}
                    onChange={e => setUserNameInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Code</label>
                  <input
                    type="text"
                    className="input-base w-full"
                    placeholder="Code (optional)"
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Mode</label>
                <div className="flex gap-2">
                  {['log', 'OT', 'adjust', 'admin'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModeInput(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        modeInput === m
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowHourPopup(false); setEditingLog(null); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={editingLog ? handleUpdateLog : handleAddHour}
                  disabled={hourInput <= 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {editingLog ? 'Update' : 'Add Hours'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OT Confirmation Popup */}
      {showOtConfirm && otConfirmData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Overtime Confirmation</h3>
              <p className="text-sm text-gray-500 mt-1">This will exceed the normal 8h limit</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current hours</span>
                <span className="font-semibold text-gray-800">{otConfirmData.currentTotal.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Adding</span>
                <span className="font-semibold text-gray-800">+{otConfirmData.newHours.toFixed(1)}h</span>
              </div>
              <div className="border-t border-orange-200 pt-2 flex justify-between text-sm font-bold">
                <span className="text-gray-700">Total</span>
                <span className="text-orange-600">{(otConfirmData.currentTotal + otConfirmData.newHours).toFixed(1)}h</span>
              </div>
              <div className="flex justify-between text-xs text-orange-600 font-medium">
                <span>Overtime</span>
                <span>+{otConfirmData.otHours.toFixed(1)}h OT</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowOtConfirm(false); setOtConfirmData(null); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowOtConfirm(false);
                  setOtConfirmData(null);
                  await submitTimeLog();
                }}
                className="btn-primary flex-1 bg-orange-600 hover:bg-orange-700"
              >
                Proceed with OT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
