import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Save, X,
  ChevronLeft, ChevronRight, CheckCircle2, Percent
} from 'lucide-react';
import {
  getProject,
  getGanttTasks,
  initializeGanttTasks,
  createGanttTask,
  updateGanttTask,
  deleteGanttTask
} from '../api/client';
import type { Project } from '../types';
import FileUpload from '../components/FileUpload';

// ── Color Theme Definitions ──────────────────────────────────────────────────
interface ColorConfig {
  name: string;
  strong: string;
  light: string;
  dark: string;
  dot: string;
}

const COLORS: Record<string, ColorConfig> = {
  blue: { name: 'Blue', strong: '#3b82f6', light: '#dbeafe', dark: '#1d4ed8', dot: '#3b82f6' },
  teal: { name: 'Teal', strong: '#14b8a6', light: '#ccfbf1', dark: '#0f766e', dot: '#14b8a6' },
  coral: { name: 'Coral', strong: '#f43f5e', light: '#ffe4e6', dark: '#be123c', dot: '#f43f5e' },
  amber: { name: 'Amber', strong: '#f59e0b', light: '#fef3c7', dark: '#b45309', dot: '#f59e0b' },
  purple: { name: 'Purple', strong: '#8b5cf6', light: '#ede9fe', dark: '#6d28d9', dot: '#8b5cf6' },
  pink: { name: 'Pink', strong: '#ec4899', light: '#fce7f3', dark: '#be185d', dot: '#ec4899' },
  green: { name: 'Green', strong: '#10b981', light: '#d1fae5', dark: '#047857', dot: '#10b981' },
};

// ── Gantt Task Schema ────────────────────────────────────────────────────────
interface GanttTask {
  id: string;
  name: string;
  category: string;
  start: Date;
  end: Date;
  progress: number;
  color: string;
}

function toISODateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 30-min time slots from 08:00 to 17:00 (18 slots)
const TIME_SLOTS: { hour: number; minute: number; label: string; value: number }[] = [];
for (let h = 8; h <= 16; h++) {
  TIME_SLOTS.push({ hour: h, minute: 0, label: `${String(h).padStart(2, '0')}:00`, value: h });
  TIME_SLOTS.push({ hour: h, minute: 30, label: `${String(h).padStart(2, '0')}:30`, value: h + 0.5 });
}
TIME_SLOTS.push({ hour: 17, minute: 0, label: '17:00', value: 17 });

