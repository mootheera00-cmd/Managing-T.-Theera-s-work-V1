import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Download, Plus, X, Trash2, Pencil, Calendar
} from 'lucide-react';
import { getProjects, getProject, getTimeLogs, saveTimeLog, deleteTimeLog, getGanttTasks, initializeGanttTasks } from '../api/client';
import type { Project, TimeLogEntry } from '../types';

/* ── GanttTask interface (lightweight, no dates) ── */
interface GanttTask {
  id: string;
  name: string;
  category: string;
}

/* ── Default Gantt tasks (same logic as ProcessPage) ── */
function getDefaultTasks(step: string, workType: string): GanttTask[] {
  const wt = workType.toLowerCase();
  if (step === 'test_status') {
    if (wt.includes('investigation')) {
      return [
        { id: 'ti_1', name: 'Take photos', category: 'Inspection' },
        { id: 'ti_2', name: 'Measure sound', category: 'Measurement' },
        { id: 'ti_3', name: 'Disassemble bearings', category: 'Disassembly' },
        { id: 'ti_4', name: 'Take photos before washing', category: 'Inspection' },
        { id: 'ti_5', name: 'Washing', category: 'Cleaning' },
        { id: 'ti_6', name: 'Take photos after washing', category: 'Inspection' },
        { id: 'ti_7', name: 'Roundness check', category: 'Measurement' },
        { id: 'ti_8', name: 'CCD check', category: 'Measurement' },
        { id: 'ti_9', name: 'Measure moisture', category: 'Measurement' },
        { id: 'ti_10', name: 'FTIR check', category: 'Measurement' },
        { id: 'ti_11', name: 'Measure dimensions', category: 'Measurement' },
        { id: 'ti_12', name: 'Hardness check', category: 'Measurement' },
      ];
    }
    if (wt === 'evaluation') {
      return [
        { id: 'te_1', name: 'Attend a meeting with customer', category: 'Meeting' },
        { id: 'te_2', name: 'Attend a meeting with Plant (NBMT ro ...)', category: 'Meeting' },
        { id: 'te_3', name: 'Contact with sales', category: 'Communication' },
        { id: 'te_4', name: 'Contact and consult with the CBT department', category: 'Communication' },
        { id: 'te_5', name: 'Make test planning (Test Schedule) Report', category: 'Planning' },
        { id: 'te_6', name: 'Make prototype specs for manufacturing bearings', category: 'Specification' },
        { id: 'te_7', name: 'Jig design (drawing)', category: 'Design' },
        { id: 'te_8', name: 'Check the drawing', category: 'Review' },
        { id: 'te_9', name: 'Order a jig', category: 'Procurement' },
        { id: 'te_10', name: 'Check a jig', category: 'Inspection' },
        { id: 'te_11', name: 'Prepare for testing (Documentation and Planning)', category: 'Planning' },
        { id: 'te_12', name: 'Perform Test', category: 'Testing' },
        { id: 'te_13', name: 'Investigation after test', category: 'Analysis' },
      ];
    }
    return [];
  }
  if (step === 'report_status') {
    return [
      { id: 'mr_1', name: 'Gather information', category: 'Research' },
      { id: 'mr_2', name: 'Analyze data', category: 'Analysis' },
      { id: 'mr_3', name: 'Making Report', category: 'Reporting' },
    ];
  }
  if (step === 'check_status') {
    return [
      { id: 'cr_1', name: 'Final Report Drafting', category: 'Reporting' },
      { id: 'cr_2', name: 'Checking the report', category: 'Review' },
      { id: 'cr_3', name: 'GM Checking the report', category: 'Review' },
      { id: 'cr_4', name: 'Approval report', category: 'Milestone' },
    ];
  }
  return [];
}

/* ── CSV Row type ── */
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
  project_id?: number;
  task_id?: string;
}

/* ── Date helpers ── */
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function getWeekDates(monday: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(d.getDate() + i); dates.push(toISODate(d)); }
  return dates;
}
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const mDay = monday.getDate(), sDay = sunday.getDate();
  const mMonth = MONTH_NAMES[monday.getMonth()], sMonth = MONTH_NAMES[sunday.getMonth()];
  const year = monday.getFullYear();
  return monday.getMonth() === sunday.getMonth() ? `${mDay} - ${sDay} ${mMonth} ${year}` : `${mDay} ${mMonth} - ${sDay} ${sMonth} ${year}`;
}

const DEFAULT_GROUP = 'HUB';
const DEFAULT_USER = 'T.Theera';
const DEFAULT_CODE = '1';
const DEFAULT_MODE = 'log';

/* ── Work Type color map ── */
function getWtGroup(wt: string | undefined): 'evaluation' | 'investigation' | 'teal' | 'violet' | 'rose' | 'slate' {
  const w = (wt || '').trim().toLowerCase();
  if (w === 'evaluation') return 'evaluation';
  if (w.startsWith('investigation')) return 'investigation';
  if (['education for internal', 'maintenance', 'improvement'].includes(w)) return 'teal';
  if (w.startsWith('tech. support')) return 'violet';
  if (['meeting with internal', 'leave', 'admin', 'hr'].includes(w)) return 'rose';
  return 'slate';
}
function getWtColor(wt: string | undefined): string {
  const g = getWtGroup(wt);
  const map: Record<string, string> = { evaluation: 'bg-orange-500', investigation: 'bg-blue-500', teal: 'bg-teal-500', violet: 'bg-violet-500', rose: 'bg-rose-500', slate: 'bg-slate-500' };
  return map[g];
}
function getWtLight(wt: string | undefined): string {
  const g = getWtGroup(wt);
  const map: Record<string, string> = { evaluation: 'bg-orange-50 border-orange-200', investigation: 'bg-blue-50 border-blue-200', teal: 'bg-teal-50 border-teal-200', violet: 'bg-violet-50 border-violet-200', rose: 'bg-rose-50 border-rose-200', slate: 'bg-slate-100 border-slate-300' };
  return map[g];
}
function getCardStyle(wt: string | undefined): { bg: string; text: string; border: string; shadow: string } {
  const g = getWtGroup(wt);
  const map: Record<string, { bg: string; text: string; border: string; shadow: string }> = {
    evaluation: { bg: 'bg-orange-500', text: 'text-white', border: 'border-white/25', shadow: 'shadow-orange-400/30' },
    investigation: { bg: 'bg-blue-500', text: 'text-white', border: 'border-white/25', shadow: 'shadow-blue-400/30' },
    teal: { bg: 'bg-teal-500', text: 'text-white', border: 'border-white/25', shadow: 'shadow-teal-400/30' },
    violet: { bg: 'bg-violet-500', text: 'text-white', border: 'border-white/25', shadow: 'shadow-violet-400/30' },
    rose: { bg: 'bg-rose-500', text: 'text-white', border: 'border-white/25', shadow: 'shadow-rose-400/30' },
    slate: { bg: 'bg-slate-500', text: 'text-white', border: 'border-white/25', shadow: 'shadow-slate-400/30' },
  };
  return map[g];
}