// ── Default tasks per work-type group + step ──
function getDefaultTasks(step: string, workType: string, today: Date): GanttTask[] {
  const getRelDate = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const wt = workType.toLowerCase();

  // Only the "test_status" step (Perform Test / Investigation) has custom defaults
  if (step === 'test_status') {
    // Investigation types → Perform Investigation
    if (wt.includes('investigation')) {
      return [
        { id: 'ti_1', name: 'Take photos', category: 'Inspection', start: getRelDate(-10), end: getRelDate(-9), progress: 0, color: 'blue' },
        { id: 'ti_2', name: 'Measure sound', category: 'Measurement', start: getRelDate(-8), end: getRelDate(-7), progress: 0, color: 'teal' },
        { id: 'ti_3', name: 'Disassemble bearings', category: 'Disassembly', start: getRelDate(-6), end: getRelDate(-5), progress: 0, color: 'purple' },
        { id: 'ti_4', name: 'Take photos before washing', category: 'Inspection', start: getRelDate(-4), end: getRelDate(-4), progress: 0, color: 'amber' },
        { id: 'ti_5', name: 'Washing', category: 'Cleaning', start: getRelDate(-3), end: getRelDate(-3), progress: 0, color: 'pink' },
        { id: 'ti_6', name: 'Take photos after washing', category: 'Inspection', start: getRelDate(-2), end: getRelDate(-2), progress: 0, color: 'amber' },
        { id: 'ti_7', name: 'Roundness check', category: 'Measurement', start: getRelDate(-1), end: getRelDate(0), progress: 0, color: 'teal' },
        { id: 'ti_8', name: 'CCD check', category: 'Measurement', start: getRelDate(1), end: getRelDate(2), progress: 0, color: 'teal' },
        { id: 'ti_9', name: 'Measure moisture', category: 'Measurement', start: getRelDate(3), end: getRelDate(3), progress: 0, color: 'teal' },
        { id: 'ti_10', name: 'FTIR check', category: 'Measurement', start: getRelDate(4), end: getRelDate(4), progress: 0, color: 'teal' },
        { id: 'ti_11', name: 'Measure dimensions', category: 'Measurement', start: getRelDate(5), end: getRelDate(6), progress: 0, color: 'teal' },
        { id: 'ti_12', name: 'Hardness check', category: 'Measurement', start: getRelDate(7), end: getRelDate(8), progress: 0, color: 'purple' },
      ];
    }
    // Evaluation → Perform Test
    if (wt === 'evaluation') {
      return [
        { id: 'te_1', name: 'Attend a meeting with customer', category: 'Meeting', start: getRelDate(-14), end: getRelDate(-13), progress: 0, color: 'blue' },
        { id: 'te_2', name: 'Attend a meeting with Plant (NBMT ro ...)', category: 'Meeting', start: getRelDate(-12), end: getRelDate(-11), progress: 0, color: 'blue' },
        { id: 'te_3', name: 'Contact with sales', category: 'Communication', start: getRelDate(-10), end: getRelDate(-10), progress: 0, color: 'teal' },
        { id: 'te_4', name: 'Contact and consult with the CBT department', category: 'Communication', start: getRelDate(-9), end: getRelDate(-8), progress: 0, color: 'teal' },
        { id: 'te_5', name: 'Make test planning (Test Schedule) Report', category: 'Planning', start: getRelDate(-7), end: getRelDate(-5), progress: 0, color: 'amber' },
        { id: 'te_6', name: 'Make prototype specs for manufacturing bearings', category: 'Specification', start: getRelDate(-4), end: getRelDate(-3), progress: 0, color: 'purple' },
        { id: 'te_7', name: 'Jig design (drawing)', category: 'Design', start: getRelDate(-2), end: getRelDate(-1), progress: 0, color: 'pink' },
        { id: 'te_8', name: 'Check the drawing', category: 'Review', start: getRelDate(0), end: getRelDate(0), progress: 0, color: 'amber' },
        { id: 'te_9', name: 'Order a jig', category: 'Procurement', start: getRelDate(1), end: getRelDate(2), progress: 0, color: 'green' },
        { id: 'te_10', name: 'Check a jig', category: 'Inspection', start: getRelDate(3), end: getRelDate(3), progress: 0, color: 'purple' },
        { id: 'te_11', name: 'Prepare for testing (Documentation and Planning)', category: 'Planning', start: getRelDate(4), end: getRelDate(5), progress: 0, color: 'amber' },
        { id: 'te_12', name: 'Perform Test', category: 'Testing', start: getRelDate(6), end: getRelDate(10), progress: 0, color: 'teal' },
        { id: 'te_13', name: 'Investigation after test', category: 'Analysis', start: getRelDate(11), end: getRelDate(13), progress: 0, color: 'purple' },
      ];
    }
    // Other work types → empty (user creates their own)
    return [];
  }

  // Making Report step → default tasks
  if (step === 'report_status') {
    return [
      { id: 'mr_1', name: 'Gather information', category: 'Research', start: getRelDate(-7), end: getRelDate(-4), progress: 0, color: 'blue' },
      { id: 'mr_2', name: 'Analyze data', category: 'Analysis', start: getRelDate(-3), end: getRelDate(-1), progress: 0, color: 'teal' },
      { id: 'mr_3', name: 'Making Report', category: 'Reporting', start: getRelDate(0), end: getRelDate(3), progress: 0, color: 'green' },
    ];
  }

  // Check Report step → default tasks
  if (step === 'check_status') {
    return [
      { id: 'cr_1', name: 'Final Report Drafting', category: 'Reporting', start: getRelDate(-7), end: getRelDate(-4), progress: 0, color: 'blue' },
      { id: 'cr_2', name: 'Checking the report', category: 'Review', start: getRelDate(-3), end: getRelDate(-1), progress: 0, color: 'teal' },
      { id: 'cr_3', name: 'GM Checking the report', category: 'Review', start: getRelDate(0), end: getRelDate(2), progress: 0, color: 'amber' },
      { id: 'cr_4', name: 'Approval report', category: 'Milestone', start: getRelDate(3), end: getRelDate(3), progress: 0, color: 'green' },
    ];
  }

  // For all other steps (store_report_status, etc.) → empty
  // Users create their own tasks
  return [];
}