export default function TimeSheetPage() {
  const today = new Date();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(today));
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDetails, setProjectDetails] = useState<Record<number, Project>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toISODate(today));
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected report number per project (projectId -> report number)
  const [selectedReportNo, setSelectedReportNo] = useState<Record<number, string>>({});

  // Hour popup
  const [popup, setPopup] = useState<{ open: boolean; date: string; project: Project; task: GanttTask } | null>(null);
  const [popupHours, setPopupHours] = useState('');
  const [hoursError, setHoursError] = useState('');

  // OT confirmation
  const [otConfirm, setOtConfirm] = useState<{ date: string; hours: number; project: Project; task: GanttTask; currentTotal: number } | null>(null);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // CSV Export date range
  const [showCsvExport, setShowCsvExport] = useState(false);
  const [csvDateFrom, setCsvDateFrom] = useState('');
  const [csvDateTo, setCsvDateTo] = useState('');
  const [csvError, setCsvError] = useState('');

  // Edit hours popup
  const [editRow, setEditRow] = useState<CsvRow | null>(null);
  const [editHours, setEditHours] = useState('');

  // Editable meta
  const [metaGroup, setMetaGroup] = useState(DEFAULT_GROUP);
  const [metaUser, setMetaUser] = useState(DEFAULT_USER);

  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
  const dateFrom = weekDates[0];
  const dateTo = weekDates[6];

  // Fetch projects & load existing time logs for the week
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [allProjects, logs] = await Promise.all([
          getProjects({ year: today.getFullYear() }),
          getTimeLogs({ date_from: dateFrom, date_to: dateTo }),
        ]);
        setProjects(allProjects);
        // Convert existing time logs to CsvRow format
        const existingRows: CsvRow[] = logs.map(log => ({
          id: `log_${log.id}`,
          date: log.entry_date,
          user: metaUser,
          group: metaGroup,
          sales: log.requester || '',
          category: log.work_type || '',
          customer: log.customer_name || '',
          aptx: log.report_number || '',
          code: DEFAULT_CODE,
          hours: log.hours,
          comment: `${log.task_name || ''}${log.report_number ? ' [' + log.report_number + ']' : ''}`,
          mode: DEFAULT_MODE,
          project_id: log.project_id,
          task_id: log.task_id,
        }));
        setRows(existingRows);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [dateFrom, dateTo]);

  // Load project detail on selection
  useEffect(() => {
    if (!selectedProjectId || projectDetails[selectedProjectId]) return;
    (async () => {
      try {
        const detail = await getProject(selectedProjectId!);
        setProjectDetails(p => ({ ...p, [selectedProjectId!]: detail }));
      } catch (e) { console.error(e); }
    })();
  }, [selectedProjectId, projectDetails]);

  const selectedProj = selectedProjectId
    ? (projectDetails[selectedProjectId] || projects.find(p => p.id === selectedProjectId))
    : null;
  const selectedWT = selectedProj?.work_request?.work_type || projects.find(p => p.id === selectedProjectId)?.work_type || '';

  const [allProjectTasks, setAllProjectTasks] = useState<{ step: string; stepLabel: string; task: GanttTask }[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) {
      setAllProjectTasks([]);
      return;
    }

    const proj = projects.find(p => p.id === selectedProjectId);
    const detail = projectDetails[selectedProjectId];
    const rns = detail?.report_numbers || [];
    const curRN = selectedReportNo[selectedProjectId] || '';

    // If project has report numbers, but none is selected yet, do not fetch tasks yet
    if (rns.length > 0 && !curRN) {
      setAllProjectTasks([]);
      return;
    }

    let isMounted = true;
    setLoadingTasks(true);

    const steps = [
      { key: 'test_status', label: 'Perform Test / Investigation' },
      { key: 'report_status', label: 'Making Report' },
      { key: 'check_status', label: 'Check Report' }
    ];

    const loadTasks = async () => {
      const fetchedTasks: { step: string; stepLabel: string; task: GanttTask }[] = [];
      const workType = proj?.work_request?.work_type || proj?.work_type || '';

      for (const step of steps) {
        try {
          const res = await getGanttTasks(selectedProjectId, step.key, curRN);
          if (!isMounted) return;

          let stepTasks: any[] = [];
          if (!res.initialized) {
            // Not initialized in DB yet, generate defaults and initialize
            const defaultTasks = getDefaultTasks(step.key, workType);
            if (defaultTasks.length > 0) {
              const initRes = await initializeGanttTasks(selectedProjectId, {
                step: step.key,
                report_number: curRN,
                tasks: defaultTasks.map(t => ({
                  id: t.id,
                  name: t.name,
                  category: t.category,
                  start: toISODate(new Date()),
                  end: toISODate(new Date()),
                  progress: 0,
                  color: 'blue'
                }))
              });
              stepTasks = initRes.tasks;
            }
          } else {
            stepTasks = res.tasks;
          }

          stepTasks.forEach(t => {
            fetchedTasks.push({
              step: step.key,
              stepLabel: step.label,
              task: {
                id: t.id,
                name: t.name,
                category: t.category
              }
            });
          });
        } catch (err) {
          console.error(`Failed to load tasks for step ${step.key}`, err);
        }
      }

      if (isMounted) {
        setAllProjectTasks(fetchedTasks);
        setLoadingTasks(false);
      }
    };

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId, selectedReportNo, projectDetails, projects]);

  const addRow = useCallback((date: string, proj: Project, task: GanttTask, hours: number, dbId?: number) => {
    const wr = proj.work_request;
    const rns = projectDetails[proj.id]?.report_numbers || [];
    const bearingNo = wr?.bearing_no || proj.bearing_no || '';
    const selectedRN = selectedReportNo[proj.id] || '';
    const aptxValue = selectedRN || rns.map(r => r.report_number).join(', ');
    setRows(prev => [...prev, {
      id: dbId ? `log_${dbId}` : Date.now().toString() + Math.random().toString(36).slice(2, 6),
      date,
      user: metaUser,
      group: metaGroup,
      sales: wr?.requester || proj.requester || '',
      category: wr?.work_type || proj.work_type || '',
      customer: wr?.customer_name || proj.customer_name || '',
      aptx: aptxValue,
      code: DEFAULT_CODE,
      hours,
      comment: `${task.name}${bearingNo ? ' ' + bearingNo : ''}${selectedRN ? ' [' + selectedRN + ']' : ''}`,
      mode: DEFAULT_MODE,
      project_id: proj.id,
      task_id: task.id,
    }]);
  }, [metaGroup, metaUser, projectDetails, selectedReportNo]);

  const handleSaveHours = async () => {
    if (!popup) return;
    const h = parseFloat(popupHours);
    if (isNaN(h) || h <= 0) return;
    if (h > 8) {
      setHoursError('Hours exceed limit (max 8)');
      return;
    }
    setHoursError('');
    // Check total hours for this date
    const currentTotal = rows.filter(r => r.date === popup.date).reduce((s, r) => s + r.hours, 0);
    if (currentTotal + h > 12) {
      setHoursError(`Total for ${popup.date} would exceed 12h limit (current: ${currentTotal}h + ${h}h)`);
      return;
    }
    if (currentTotal + h > 8) {
      // Close popup first, then ask OT confirmation
      const p = popup;
      setPopup(null);
      setPopupHours('');
      setOtConfirm({ date: p.date, hours: h, project: p.project, task: p.task, currentTotal });
      return;
    }
    setHoursError('');
    doSaveHours(popup.date, popup.project, popup.task, h);
  };

  const doSaveHours = async (date: string, project: Project, task: GanttTask, hours: number) => {
    try {
      const savedLog = await saveTimeLog({
        project_id: project.id,
        task_id: task.id,
        task_name: task.name,
        entry_date: date,
        hours,
        slots_json: JSON.stringify([{ hour: Math.floor(hours), minutes: Math.round((hours % 1) * 60), note: task.name, value: hours }]),
      });

      const wr = project.work_request;
      const rns = projectDetails[project.id]?.report_numbers || [];
      const bearingNo = wr?.bearing_no || project.bearing_no || '';
      const selectedRN = selectedReportNo[project.id] || '';
      const aptxValue = selectedRN || rns.map(r => r.report_number).join(', ');

      const newRow: CsvRow = {
        id: `log_${savedLog.id}`,
        date,
        user: metaUser,
        group: metaGroup,
        sales: wr?.requester || project.requester || '',
        category: wr?.work_type || project.work_type || '',
        customer: wr?.customer_name || project.customer_name || '',
        aptx: aptxValue,
        code: DEFAULT_CODE,
        hours,
        comment: `${task.name}${bearingNo ? ' ' + bearingNo : ''}${selectedRN ? ' [' + selectedRN + ']' : ''}`,
        mode: DEFAULT_MODE,
        project_id: project.id,
        task_id: task.id,
      };

      setRows(prev => {
        const filtered = prev.filter(r => !(
          (r.id === newRow.id) ||
          (r.project_id === newRow.project_id && r.task_id === newRow.task_id && r.date === newRow.date)
        ));
        return [...filtered, newRow];
      });
    } catch (e) {
      console.error(e);
      alert('Failed to save hours to database');
    }
    setPopup(null);
    setPopupHours('');
    setHoursError('');
  };

  const handleOtYes = () => {
    if (!otConfirm) return;
    // Even with OT, cap at 12h total
    if (otConfirm.currentTotal + otConfirm.hours > 12) {
      alert(`Cannot exceed 12h total for ${otConfirm.date} (current: ${otConfirm.currentTotal}h + ${otConfirm.hours}h)`);
      setOtConfirm(null);
      return;
    }
    doSaveHours(otConfirm.date, otConfirm.project, otConfirm.task, otConfirm.hours);
    setOtConfirm(null);
  };

  const handleOtNo = () => {
    setOtConfirm(null);
  };

  const updateCell = (rowId: string, field: keyof CsvRow, value: string | number) => {
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, [field]: value } : r)));
  };
  const removeRow = async (rowId: string) => {
    if (rowId.startsWith('log_')) {
      const dbId = parseInt(rowId.replace('log_', ''), 10);
      try {
        await deleteTimeLog(dbId);
      } catch (e) {
        console.error('Failed to delete time log from database:', e);
        alert('Failed to delete time log from database');
        return;
      }
    }
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const doExportCsv = useCallback((from: string, to: string) => {
    const header = ['Date','User','Group','Sales','Category','Customer','APTX','Code','Hours','Comment','Mode'];
    const data = rows.map(r => [r.date, r.user, r.group, r.sales, r.category, r.customer, r.aptx, r.code, r.hours.toFixed(1), r.comment, r.mode]);
    const csv = [header.join(','), ...data.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daily_Week_${from}_to_${to}_${metaUser.replace(/\s+/g,'')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows, metaUser]);

  const handleCsvExport = () => {
    setCsvDateFrom(dateFrom);
    setCsvDateTo(dateTo);
    setCsvError('');
    setShowCsvExport(true);
  };

  const handleCsvConfirm = () => {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(csvDateFrom) || !dateRegex.test(csvDateTo)) {
      setCsvError('Invalid date format. Use YYYY-MM-DD (e.g. 2026-06-01)');
      return;
    }
    // Validate date values
    const d1 = new Date(csvDateFrom + 'T00:00:00');
    const d2 = new Date(csvDateTo + 'T00:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      setCsvError('Invalid date. Please enter valid dates.');
      return;
    }
    if (d2 < d1) {
      setCsvError('End date must be after start date.');
      return;
    }
    setCsvError('');
    doExportCsv(csvDateFrom, csvDateTo);
    setShowCsvExport(false);
  };

  // Filter rows by selected date
  const filteredRows = useMemo(() => rows.filter(r => r.date === selectedDate), [rows, selectedDate]);

  const totalHours = useMemo(() => filteredRows.reduce((s, r) => s + r.hours, 0), [filteredRows]);

  return (
    <div className="flex gap-5 h-[calc(100vh-6rem)]">
      {/* ── Sidebar ── */}
      <div className="w-72 flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          {selectedProjectId ? (
            <>
              <button onClick={() => { setSelectedProjectId(null); setSelectedReportNo({}); }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-sm font-bold text-slate-700 truncate ml-2">{projects.find(p => p.id === selectedProjectId)?.title || 'Project'}</h2>
            </>
          ) : (
            <h2 className="text-sm font-bold text-slate-700">Projects</h2>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {selectedProjectId ? (
            /* ── Selected project detail view ── */
            (() => {
              const proj = projects.find(p => p.id === selectedProjectId);
              if (!proj) return null;
              const detail = projectDetails[selectedProjectId];
              const rns = detail?.report_numbers || [];
              const curRN = selectedReportNo[selectedProjectId] || '';
              return (
                <div>
                  {/* Project info card */}
                  <div className="px-4 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className={`w-3 h-3 rounded-full ${getWtColor(proj.work_type || '')}`} />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{proj.work_type || '—'}</span>
                    </div>
                    <div className="text-xs text-slate-400 ml-5.5">{proj.requester || '—'}</div>
                  </div>

                  {/* Report Number selector */}
                  {rns.length > 1 ? (
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                      <select
                        value={curRN}
                        onChange={e => setSelectedReportNo(prev => ({ ...prev, [selectedProjectId]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-[11px] font-bold border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      >
                        <option value="">— Select Report —</option>
                        {rns.map(rn => (
                          <option key={rn.id} value={rn.report_number}>
                            {rn.report_number}{rn.item_description ? ` — ${rn.item_description}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : rns.length === 1 && !curRN ? (
                    (() => { setTimeout(() => setSelectedReportNo(prev => ({ ...prev, [selectedProjectId]: rns[0].report_number })), 0); return null; })()
                  ) : null}

                  {/* Tasks */}
                  {curRN && allProjectTasks.length > 0 && allProjectTasks.map(({ step, task }) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 pl-8 py-3 border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors">
                      <span className="flex-1 text-xs font-medium text-slate-700 truncate">{task.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{step === 'test_status' ? 'Test' : step === 'report_status' ? 'Report' : 'Check'}</span>
                      <button onClick={() => setPopup({ open: true, date: selectedDate, project: proj, task })}
                        className="flex-shrink-0 px-2 py-1 text-[10px] font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {curRN && allProjectTasks.length === 0 && (
                    <div className="px-4 py-6 text-xs text-slate-400 italic text-center">No tasks for this project.</div>
                  )}
                </div>
              );
            })()
          ) : (
            /* ── Grouped project list ── */
            (() => {
              const groups: Record<string, Project[]> = {};
              for (const p of projects) {
                const wt = p.work_type || 'Others';
                if (!groups[wt]) groups[wt] = [];
                groups[wt].push(p);
              }
              const sortedKeys = Object.keys(groups).sort();
              return (
                <div>
                  {sortedKeys.map(wt => (
                    <div key={wt}>
                      <div className={`px-3 py-2 flex items-center gap-2 sticky top-0 z-10 ${getWtLight(wt)}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${getWtColor(wt)}`} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{wt}</span>
                        <span className="text-[9px] font-semibold text-slate-400 ml-auto">{groups[wt].length}</span>
                      </div>
                      {groups[wt].map(proj => {
                        const card = getCardStyle(proj.work_type || '');
                        return (
                        <button key={proj.id}
                          onClick={() => setSelectedProjectId(proj.id)}
                          className={`w-[calc(100%-16px)] text-left mx-2 my-1.5 px-3 py-2 rounded-lg border shadow transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-0.5 ${card.bg} ${card.border} ${card.shadow}`}>
                          <div className={`text-[9px] font-bold tracking-wide ${card.text} opacity-80 uppercase truncate`}>{proj.work_type || 'General'}</div>
                          <div className={`text-xs font-black leading-tight ${card.text} truncate`}>{proj.title}</div>
                          <div className={`flex items-center gap-2 text-[10px] ${card.text} opacity-70`}>
                            <span className="truncate">{proj.requester || '—'}</span>
                            {proj.bearing_no && <span className="truncate shrink-0">· {proj.bearing_no}</span>}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { const p = new Date(currentMonday); p.setDate(p.getDate()-7); setCurrentMonday(p); }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <button onClick={() => setCurrentMonday(getMonday(today))}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors">Today</button>
            <span className="text-sm font-semibold text-gray-600 mx-1 min-w-[140px] text-center">{formatWeekRange(currentMonday)}</span>
            <button onClick={() => { const n = new Date(currentMonday); n.setDate(n.getDate()+7); setCurrentMonday(n); }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
            <button onClick={() => setShowCalendar(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Pick a date">
              <Calendar className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Group</label>
              <input value={metaGroup} onChange={e => setMetaGroup(e.target.value)}
                className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">User</label>
              <input value={metaUser} onChange={e => setMetaUser(e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <button onClick={handleCsvExport} disabled={rows.length===0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Download className="w-4 h-4" /> Export CSV</button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-4">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Total Hours: <span className="text-gray-900">{totalHours.toFixed(1)}</span></span>
          <span className="text-xs text-slate-400">· {filteredRows.length} entries for {selectedDate}</span>
        </div>

        {/* Date tabs */}
        <div className="flex gap-2 flex-wrap">
          {weekDates.map(date => {
            const d = new Date(date+'T00:00:00');
            const dn = DAY_NAMES_SHORT[d.getDay()===0?6:d.getDay()-1];
            const isSelected = selectedDate === date;
            const dateEntries = rows.filter(r => r.date === date).reduce((s, r) => s + r.hours, 0);
            return (
              <button key={date} onClick={() => setSelectedDate(date)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors relative ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                {dn} {d.getDate()}
                {dateEntries > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 text-white text-[8px] font-bold rounded-full flex items-center justify-center ${dateEntries >= 8 ? 'bg-emerald-500' : 'bg-orange-400'}`}>
                    {Math.round(dateEntries)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-slate-200 sticky top-0 z-10">
                  {['Date','User','Group','Sales','Category','Customer','APTX','Code','Hours','Comment','Mode',''].map(h =>
                    <th key={h} className={`px-3 py-2.5 ${h==='Hours'?'text-right':'text-left'} font-bold text-gray-500 uppercase tracking-wider ${h===''?'w-10 text-center':''}`}>{h||'#'}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length===0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400 text-sm">No entries for {selectedDate}. Select a project &amp; report number, then click + on a task to log hours.</td></tr>
                )}
                {filteredRows.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    {(['date','user','group','sales','category','customer','aptx'] as const).map(f => (
                      <td key={f} className="px-3 py-2">
                        <input value={row[f] as string} onChange={e => updateCell(row.id, f, e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-700 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <input value={row.code} onChange={e => updateCell(row.id, 'code', e.target.value)}
                        className="w-12 bg-transparent text-xs text-slate-700 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.5" min="0" value={row.hours}
                        onChange={e => updateCell(row.id, 'hours', parseFloat(e.target.value)||0)}
                        onBlur={async (e) => {
                          const h = parseFloat(e.target.value) || 0;
                          if (h > 0 && h <= 12 && row.project_id && row.task_id) {
                            try {
                              await saveTimeLog({
                                project_id: row.project_id,
                                task_id: row.task_id,
                                task_name: row.comment.split(' [')[0].split(' ')[0],
                                entry_date: row.date,
                                hours: h,
                                slots_json: JSON.stringify([{ hour: Math.floor(h), minutes: Math.round((h % 1) * 60), note: row.comment, value: h }]),
                              });
                            } catch (err) {
                              console.error('Failed to auto-save hours:', err);
                            }
                          }
                        }}
                        className="w-16 bg-transparent text-xs font-bold text-slate-900 text-right focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.comment} onChange={e => updateCell(row.id, 'comment', e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-700 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.mode} onChange={e => updateCell(row.id, 'mode', e.target.value)}
                        className="w-16 bg-transparent text-xs text-slate-700 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-2 text-center flex items-center gap-1">
                      <button onClick={() => { setEditRow(row); setEditHours(String(row.hours)); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Edit hours">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(row.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRows.length>0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-semibold text-right">Total: {totalHours.toFixed(1)}h</div>
          )}
        </div>
      </div>

      {/* ── CSV Export Popup ── */}
      {showCsvExport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">Export CSV</h3>
              <button onClick={() => setShowCsvExport(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={csvDateFrom} onChange={e => { setCsvDateFrom(e.target.value); setCsvError(''); }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-955 font-[Manrope]" />
                  <span className="text-xs text-slate-400 font-bold">to</span>
                  <input type="date" value={csvDateTo} onChange={e => { setCsvDateTo(e.target.value); setCsvError(''); }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-955 font-[Manrope]" />
                </div>
              </div>
              <div className="text-xs text-slate-400">
               <span className="font-semibold">Filename:</span> Daily_Week_{csvDateFrom}_to_{csvDateTo}_{metaUser.replace(/\s+/g,'')}.csv
              </div>
              {csvError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-red-600">{csvError}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-end">
              <button onClick={() => setShowCsvExport(false)} className="px-4 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleCsvConfirm}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-colors">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar Popup ── */}
      {showCalendar && <CalendarModal
        currentMonday={currentMonday}
        onSelect={(d: Date) => { setCurrentMonday(getMonday(d)); setSelectedDate(toISODate(d)); setShowCalendar(false); }}
        onClose={() => setShowCalendar(false)}
      />}

      {/* ── Edit Hours Popup ── */}
      {editRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">Edit Hours</h3>
              <button onClick={() => setEditRow(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Task</label>
                <p className="text-sm text-slate-700">{editRow.comment}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                <p className="text-sm text-slate-700">{editRow.date}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hours</label>
                <input type="number" step="0.5" min="0.5" max="12" value={editHours}
                  onChange={e => setEditHours(e.target.value)} autoFocus
                  className="w-full px-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950" />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-end">
              <button onClick={() => setEditRow(null)} className="px-4 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors">Cancel</button>
              <button onClick={async () => {
                if (editRow && editHours) {
                  const h = parseFloat(editHours);
                  if (!isNaN(h) && h > 0 && h <= 12) {
                    if (editRow.project_id && editRow.task_id) {
                      try {
                        await saveTimeLog({
                          project_id: editRow.project_id,
                          task_id: editRow.task_id,
                          task_name: editRow.comment.split(' [')[0].split(' ')[0],
                          entry_date: editRow.date,
                          hours: h,
                          slots_json: JSON.stringify([{ hour: Math.floor(h), minutes: Math.round((h % 1) * 60), note: editRow.comment, value: h }]),
                        });
                      } catch (e) {
                        console.error('Failed to update hours in database:', e);
                        alert('Failed to update hours in database');
                        return;
                      }
                    }
                    updateCell(editRow.id, 'hours', h);
                  }
                }
                setEditRow(null);
              }} disabled={!editHours||isNaN(parseFloat(editHours))||parseFloat(editHours)<=0||parseFloat(editHours)>12}
                className="px-5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Popup ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-5 text-center">
              <div className="text-3xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Entry</h3>
              <p className="text-sm text-slate-600">Are you sure you want to delete this entry?</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-center">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[90px]">
                Cancel
              </button>
              <button onClick={() => { removeRow(confirmDeleteId); setConfirmDeleteId(null); }}
                className="px-6 py-2.5 text-sm font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors min-w-[90px]">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OT Confirmation Popup ── */}
      {otConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-5 text-center">
              <div className="text-3xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">OT Confirmation</h3>
              <p className="text-sm text-slate-600">
                Adding {otConfirm.hours}h will exceed 8h for {otConfirm.date}.
              </p>
              <p className="text-xs text-amber-600 font-semibold mt-1">Max total per day is 12h (current: {otConfirm.currentTotal}h)</p>
              <p className="text-sm font-bold text-slate-700 mt-2">Do you want to log this as OT?</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-center">
              <button onClick={handleOtNo}
                className="px-6 py-2.5 text-sm font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors min-w-[90px]">
                No
              </button>
              <button onClick={handleOtYes}
                className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[90px]">
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hours Popup ── */}
      {popup?.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">Log Hours</h3>
              <button onClick={() => setPopup(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Project</label><p className="text-sm font-semibold text-slate-800">{popup.project.title}</p></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Sales</label>
                  <p className="text-sm font-semibold text-blue-700">{popup.project.work_request?.requester || popup.project.requester || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Category</label>
                  <p className="text-sm font-semibold text-slate-800">{popup.project.work_request?.work_type || popup.project.work_type || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Customer</label>
                  <p className="text-sm font-semibold text-emerald-700">{popup.project.work_request?.customer_name || popup.project.customer_name || '—'}</p>
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Task</label><p className="text-sm text-slate-700">{popup.task.name}</p></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label><p className="text-sm text-slate-700">{popup.date}</p></div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hours</label>
                <input type="number" step="0.5" min="0.5" max="8" value={popupHours} onChange={e => { setPopupHours(e.target.value); setHoursError(''); }}
                  placeholder="e.g. 8" autoFocus
                  className="w-full px-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950" />
                {hoursError && (
                  <p className="text-xs font-bold text-red-500 mt-1.5">{hoursError}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">Max 8h per entry</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-end">
              <button onClick={() => setPopup(null)} className="px-4 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSaveHours} disabled={!popupHours||isNaN(parseFloat(popupHours))||parseFloat(popupHours)<=0||parseFloat(popupHours)>8}
                className="px-5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Calendar Modal ──────────────────────────── */
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function CalendarModal({ currentMonday, onSelect, onClose }: {
  currentMonday: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(currentMonday);
    d.setDate(1);
    return d;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid: (number | null)[][] = [];
  let day = 1;
  for (let row = 0; row < 6; row++) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      if ((row === 0 && col < startOffset) || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day++);
      }
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }

  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-full max-w-xs mx-4" onClick={e => e.stopPropagation()}>
        {/* Month/Year header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h3 className="text-sm font-bold text-gray-800">{MONTHS[month]} {year}</h3>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-0.5">
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((d, di) => {
                if (d === null) return <div key={di} />;
                const dateObj = new Date(year, month, d);
                const monday = getMonday(dateObj);
                const isInWeek = monday.getTime() === currentMonday.getTime();
                return (
                  <button key={di} onClick={() => onSelect(dateObj)}
                    className={`aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-colors ${
                      isInWeek ? 'bg-gray-900 text-white' : isToday(d) ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    {d}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