// Map step key to display name
function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    test_status: 'Perform Test / Investigation',
    report_status: 'Making Report',
    store_report_status: 'Store the report in the folder',
    check_status: 'Check Report',
  };
  return labels[step] || 'Process';
}

function getWorkTypeColor(workType: string): string {
  const wt = workType.toLowerCase();
  if (wt === 'evaluation') return 'bg-orange-600';
  if (wt.includes('investigation')) return 'bg-indigo-600';
  return 'bg-slate-700';
}

export default function ProcessPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const step = searchParams.get('step') || 'test_status';
  const navigate = useNavigate();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReportNo, setSelectedReportNo] = useState<string>('');
  const workType = project?.work_request?.work_type || '';
  const stepLabel = getStepLabel(step);
  const reportNumbers = project?.report_numbers || [];
  const hasMultipleRN = reportNumbers.length > 1;
  const taskStorageKey = selectedReportNo ? `${step}__rn_${selectedReportNo}` : step;

  // Auto-select if only one report number
  useEffect(() => {
    if (reportNumbers.length === 1 && !selectedReportNo) {
      setSelectedReportNo(reportNumbers[0].report_number);
    } else if (reportNumbers.length === 0) {
      setSelectedReportNo('');
    }
  }, [reportNumbers]);

  // ── Gantt States ───────────────────────────────────────────────────────────
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [viewMode, setViewMode] = useState<'hour' | 'day' | 'month' | 'year'>('day');

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Fetch Gantt tasks when project, step, or report number changes
  useEffect(() => {
    const shouldFetch = project && (reportNumbers.length === 0 || selectedReportNo !== '');
    if (!shouldFetch) {
      setTasks([]);
      return;
    }

    let isMounted = true;
    setLoadingTasks(true);

    getGanttTasks(projectId, step, selectedReportNo)
      .then(async (res) => {
        if (!isMounted) return;
        if (!res.initialized) {
          // Initialize with default tasks on backend
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const defaultTasks = getDefaultTasks(step, project.work_request?.work_type || '', today);
          
          try {
            const initRes = await initializeGanttTasks(projectId, {
              step,
              report_number: selectedReportNo,
              tasks: defaultTasks.map(t => ({
                id: t.id,
                name: t.name,
                category: t.category,
                start: toISODateString(t.start),
                end: toISODateString(t.end),
                progress: t.progress,
                color: t.color
              }))
            });

            if (isMounted) {
              setTasks(initRes.tasks.map(t => ({
                id: t.id,
                name: t.name,
                category: t.category,
                start: new Date(t.start + 'T00:00:00'),
                end: new Date(t.end + 'T00:00:00'),
                progress: t.progress,
                color: t.color
              })));
            }
          } catch (err) {
            console.error("Failed to initialize Gantt tasks", err);
          }
        } else {
          setTasks(res.tasks.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            start: new Date(t.start + 'T00:00:00'),
            end: new Date(t.end + 'T00:00:00'),
            progress: t.progress,
            color: t.color
          })));
        }
      })
      .catch(err => {
        console.error("Failed to load Gantt tasks", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingTasks(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, step, selectedReportNo, project, reportNumbers.length]);

  // Modal Editing States
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewTask, setIsNewTask] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formProgress, setFormProgress] = useState(0);
  const [formColor, setFormColor] = useState('blue');

  // Reload project (e.g. after file upload)
  const reloadProject = useCallback(async () => {
    try {
      const proj = await getProject(projectId);
      setProject(proj);
    } catch (e) {
      console.error('Reload project failed', e);
    }
  }, [projectId]);

  // Load project details
  useEffect(() => {
    async function load() {
      try {
        const proj = await getProject(projectId);
        setProject(proj);
      } catch (e) {
        console.error('Load project failed', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // ── Date Navigation & Views ──
  const timeColumns = useMemo(() => {
    const cols: { date: Date; label: string; subLabel: string; isWeekend: boolean; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === 'hour') {
      TIME_SLOTS.forEach(t => {
        const d = new Date(anchorDate);
        d.setHours(t.hour, t.minute, 0, 0);
        const isToday = toISODateString(d) === toISODateString(today);
        cols.push({
          date: d,
          label: t.label,
          subLabel: toISODateString(anchorDate) === toISODateString(today) ? 'Today' : anchorDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
          isWeekend: false,
          isToday,
        });
      });
    } else if (viewMode === 'day') {
      for (let i = 0; i < 14; i++) {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() + i);
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = d.getTime() === today.getTime();
        cols.push({
          date: d,
          label: d.toLocaleDateString('en-US', { day: 'numeric' }),
          subLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
          isWeekend,
          isToday
        });
      }
    } else if (viewMode === 'month') {
      const year = anchorDate.getFullYear();
      const month = anchorDate.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
        const d = new Date(year, month, i);
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = d.getTime() === today.getTime();
        cols.push({
          date: d,
          label: String(i),
          subLabel: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
          isWeekend,
          isToday
        });
      }
    } else {
      const year = anchorDate.getFullYear();
      for (let m = 0; m < 12; m++) {
        const d = new Date(year, m, 1);
        const isToday = today.getFullYear() === year && today.getMonth() === m;
        cols.push({
          date: d,
          label: d.toLocaleDateString('en-US', { month: 'short' }),
          subLabel: String(year),
          isWeekend: false,
          isToday
        });
      }
    }
    return cols;
  }, [anchorDate, viewMode]);

  const gridRange = useMemo(() => {
    if (timeColumns.length === 0) return { startMs: 0, endMs: 0 };
    const start = new Date(timeColumns[0].date);
    const end = new Date(timeColumns[timeColumns.length - 1].date);
    if (viewMode === 'year') {
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (viewMode === 'hour') {
      // Keep exact time boundaries
    }
    start.setHours(0, 0, 0, 0);
    if (viewMode !== 'hour') {
      end.setHours(23, 59, 59, 999);
    }
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [timeColumns, viewMode]);

  const handlePrev = () => {
    const nextAnchor = new Date(anchorDate);
    if (viewMode === 'hour' || viewMode === 'day') {
      nextAnchor.setDate(nextAnchor.getDate() - (viewMode === 'hour' ? 1 : 14));
    } else if (viewMode === 'month') {
      nextAnchor.setMonth(nextAnchor.getMonth() - 1);
    } else {
      nextAnchor.setFullYear(nextAnchor.getFullYear() - 1);
    }
    setAnchorDate(nextAnchor);
  };

  const handleNext = () => {
    const nextAnchor = new Date(anchorDate);
    if (viewMode === 'hour' || viewMode === 'day') {
      nextAnchor.setDate(nextAnchor.getDate() + (viewMode === 'hour' ? 1 : 14));
    } else if (viewMode === 'month') {
      nextAnchor.setMonth(nextAnchor.getMonth() + 1);
    } else {
      nextAnchor.setFullYear(nextAnchor.getFullYear() + 1);
    }
    setAnchorDate(nextAnchor);
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setAnchorDate(today);
  };

  const openEditModal = (task: GanttTask) => {
    setSelectedTask(task);
    setIsNewTask(false);
    setFormName(task.name);
    setFormCategory(task.category);
    setFormStart(toISODateString(task.start));
    setFormEnd(toISODateString(task.end));
    setFormProgress(task.progress);
    setFormColor(task.color);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setSelectedTask(null);
    setIsNewTask(true);
    setFormName('');
    setFormCategory('');
    const today = new Date();
    setFormStart(toISODateString(today));
    setFormEnd(toISODateString(today));
    setFormProgress(0);
    setFormColor('blue');
    setIsModalOpen(true);
  };

  const handleSaveTask = async () => {
    try {
      if (!formName.trim()) {
        alert("Please enter a task name.");
        return;
      }
      if (!formStart) {
        alert("Please select a start date.");
        return;
      }
      if (!formEnd) {
        alert("Please select an end date.");
        return;
      }

      const startDate = new Date(formStart + 'T00:00:00');
      const endDate = new Date(formEnd + 'T00:00:00');
      if (startDate > endDate) {
        alert("Start date cannot be after end date.");
        return;
      }

      if (isNewTask) {
        const newTaskId = Date.now().toString();
        const created = await createGanttTask(projectId, {
          id: newTaskId,
          step,
          report_number: selectedReportNo,
          name: formName,
          category: formCategory.trim() || 'General',
          start: formStart,
          end: formEnd,
          progress: formProgress,
          color: formColor,
        });

        const newTask: GanttTask = {
          id: created.id,
          name: created.name,
          category: created.category,
          start: new Date(created.start + 'T00:00:00'),
          end: new Date(created.end + 'T00:00:00'),
          progress: created.progress,
          color: created.color
        };
        setTasks(prev => [...prev, newTask]);
        setIsModalOpen(false);
      } else if (selectedTask) {
        const updated = await updateGanttTask(projectId, selectedTask.id, {
          name: formName,
          category: formCategory.trim() || 'General',
          start: formStart,
          end: formEnd,
          progress: formProgress,
          color: formColor,
        });

        setTasks(prev =>
          prev.map(t =>
            t.id === selectedTask.id
              ? {
                  ...t,
                  name: updated.name,
                  category: updated.category,
                  start: new Date(updated.start + 'T00:00:00'),
                  end: new Date(updated.end + 'T00:00:00'),
                  progress: updated.progress,
                  color: updated.color
                }
              : t
          )
        );
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error("Failed to save Gantt task", err);
      alert("Error saving Gantt task: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteTask = async () => {
    try {
      if (selectedTask) {
        await deleteGanttTask(projectId, selectedTask.id);
        setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
        setIsModalOpen(false);
      } else {
        alert("No task selected to delete.");
      }
    } catch (err: any) {
      console.error("Failed to delete Gantt task", err);
      alert("Error deleting Gantt task: " + (err.response?.data?.detail || err.message));
    }
  };


  const categories = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.category.trim()))).filter(Boolean);
  }, [tasks]);

  const wtColor = getWorkTypeColor(workType);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/project/${projectId}`)}
          className="mt-0.5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>{project?.title || 'Loading...'}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-semibold text-slate-600">{stepLabel} Log</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">{stepLabel} Daily Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gantt chart: plan task start/end dates
          </p>
        </div>
        {/* ── Report No. selector (prominent, before Add Task) ── */}
        {project && reportNumbers.length > 0 ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Report:</span>
            {hasMultipleRN ? (
              <select
                value={selectedReportNo}
                onChange={e => setSelectedReportNo(e.target.value)}
                className="px-3 py-2 text-xs font-bold border-2 border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-600 min-w-[140px]"
              >
                <option value="">— Select Report —</option>
                {reportNumbers.map(rn => (
                  <option key={rn.id} value={rn.report_number}>
                    {rn.report_number}{rn.item_description ? ` — ${rn.item_description}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-3 py-2 text-xs font-bold bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-700">
                {reportNumbers[0].report_number}
              </span>
            )}
          </div>
        ) : null}
        <button
          onClick={openAddModal}
          disabled={!selectedReportNo}
          className="flex items-center gap-2 px-4 py-2 text-white text-xs font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ backgroundColor: wtColor === 'bg-slate-700' ? '#334155' : wtColor === 'bg-orange-600' ? '#ea580c' : '#4f46e5' }}
          title={!selectedReportNo ? 'Please select a Report Number first' : 'Add a new task'}
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</p>
            <p className="text-2xl font-bold text-amber-700">{tasks.length}</p>
          </div>
        </div>
      </div>

      {/* ── Timeline Navigation ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={handleToday} className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors">
            Today
          </button>
          <button onClick={handleNext} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2 text-sm font-bold text-slate-800">
            {viewMode === 'hour' && anchorDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {viewMode === 'day' && (
              <>{timeColumns[0]?.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - {timeColumns[13]?.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</>
            )}
            {viewMode === 'month' && anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            {viewMode === 'year' && `Year ${anchorDate.getFullYear()}`}
          </span>
        </div>
        <div className="flex items-center p-1 bg-slate-100 rounded-xl self-start sm:self-center">
          {(['hour', 'day', 'month', 'year'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${viewMode === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ── Extract dates from work request ── */}
      {(() => {
        const wr = project?.work_request;
        const receivedRaw = wr?.received_date;
        const dueRaw = wr?.due_date;
        const receivedDate = receivedRaw ? new Date(receivedRaw + 'T00:00:00') : null;
        const dueDate = dueRaw ? new Date(dueRaw + 'T00:00:00') : null;
        const { startMs: gStart, endMs: gEnd } = gridRange;
        const totalDur = gEnd - gStart;

        // Compute left % for received and due markers in the grid
        const receivedLeft = receivedDate && totalDur > 0
          ? Math.max(0, Math.min(100, ((receivedDate.getTime() - gStart) / totalDur) * 100)) : -1;
        const dueLeft = dueDate && totalDur > 0
          ? Math.max(0, Math.min(100, ((dueDate.getTime() - gStart) / totalDur) * 100)) : -1;

        const fmtDate = (d: Date) =>
          d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <div className="min-w-[800px] flex flex-col">
            {/* ── Date Reference Row ── */}
            {(receivedDate || dueDate) && selectedReportNo && (
              <div className="flex border-b border-slate-100">
                <div className="w-[280px] p-2 flex-shrink-0 border-r border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                  {receivedDate && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <span>Received: {fmtDate(receivedDate)}</span>
                    </span>
                  )}
                  {dueDate && (
                    <span className="flex items-center gap-1 ml-auto">
                      <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <span>Due: {fmtDate(dueDate)}</span>
                    </span>
                  )}
                </div>
                <div className="flex-1 relative h-8">
                  {/* Received marker line */}
                  {receivedLeft >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 flex flex-col items-center"
                      style={{ left: `${receivedLeft}%` }}
                    >
                      <div className="w-0.5 flex-1 bg-blue-400/60" />
                    </div>
                  )}
                  {/* Due marker line */}
                  {dueLeft >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 flex flex-col items-center"
                      style={{ left: `${dueLeft}%` }}
                    >
                      <div className="w-0.5 flex-1 bg-red-400/60" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Header Row ── */}
            <div className="flex border-b border-slate-100 bg-slate-50">
              <div className="w-[280px] p-4 flex-shrink-0 font-bold text-xs text-slate-500 uppercase tracking-wider border-r border-slate-100 flex items-center gap-1">
                <span>Task Title</span>
                {selectedReportNo && (
                  <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={selectedReportNo}>
                    {selectedReportNo}
                  </span>
                )}
              </div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${timeColumns.length}, minmax(0, 1fr))` }}>
                {timeColumns.map((col, index) => (
                  <div key={index} className={`p-2 flex flex-col items-center justify-center border-r border-slate-100 text-center relative ${col.isWeekend ? 'bg-slate-100/50' : ''} ${col.isToday ? 'bg-amber-50/70 font-semibold' : ''}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${col.isToday ? 'text-amber-700' : 'text-slate-400'}`}>{col.subLabel}</span>
                    <span className={`text-xs font-black ${col.isToday ? 'text-amber-800' : 'text-slate-600'}`}>{col.label}</span>
                    {col.isToday && <span className="absolute bottom-0 w-2 h-2 rounded-full bg-amber-500" />}
                  </div>
                ))}
              </div>
            </div>

            {project && !selectedReportNo && reportNumbers.length > 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <p className="font-semibold text-slate-500 mb-1">Please select a Report Number above</p>
                <p>Choose a Report from the dropdown to view and manage its tasks.</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No tasks found. Click "Add Task" to create one.</div>
            ) : (
              <div className="relative divide-y divide-slate-100">
                {tasks.map(task => {
                  const isMilestone = task.start.getTime() === task.end.getTime();
                  const cConfig = COLORS[task.color] || COLORS.blue;
                  const taskStartMs = task.start.getTime();
                  const taskEndMs = task.end.getTime();
                  const { startMs: gridStartMs, endMs: gridEndMs } = gridRange;
                  const isVisible = taskEndMs >= gridStartMs && taskStartMs <= gridEndMs;
                  let leftPercent = 0, widthPercent = 0;
                  if (isVisible) {
                    const totalDuration = gridEndMs - gridStartMs;
                    if (isMilestone) {
                      const centerMs = taskStartMs + (viewMode === 'year' ? 15 : 0.5) * 86400000;
                      leftPercent = Math.max(0, Math.min(100, ((centerMs - gridStartMs) / totalDuration) * 100));
                    } else {
                      const visibleStart = Math.max(gridStartMs, taskStartMs);
                      const visibleEnd = Math.min(gridEndMs, taskEndMs + 86400000);
                      leftPercent = ((visibleStart - gridStartMs) / totalDuration) * 100;
                      widthPercent = ((visibleEnd - visibleStart) / totalDuration) * 100;
                    }
                  }

                  return (
                    <div key={task.id} className="flex hover:bg-slate-50/50 transition-colors">
                      <div className="w-[280px] p-4 flex-shrink-0 border-r border-slate-100 flex flex-col justify-center min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span onClick={() => openEditModal(task)} className="text-sm font-bold text-slate-800 truncate hover:text-slate-900 cursor-pointer min-w-0 flex-1">{task.name}</span>
                          <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                            <FileUpload projectId={projectId} stage={step} stepName={task.id} files={project?.files || []} onFilesChange={reloadProject} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{task.category}</span>
                          <span className="text-[10px] text-slate-400">
                            {task.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {!isMilestone && ` - ${task.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 relative flex items-center min-h-[56px]">
                        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timeColumns.length}, minmax(0, 1fr))` }}>
                          {timeColumns.map((col, idx) => (
                            <div key={idx} className={`border-r border-slate-100 h-full ${col.isWeekend ? 'bg-slate-100/20' : ''} ${col.isToday ? 'bg-amber-50/20' : ''}`} />
                          ))}
                        </div>
                        {/* Received date vertical line */}
                        {(() => {
                          const wr = project?.work_request;
                          const rd = wr?.received_date ? new Date(wr.received_date + 'T00:00:00') : null;
                          if (!rd) return null;
                          const { startMs: gS, endMs: gE } = gridRange;
                          const tD = gE - gS;
                          if (tD <= 0) return null;
                          const leftP = Math.max(0, Math.min(100, ((rd.getTime() - gS) / tD) * 100));
                          return <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400/40 pointer-events-none" style={{ left: `${leftP}%` }} />;
                        })()}
                        {/* Due date vertical line */}
                        {(() => {
                          const wr = project?.work_request;
                          const dd = wr?.due_date ? new Date(wr.due_date + 'T00:00:00') : null;
                          if (!dd) return null;
                          const { startMs: gS, endMs: gE } = gridRange;
                          const tD = gE - gS;
                          if (tD <= 0) return null;
                          const leftP = Math.max(0, Math.min(100, ((dd.getTime() - gS) / tD) * 100));
                          return <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/40 pointer-events-none" style={{ left: `${leftP}%` }} />;
                        })()}

                        {isVisible && widthPercent > 0 && (
                          <div className="absolute inset-y-0 flex items-center" style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}>
                            <div
                              className="w-full h-7 rounded-md flex items-center justify-center cursor-pointer select-none shadow-sm transition-all hover:shadow-md"
                              style={{ backgroundColor: cConfig.strong, opacity: 0.8 }}
                              title={`${task.name}: ${task.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${task.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                              onClick={() => openEditModal(task)}
                            >
                              <span className="text-[10px] font-bold text-white truncate px-1">{task.name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>);
      })()}

      {/* ── Legend ── */}
      {categories.length > 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categories:</span>
          {categories.map((cat, idx) => {
            const matchingTask = tasks.find(t => t.category.trim() === cat);
            const colorName = matchingTask?.color || 'blue';
            const cConfig = COLORS[colorName];
            return (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cConfig.dot }} />
                <span className="font-semibold">{cat}</span>
              </div>
            );
          })}
        </div>
      )}



      {/* ── Add / Edit Task Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">{isNewTask ? 'Add New Task' : 'Edit Task'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Task Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Task Name"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 font-[Manrope]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <input type="text" value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g. Planning, Analysis"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 font-[Manrope]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 font-[Manrope]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                  <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 font-[Manrope]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Progress: {formProgress}%</label>
                </div>
                <input type="range" min="0" max="100" value={formProgress} onChange={e => setFormProgress(Number(e.target.value))} className="w-full accent-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Color Theme</label>
                <select value={formColor} onChange={e => setFormColor(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 font-[Manrope] bg-white capitalize">
                  {Object.keys(COLORS).map(colorKey => <option key={colorKey} value={colorKey}>{COLORS[colorKey].name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-end">
              {!isNewTask && (
                <button onClick={handleDeleteTask} className="mr-auto flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSaveTask} className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors">
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
