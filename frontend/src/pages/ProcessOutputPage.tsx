import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Plus, Trash2, Calendar, Clock, Save,
  AlertCircle, ChevronRight, ChevronLeft, ChevronDown, FileText, Edit3, X, Settings,
  ExternalLink, FolderOpen, Copy, Download, Eye, Folder, File as FileIcon,
  RefreshCw, Lock, Unlock, ClipboardList, ListChecks, CheckCircle2, Forward
} from 'lucide-react';
import {
  getProject, getProcess, updateProcessStep, updateProcess, advanceToOutputs,
  createGanttTask, updateGanttTask, deleteGanttTask,
  openFolder, listFolder, getProjectFiles, copyFileToFolder,
  getOutputs, updateOutputs, completeOutputs,
  deleteProject, startProcess, updateProject, getTimeLogs,
  createReportNumber, deleteReportNumber, getReportNumbers, updateReportNumber
} from '../api/client';
import type { Project, ProcessSteps, GanttTask, FileAttachment, Outputs, ReportNumber } from '../types';
import { PROCESS_STEP_LABELS, OUTPUT_STEP_LABELS, WORK_TYPES, STAGE_LABELS } from '../types';
import FileUpload from '../components/FileUpload';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDMY } from '../utils/dateUtils';
import { generatePDFReport } from '../utils/pdfReport';

/* ── Preset task names by work type ── */
const INVESTIGATION_TASKS = [
  'Take photo condition as received',
  'Sound measurement',
  'Lathe swaging',
  'Take photo grease',
  'Washing bearing',
  'Take photo raceway',
  'Roundness',
  'CCD',
  'Measure moisture content in grease',
  'FTIR',
  'Hardness',
  'Make report',
];

const EVALUATION_TASKS = [
  'Gather information',
  'Test schedule',
  'Prototype specifications',
  'Check adapter jig',
  'Design jig',
  'Order jig',
  'Order surrounding parts',
  'Order bearings for testing',
  'Meeting with NBMT',
  'Measure dimensions of bearing',
  'Measure dimensions of surrounding parts',
  'Matching bearing and surrounding parts',
  'Perform test',
  'Investigation after test',
  'Make report',
];

function getPresetTasks(workType: string): string[] {
  const wt = (workType || '').toLowerCase();
  if (wt.includes('investigation')) return INVESTIGATION_TASKS;
  if (wt === 'evaluation') return EVALUATION_TASKS;
  return [];
}

function getCustomTasksKey(workType: string): string {
  return `gantt_custom_tasks_${(workType || 'other').replace(/\s+/g, '_')}`;
}

function loadCustomTasks(workType: string): string[] {
  try {
    const raw = localStorage.getItem(getCustomTasksKey(workType));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomTask(workType: string, taskName: string) {
  const key = getCustomTasksKey(workType);
  const existing = loadCustomTasks(workType);
  if (!existing.includes(taskName)) {
    existing.unshift(taskName);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  }
}

/* ── Date helpers for the Gantt chart (month view) ── */
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getFirstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getDaysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getBarStyle(startStr: string, endStr: string, viewStart: Date, totalSlots: number): { left: string; width: string } | null {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return null;
  const viewEnd = new Date(viewStart);
  if (totalSlots === 7) { // week
    viewEnd.setDate(viewEnd.getDate() + 6);
  } else if (totalSlots === 12) { // year - months
    viewEnd.setFullYear(viewEnd.getFullYear() + 11);
    viewEnd.setMonth(viewEnd.getMonth() + 11);
  } else { // month - days
    viewEnd.setDate(viewEnd.getDate() + totalSlots - 1);
  }
  viewEnd.setHours(23, 59, 59, 999);
  const visStart = start < viewStart ? viewStart : start;
  const visEnd = end > viewEnd ? viewEnd : end;
  if (visStart > viewEnd || visEnd < viewStart) return null;
  const startOffset = daysBetween(viewStart, visStart);
  const visibleDuration = daysBetween(visStart, visEnd) + 1;
  return {
    left: `${(startOffset / totalSlots) * 100}%`,
    width: `${(visibleDuration / totalSlots) * 100}%`,
  };
}

/* ── OutputForm sub-component ── */
function OutputsPanel({ projectId, project, onUpdate }: {
  projectId: number;
  project: Project;
  onUpdate: () => void;
}) {
  const navigate = useNavigate();
  const [outputs, setOutputs] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step7Option, setStep7Option] = useState<'skip' | 'revise' | null>(null);
  const [step7Data, setStep7Data] = useState('');
  const [editMode, setEditMode] = useState<Set<number>>(new Set());

  const fetchOutputs = useCallback(async () => {
    try {
      const resp = await getOutputs(projectId);
      setOutputs(resp.outputs);
      setProgress(resp.progress);
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => { fetchOutputs(); }, [fetchOutputs]);

  useEffect(() => {
    if (outputs?.step7_data) {
      setStep7Data(outputs.step7_data);
      setStep7Option('revise');
    } else if (outputs?.step7_complete) {
      setStep7Option('skip');
    }
  }, [outputs]);

  const handleToggleStep = async (stepNum: number) => {
    if (!outputs) return;
    setSaving(true);
    try {
      const newVal = outputs[`step${stepNum}_complete`] ? false : true;
      await updateOutputs(projectId, { [`step${stepNum}_complete`]: newVal });
      await fetchOutputs();
      onUpdate();
      setEditMode(prev => { const next = new Set(prev); next.delete(stepNum); return next; });
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Complete this project? This will move it to History.')) return;
    setSaving(true);
    try {
      const result = await completeOutputs(projectId);
      setSuccess(result.message);
      onUpdate();
      navigate('/history');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to complete');
    } finally {
      setSaving(false);
    }
  };

  const allRequiredComplete = outputs && [1,2,3,4,5,6].every(i => outputs[`step${i}_complete`]);
  const displayStepNum = (n: number) => n + 5;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Outputs Checklist</h2>
          <p className="text-sm text-gray-500">
            6 required steps (10% of project) • Step 12 optional
          </p>
        </div>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          {progress}% / 10%
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${(progress / 10) * 100}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map(stepNum => {
          const complete = outputs?.[`step${stepNum}_complete`];
          const displayNum = displayStepNum(stepNum);
          const isEditing = editMode.has(stepNum);
          return (
            <div key={stepNum} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {complete ? <Check className="w-4 h-4" /> : displayNum}
                </div>
                <div>
                  <span className={`text-sm ${complete ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                    {OUTPUT_STEP_LABELS[displayNum]}
                  </span>
                  {displayNum === 8 && project.work_type === 'Others' && (
                    <span className="text-xs text-gray-400 ml-2">(Optional for Others type)</span>
                  )}
                </div>
              </div>
              {complete && !isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">Completed</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditMode(prev => { const next = new Set(prev); next.add(stepNum); return next; }); }}
                    className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100 flex-shrink-0"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleToggleStep(stepNum)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    complete
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {complete ? 'Done' : 'Mark Done'}
                </button>
              )}
            </div>
          );
        })}

        {/* Step 12 (Optional) */}
        <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              outputs?.step7_complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {outputs?.step7_complete ? <Check className="w-4 h-4" /> : '12'}
            </div>
            <div>
              <span className="text-sm text-gray-700 font-medium">{OUTPUT_STEP_LABELS[12]}</span>
              <p className="text-[10px] text-gray-400">Choose an option below</p>
            </div>
            {outputs?.step7_complete && !editMode.has(7) && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">Completed</span>
                <button
                  onClick={() => setEditMode(prev => { const next = new Set(prev); next.add(7); return next; })}
                  className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}
            {outputs?.step7_complete && editMode.has(7) && (
              <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">Editing</span>
            )}
          </div>

          {/* Skip */}
          <button
            onClick={async () => {
              setSaving(true);
              setStep7Option('skip');
              try {
                await updateOutputs(projectId, { step7_complete: true, step7_data: '' });
                await fetchOutputs();
                onUpdate();
                setEditMode(prev => { const next = new Set(prev); next.delete(7); return next; });
              } catch (e: any) {
                setError(e.response?.data?.detail || 'Failed');
              } finally { setSaving(false); }
            }}
            disabled={saving || (outputs?.step7_complete && !editMode.has(7))}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              outputs?.step7_complete && !editMode.has(7) ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              step7Option === 'skip' ? 'border-green-400 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              step7Option === 'skip' ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              <Forward className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className={`text-sm font-bold ${step7Option === 'skip' ? 'text-green-800' : 'text-gray-700'}`}>
                Skip — No revision needed
              </span>
              <p className="text-[11px] text-gray-500 mt-0.5">Report is final, no changes required</p>
            </div>
            {step7Option === 'skip' && <Check className="w-5 h-5 text-green-600 flex-shrink-0" />}
          </button>

          {/* Revise */}
          <div className={`rounded-xl border-2 transition-all ${
            outputs?.step7_complete && !editMode.has(7) ? 'opacity-50' : ''
          } ${
            step7Option === 'revise' ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white'
          }`}>
            <button
              onClick={() => { if (!(outputs?.step7_complete && !editMode.has(7))) setStep7Option('revise'); }}
              className="w-full flex items-center gap-3 p-3.5 text-left"
              disabled={outputs?.step7_complete && !editMode.has(7)}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                step7Option === 'revise' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400'
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className={`text-sm font-bold ${step7Option === 'revise' ? 'text-blue-800' : 'text-gray-700'}`}>
                  Revised — Report was revised
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5">Fill in revision details below</p>
              </div>
              {step7Option === 'revise' && <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            </button>
            {step7Option === 'revise' && (
              <div className="px-3.5 pb-4 space-y-3">
                <div className="h-px bg-blue-200/50" />
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Revision reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="input-base w-full h-24 resize-none text-sm"
                    placeholder="Who requested the revision and why?"
                    value={step7Data}
                    onChange={e => setStep7Data(e.target.value)}
                    disabled={outputs?.step7_complete && !editMode.has(7)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      if (!step7Data.trim()) return;
                      setSaving(true);
                      try {
                        await updateOutputs(projectId, { step7_complete: true, step7_data: step7Data.trim() });
                        await fetchOutputs();
                        onUpdate();
                        setEditMode(prev => { const next = new Set(prev); next.delete(7); return next; });
                      } catch (e: any) {
                        setError(e.response?.data?.detail || 'Failed');
                      } finally { setSaving(false); }
                    }}
                    disabled={saving || !step7Data.trim() || (outputs?.step7_complete && !editMode.has(7))}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4" /> {outputs?.step7_complete ? 'Update Revision' : 'Save Revision'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Button */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleComplete}
          disabled={saving || !allRequiredComplete}
          className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          {project.current_stage === 'completed' ? 'Project Completed' : 'Complete Project'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* MAIN PAGE — ProcessOutputPage                                  */
/* ═══════════════════════════════════════════════════════════════ */
export default function ProcessOutputPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [process, setProcess] = useState<ProcessSteps | null>(null);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [stepEditMode, setStepEditMode] = useState<Set<number>>(new Set());
  const [step1Editing, setStep1Editing] = useState(false);
  const [step3HasReport, setStep3HasReport] = useState(true);
  const [monthStart, setMonthStart] = useState(getFirstOfMonth(new Date()));
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editPlannedStart, setEditPlannedStart] = useState('');
  const [editPlannedEnd, setEditPlannedEnd] = useState('');
  const [taskColWidth, setTaskColWidth] = useState(() => {
    const saved = localStorage.getItem('gantt_task_col_width');
    return saved ? parseInt(saved) : 240;
  });
  const resizeRef = useRef<HTMLDivElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<string | null>(null);
  const outputsRef = useRef<HTMLDivElement>(null);
  const prevCanAccessOutputs = useRef(false);
  const [ganttView, setGanttView] = useState<'week' | 'month' | 'year'>('month');
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  // Step form data
  const [step1Data, setStep1Data] = useState('');
  const [step1TicketNo, setStep1TicketNo] = useState('');
  const [step1Source, setStep1Source] = useState<'comets' | 'email' | 'self'>('comets');
  const [step2Data, setStep2Data] = useState('');
  const [step3Data, setStep3Data] = useState('');
  const [step3Reports, setStep3Reports] = useState<ReportNumber[]>([]);
  const [newReportNum, setNewReportNum] = useState('');
  const [newReportDesc, setNewReportDesc] = useState('');
  const [step5Data, setStep5Data] = useState('');

  // New gantt task form
  const [newTask, setNewTask] = useState({ name: '', planned_start: '', planned_end: '', color: 'blue' });
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Step 5 state
  const [folderPath, setFolderPath] = useState('');
  const [folderItems, setFolderItems] = useState<Array<{ name: string; path: string; is_dir: boolean; size: number; modified: number }>>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [allProjectFiles, setAllProjectFiles] = useState<FileAttachment[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [copyTargetFolder, setCopyTargetFolder] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState('');
  const [currentFolderPath, setCurrentFolderPath] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const workType = project?.work_type || '';
  const taskSuggestions = useMemo(() => {
    const presets = getPresetTasks(workType);
    const customs = loadCustomTasks(workType).filter(t => !presets.includes(t));
    return [...presets, ...customs];
  }, [workType]);

  const filteredSuggestions = useMemo(() => {
    if (!newTask.name.trim()) return taskSuggestions;
    const q = newTask.name.toLowerCase();
    return taskSuggestions.filter(t => t.toLowerCase().includes(q));
  }, [newTask.name, taskSuggestions]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = taskColWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(140, Math.min(500, startWidth + (ev.clientX - startX)));
      setTaskColWidth(newWidth);
      const grids = document.querySelectorAll('.gantt-grid');
      grids.forEach(el => { (el as HTMLElement).style.gridTemplateColumns = `${newWidth}px repeat(7,1fr)`; });
    };
    const onMouseUp = () => {
      isResizing.current = false;
      localStorage.setItem('gantt_task_col_width', String(Math.max(140, Math.min(500, taskColWidth))));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [taskColWidth]);

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const viewDays = useMemo(() => {
    const days: Date[] = [];
    if (ganttView === 'month') {
      const total = getDaysInMonth(monthStart);
      for (let i = 0; i < total; i++) days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
    } else if (ganttView === 'week') {
      const monday = getMonday(monthStart);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
    } else { // year
      for (let m = 0; m < 12; m++) days.push(new Date(monthStart.getFullYear(), m, 1));
    }
    return days;
  }, [monthStart, ganttView]);

  // Time log hours by date for Gantt
  const logHoursByDate = useMemo(() => {
    const map: Record<string, number> = {};
    timeLogs.forEach((log: any) => {
      map[log.entry_date] = (map[log.entry_date] || 0) + log.hours;
    });
    return map;
  }, [timeLogs]);

  // Time log hours grouped by task_id
  const taskHours = useMemo(() => {
    const map: Record<number, number> = {};
    timeLogs.forEach((log: any) => {
      const tid = parseInt(log.task_id);
      if (tid > 0) map[tid] = (map[tid] || 0) + log.hours;
    });
    return map;
  }, [timeLogs]);

  // Total project hours across all tasks
  const totalProjectHours = useMemo(() => {
    return timeLogs.reduce((sum: number, log: any) => sum + log.hours, 0);
  }, [timeLogs]);

  // Time log hours grouped by task_id then by date
  const taskHoursByDate = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    timeLogs.forEach((log: any) => {
      const tid = parseInt(log.task_id);
      if (tid <= 0) return;
      if (!map[tid]) map[tid] = {};
      map[tid][log.entry_date] = (map[tid][log.entry_date] || 0) + log.hours;
    });
    return map;
  }, [timeLogs]);

  const fetchData = useCallback(async () => {
    try {
      const [proj, proc, logs] = await Promise.all([
        getProject(projectId),
        getProcess(projectId),
        getTimeLogs({ project_id: projectId })
      ]);
      setProject(proj);
      setProcess(proc.process);
      setGanttTasks(proc.gantt_tasks);
      setTimeLogs(logs);
      setStep1Data(proc.process.step1_data || '');
      // Extract ticket no from saved data (format: sourceType|||TICKET_NO|||rest)
      const raw1 = proc.process.step1_data || '';
      if (raw1.startsWith('comets')) {
        const parts = raw1.split('|||');
        if (parts.length >= 3) {
          setStep1TicketNo(parts[1] || '');
        }
      }
      setStep2Data(proc.process.step2_data || '');
      setStep3Data(proc.process.step3_data || '');
      setStep5Data(proc.process.step5_data || '');
      // Load report numbers
      try {
        const rns = await getReportNumbers(projectId);
        setStep3Reports(rns);
      } catch { setStep3Reports([]); }
    } catch (e) {
      console.error(e);
      setError('Failed to load process data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (datePickerTarget && datePickerRef.current) {
      datePickerRef.current.value = '';
      datePickerRef.current.showPicker();
    }
  }, [datePickerTarget]);

  const canAccessOutputs = project?.current_stage === 'outputs' || project?.current_stage === 'completed';

  // Auto-scroll to Outputs when unlocked
  useEffect(() => {
    if (canAccessOutputs && !prevCanAccessOutputs.current && outputsRef.current) {
      setTimeout(() => outputsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
    prevCanAccessOutputs.current = canAccessOutputs;
  }, [canAccessOutputs]);

  const handleSaveStep = async (stepNum: number, data: string, complete: boolean) => {
    setSaving(true);
    try {
      await updateProcessStep(projectId, stepNum, { data, complete });
      const [proj, proc] = await Promise.all([
        getProject(projectId),
        getProcess(projectId)
      ]);
      setProject(proj);
      setProcess(proc.process);
      setGanttTasks(proc.gantt_tasks);
      setStep1Data(proc.process.step1_data || '');
      // Extract ticket no from saved data
      const raw1 = proc.process.step1_data || '';
      if (raw1.startsWith('comets')) {
        const parts = raw1.split('|||');
        if (parts.length >= 3) setStep1TicketNo(parts[1] || '');
      }
      setStep2Data(proc.process.step2_data || '');
      setStep3Data(proc.process.step3_data || '');
      setStep5Data(proc.process.step5_data || '');
      // remove from edit mode after saving
      setStepEditMode(prev => { const next = new Set(prev); next.delete(stepNum); return next; });
      // auto-collapse accordion after save (except Step 4 which is always visible)
      setExpandedSteps(prev => { const next = new Set(prev); next.delete(stepNum); return next; });
      // Auto-advance to outputs if all steps 1-5 are now complete
      if (proc.process.step1_complete && proc.process.step2_complete && proc.process.step3_complete &&
          proc.process.step4_complete && proc.process.step5_complete && proj.current_stage === 'process') {
        try {
          await advanceToOutputs(projectId);
          const [proj2, proc2] = await Promise.all([getProject(projectId), getProcess(projectId)]);
          setProject(proj2);
          setProcess(proc2.process);
          setGanttTasks(proc2.gantt_tasks);
        } catch (e: any) {
          setError(e.response?.data?.detail || 'Cannot advance to Outputs yet');
        }
      }
    } catch (e) {
      console.error(e);
      setError('Failed to save step');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.name.trim()) return;
    try {
      await createGanttTask(projectId, newTask);
      const presets = getPresetTasks(project?.work_type || '');
      if (!presets.includes(newTask.name.trim())) {
        saveCustomTask(project?.work_type || '', newTask.name.trim());
      }
      setNewTask({ name: '', planned_start: '', planned_end: '', color: 'blue' });
      await fetchData();
    } catch (e) {
      console.error(e);
      setError('Failed to add task');
    }
  };

  const handleEditTaskDates = (task: GanttTask) => {
    setEditingTaskId(task.id);
    setEditPlannedStart(task.planned_start);
    setEditPlannedEnd(task.planned_end);
  };

  const handleSaveTaskDates = async () => {
    if (editingTaskId === null) return;
    try {
      await updateGanttTask(projectId, editingTaskId, {
        planned_start: editPlannedStart,
        planned_end: editPlannedEnd
      });
      setEditingTaskId(null);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await deleteGanttTask(projectId, taskId);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTaskProgress = async (task: GanttTask, progress: number) => {
    try {
      await updateGanttTask(projectId, task.id, { progress });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdvanceToOutputs = async () => {
    try {
      const incompleteTasks = ganttTasks.filter(t => t.progress < 100);
      if (incompleteTasks.length > 0) {
        setError(`Cannot advance: ${incompleteTasks.length} task(s) still in progress.`);
        return;
      }
      if (!process?.folder_path && !folderPath.trim()) {
        setError('Cannot advance: Please set the Server Folder Path first');
        return;
      }
      await advanceToOutputs(projectId);
      navigate(`/project/${projectId}`);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to advance');
    }
  };

  const getStepStatus = (stepNum: number) => {
    if (!process) return 'pending';
    return process[`step${stepNum}_complete` as keyof ProcessSteps] ? 'completed' : 'pending';
  };

  const allStepsComplete = process &&
    process.step1_complete && process.step2_complete && process.step3_complete &&
    process.step4_complete && process.step5_complete;

  // Auto-advance to outputs when all steps complete
  useEffect(() => {
    if (allStepsComplete && project?.current_stage === 'process') {
      const doAdvance = async () => {
        try {
          await advanceToOutputs(projectId);
          await fetchData();
        } catch (e) {
          // silent fail
        }
      };
      doAdvance();
    }
  }, [allStepsComplete, project?.current_stage]);

  const calcProgress = useMemo(() => {
    const s13 = project?.current_stage === 'completed' ? 10 : (process ? ([1,2,3].filter(s => getStepStatus(s) === 'completed').length / 3) * 10 : 0);
    const s4 = project?.current_stage === 'completed' ? 79 : (ganttTasks.length > 0 ? (ganttTasks.filter(t => t.progress >= 100).length / ganttTasks.length) * 79 : 0);
    const s5 = project?.current_stage === 'completed' ? 1 : (process?.step5_complete ? 1 : 0);
    const out = project?.current_stage === 'completed' ? 10 : (() => {
      const o = project?.outputs;
      if (!o) return 0;
      const done = [1,2,3,4,5,6].filter(i => o[`step${i}_complete` as keyof typeof o]).length;
      return (done / 6) * 10;
    })();
    return Math.round(s13 + s4 + s5 + out);
  }, [project, process, ganttTasks]);

  const handleStartProcess = async () => {
    try {
      await startProcess(projectId);
      await fetchData();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to start process');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(projectId);
      navigate('/projects');
    } catch (e) {
      setError('Failed to delete project');
    }
  };

  const handleSaveTitle = async () => {
    try {
      await updateProject(projectId, { title: editTitle });
      setEditingTitle(false);
      await fetchData();
    } catch (e) {
      setError('Failed to update title');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!project || !process) return <div className="p-8 text-center text-red-500">Project not found</div>;

  // ── Project Summary Page ──
  if (showSummary) {
    return (
      <div className="p-1 lg:p-3 space-y-2 lg:space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <button onClick={() => setShowSummary(false)} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Project
          </button>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => generatePDFReport(project, process, ganttTasks, taskHours, totalProjectHours, step1TicketNo)} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden print-area">
          <div className="p-6 space-y-6">
            {/* Print header with title and date */}
            <div className="print-header">
              <span className="title">Project Summary</span>
              <span className="date">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 no-print">Project Summary</h1>

            {/* 1. Project Details */}
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">1. Project Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Title</span><p className="font-semibold text-gray-800 mt-0.5">{project?.title || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Work Type</span><p className="font-semibold text-gray-800 mt-0.5">{project?.work_type || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Requester</span><p className="font-semibold text-gray-800 mt-0.5">{project?.requester || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Customer</span><p className="font-semibold text-gray-800 mt-0.5">{project?.customer_name || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Bearing No.</span><p className="font-semibold text-gray-800 mt-0.5">{project?.bearing_no || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Received Date</span><p className="font-semibold text-gray-800 mt-0.5">{formatDMY(project?.received_date) || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Due Date</span><p className="font-semibold text-gray-800 mt-0.5">{formatDMY(project?.due_date) || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Status</span><p className="font-semibold mt-0.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${project?.current_stage === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{STAGE_LABELS[project?.current_stage] || '-'}</span></p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Completed At</span><p className="font-semibold text-gray-800 mt-0.5">{formatDMY(project?.completed_at) || '-'}</p></div>
              </div>
              {project?.notes && <div className="mt-3 pt-3 border-t border-gray-100"><span className="text-gray-400 text-[10px] uppercase tracking-wider">Notes</span><p className="text-sm text-gray-600 mt-0.5">{project.notes}</p></div>}
            </div>

            {/* 2. Ticket & Report No. */}
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">2. Ticket &amp; Report No.</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Ticket No.</span><p className="font-semibold text-gray-800 mt-0.5">{step1TicketNo || '-'}</p></div>
                <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Report No.</span><p className="font-semibold text-gray-800 mt-0.5">{process?.report_number || project?.outputs?.report_no || '-'}</p></div>
              </div>
            </div>

            {/* 3. Tasks & Hours */}
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">3. Tasks &amp; Working Hours</h3>
              {ganttTasks.length > 0 ? (
                <div className="space-y-2">
                  {ganttTasks.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-700">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {t.planned_start && <span className="text-gray-400">{formatDMY(t.planned_start)}–{formatDMY(t.planned_end)}</span>}
                        <span className="font-bold text-green-700">{taskHours[t.id] ? taskHours[t.id].toFixed(1) : '0.0'}h</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t-2 border-gray-200">
                    <span className="text-sm font-bold text-gray-800">Total</span>
                    <span className="text-sm font-bold text-green-700">{totalProjectHours.toFixed(1)}h</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No tasks</p>
              )}
            </div>

            {/* 4. Server Folder & Final Review */}
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">4. Server Folder &amp; Final Review</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider">Server Folder</span>
                  {process?.folder_path ? (
                    <div className="mt-1">
                      <button onClick={() => openFolder(process?.folder_path || '')}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium text-sm">
                        <ExternalLink className="w-3.5 h-3.5" />
                        {process.folder_path}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-0.5">-</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider">Final Review Notes</span>
                  <p className="text-sm text-gray-700 mt-0.5">{process?.step5_data || '-'}</p>
                </div>
              </div>
            </div>

            {/* 5. Outputs Summary */}
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">5. Outputs Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Report Approved</span><p className="font-semibold text-gray-800 mt-0.5">{project?.outputs?.report_approved ? (formatDMY(project?.outputs?.submission_date) || 'Yes') : '-'}</p></div>
                  <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">COMETS Submitted</span><p className="font-semibold text-gray-800 mt-0.5">{project?.outputs?.comets_submitted ? (formatDMY(project?.outputs?.submission_date) || 'Yes') : '-'}</p></div>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider">Revised — Report was revised</span>
                  <p className="font-semibold mt-0.5">
                    {project?.outputs?.step7_data ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-bold">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Yes — {project.outputs.step7_data}
                      </span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Determine which stages are accessible ──

  return (
    <div className="p-1 lg:p-3 space-y-2 lg:space-y-3">
      {/* Hidden date picker */}
      <input
        type="date"
        ref={datePickerRef}
        className="fixed"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 99999, opacity: 0.01, pointerEvents: 'none', width: '200px', height: '30px' }}
        onChange={e => {
          if (!e.target.value || !datePickerTarget) return;
          const val = e.target.value;
          if (datePickerTarget.startsWith('new_start')) setNewTask(p => ({ ...p, planned_start: val }));
          else if (datePickerTarget.startsWith('new_end')) setNewTask(p => ({ ...p, planned_end: val }));
          else if (datePickerTarget.startsWith('edit_start')) setEditPlannedStart(val);
          else if (datePickerTarget.startsWith('edit_end')) setEditPlannedEnd(val);
          setDatePickerTarget(null);
        }}
      />

      {/* ═══════ HEADER ═══════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary p-1 rounded-lg flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input className="input-base text-base font-bold py-1" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus />
                  <button onClick={handleSaveTitle} className="btn-primary text-xs px-3 py-1">Save</button>
                  <button onClick={() => setEditingTitle(false)} className="btn-secondary text-xs px-3 py-1">Cancel</button>
                </div>
              ) : (
                <>
                  <h1 className="text-lg font-bold text-gray-900 truncate">{project.title}</h1>
                  <button onClick={() => { setEditTitle(project.title); setEditingTitle(true); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate leading-tight">{project.work_type} • {project.customer_name} • {project.bearing_no}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {project.current_stage === 'work_request' && project.requester && project.customer_name && project.work_type && project.bearing_no && project.due_date && (
            <button onClick={handleStartProcess} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
              Start Process <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {project.current_stage !== 'work_request' && (
            <button onClick={() => navigate('/projects')} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
              <Settings className="w-3.5 h-3.5" /> Dashboard
            </button>
          )}
          <button onClick={() => setShowSummary(true)} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
            <FileText className="w-3.5 h-3.5" /> Project Summary
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-secondary p-1.5 text-red-500 hover:bg-red-50" title="Delete project">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* ═══════ PROGRESS BAR ═══════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Overall Progress</h3>
          <span className="text-sm font-bold text-blue-600">{calcProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 flex overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 10 : (process ? ([1,2,3].filter(s => getStepStatus(s) === 'completed').length / 3) * 10 : 0)}%` }} />
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 79 : (ganttTasks.length > 0 ? (ganttTasks.filter(t => t.progress >= 100).length / ganttTasks.length) * 79 : 0)}%` }} />
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 1 : (process?.step5_complete ? 1 : 0)}%` }} />
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 10 : (() => { const o = project?.outputs; if (!o) return 0; const done = [1,2,3,4,5,6].filter(i => o[`step${i}_complete` as keyof typeof o]).length; return (done / 6) * 10; })()}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-blue-500" /> Steps 1-3</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-teal-500" /> Gantt Tasks</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-400" /> Final Review</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-purple-500" /> Outputs</span>
        </div>
      </div>

      {/* ═══════ PROJECT DETAILS ═══════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" /> Project Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Requester</label>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.requester || '-'}</p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Customer</label>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.customer_name || '-'}</p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Work Type</label>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.work_type || '-'}</p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Bearing No.</label>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.bearing_no || '-'}</p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Received</label>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.received_date || '-'}</p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Due Date</label>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.due_date || '-'}</p>
          </div>
        </div>
        {project?.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Notes</label>
            <p className="text-sm text-gray-600 mt-0.5">{project.notes}</p>
          </div>
        )}
      </div>

      {/* ═══════ TAB SWITCHER ═══════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* No more tabs - Process Steps and Outputs shown together */}
        <div className="p-5">
            <div className="space-y-5">
              {/* Process Steps Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Process Steps</h2>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        getStepStatus(s) === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {getStepStatus(s) === 'completed' ? '✓' : s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 1 */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-5">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      const next = new Set(expandedSteps);
                      if (next.has(1)) next.delete(1); else next.add(1);
                      setExpandedSteps(next);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      getStepStatus(1) === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getStepStatus(1) === 'completed' ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{PROCESS_STEP_LABELS[1].label}</h3>
                      <p className="text-xs text-gray-500 truncate">{PROCESS_STEP_LABELS[1].description}</p>
                    </div>
                    {getStepStatus(1) === 'completed' && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 flex-shrink-0">Completed</span>
                    )}
                    {getStepStatus(1) === 'completed' && !stepEditMode.has(1) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); const next = new Set(stepEditMode); next.add(1); setStepEditMode(next); }}
                        className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100 flex-shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${(!(getStepStatus(1) === 'completed') || expandedSteps.has(1)) ? '' : '-rotate-90'}`} />
                  </div>
                  {(!(getStepStatus(1) === 'completed') || expandedSteps.has(1)) && (
                  <div className="relative">
                    {(getStepStatus(1) === 'completed' && !stepEditMode.has(1)) && (
                      <div className="absolute inset-0 z-10 rounded-b-xl cursor-default" />
                    )}
                  <div className={`px-4 pt-4 pb-4 space-y-5 ${getStepStatus(1) === 'completed' && !stepEditMode.has(1) ? 'pointer-events-none opacity-60 select-none' : ''}`}>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-gray-700 block">Order Source</label>

                      {/* COMETS */}
                      <div className={`border rounded-xl p-4 transition-all ${step1Source === 'comets' ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="radio" name="step1Source" className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                            checked={step1Source === 'comets'} onChange={() => setStep1Source('comets')} />
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-800">COMETS (NSK order system)</span>
                            <p className="text-xs text-gray-500 mt-0.5">Order received via COMETS system</p>
                          </div>
                        </label>
                        {step1Source === 'comets' && (
                          <div className="mt-3 pl-7">
                            {process.step1_complete && step1Data.trim() && !step1Editing ? (
                              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">COMETS link saved</p>
                                  <p className="text-xs text-gray-400 truncate">{step1Data.trim()}</p>
                                  {step1TicketNo && <p className="text-xs text-blue-600 font-medium mt-1">Ticket: {step1TicketNo}</p>}
                                </div>
                                <a href={step1Data.trim()} target="_blank" rel="noopener noreferrer"
                                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap">
                                  <ExternalLink className="w-3.5 h-3.5" /> Open
                                </a>
                                <button onClick={() => setStep1Editing(true)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-600 mb-1 block">COMETS Link</label>
                                  <div className="flex items-center gap-2">
                                    <input type="url" className="input-base w-full text-sm"
                                      placeholder="https://comets.nsk.com/order/..."
                                      value={step1Data} onChange={e => setStep1Data(e.target.value)} />
                                    {step1Data.trim() && (
                                      <a href={step1Data.trim()} target="_blank" rel="noopener noreferrer"
                                        className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs whitespace-nowrap">
                                        <ExternalLink className="w-3 h-3" /> Test</a>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ticket No. <span className="text-gray-400">(e.g., CZT-26xxxx)</span></label>
                                  <input type="text" className="input-base w-full text-sm"
                                    placeholder="CZT-26xxxx"
                                    value={step1TicketNo} onChange={e => setStep1TicketNo(e.target.value)} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Email */}
                      <div className={`border rounded-xl p-4 transition-all ${step1Source === 'email' ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="radio" name="step1Source" className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                            checked={step1Source === 'email'} onChange={() => setStep1Source('email')} />
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-800">Received via Email</span>
                            <p className="text-xs text-gray-500 mt-0.5">Order sent via email with attached file</p>
                          </div>
                        </label>
                        {step1Source === 'email' && (
                          <div className="mt-3 pl-7">
                            <p className="text-xs text-gray-500 mb-2">Attach the email or order file: <span className="text-red-500 font-medium">*Required</span></p>
                            <FileUpload projectId={projectId} stage="process" stepName="step1_email"
                              files={project?.files?.filter(f => f.stage === 'process' && f.step_name === 'step1_email') || []}
                              onFilesChange={fetchData} />
                          </div>
                        )}
                      </div>

                      {/* Self-initiated */}
                      <div className={`border rounded-xl p-4 transition-all ${step1Source === 'self' ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="radio" name="step1Source" className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                            checked={step1Source === 'self'} onChange={() => setStep1Source('self')} />
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-800">Self-Initiated</span>
                            <p className="text-xs text-gray-500 mt-0.5">No order received, we want to do this work</p>
                          </div>
                        </label>
                        {step1Source === 'self' && (
                          <div className="mt-3 pl-7 space-y-3">
                            <textarea className="input-base w-full h-20 resize-none text-sm"
                              placeholder="Explain why this work is needed..."
                              value={step1Data} onChange={e => setStep1Data(e.target.value)} />
                            <FileUpload projectId={projectId} stage="process" stepName="step1_self"
                              files={project?.files?.filter(f => f.stage === 'process' && f.step_name === 'step1_self') || []}
                              onFilesChange={fetchData} />
                          </div>
                        )}
                      </div>
                    </div>

                    {successMsg && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700">
                        <Check className="w-4 h-4" /> {successMsg}
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={async () => {
                          const ticketPart = step1TicketNo ? `|||${step1TicketNo}|||` : '|||';
                          const dataToSave = `${step1Source}${ticketPart}${step1Data}`;
                          await handleSaveStep(1, dataToSave, true);
                          setStep1Editing(false);
                          setSuccessMsg('Saved and completed!');
                          setTimeout(() => setSuccessMsg(''), 3000);
                        }}
                        disabled={saving || (step1Source === 'comets' && (!step1Data.trim() || !step1TicketNo.trim())) || (step1Source === 'email' && (!project?.files?.filter(f => f.stage === 'process' && f.step_name === 'step1_email').length))}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" /> {process.step1_complete ? 'Update & Complete' : 'Save & Complete'}
                      </button>
                    </div>
                  </div>
                </div>
                )}
                </div>

                {/* Step 2 */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-5">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      const next = new Set(expandedSteps);
                      if (next.has(2)) next.delete(2); else next.add(2);
                      setExpandedSteps(next);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      getStepStatus(2) === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getStepStatus(2) === 'completed' ? <Check className="w-4 h-4" /> : '2'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{PROCESS_STEP_LABELS[2].label}</h3>
                      <p className="text-xs text-gray-500 truncate">{PROCESS_STEP_LABELS[2].description}</p>
                    </div>
                    {getStepStatus(2) === 'completed' && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 flex-shrink-0">Completed</span>
                    )}
                    {getStepStatus(2) === 'completed' && !stepEditMode.has(2) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); const next = new Set(stepEditMode); next.add(2); setStepEditMode(next); }}
                        className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100 flex-shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${(!(getStepStatus(2) === 'completed') || expandedSteps.has(2)) ? '' : '-rotate-90'}`} />
                  </div>
                  {(!(getStepStatus(2) === 'completed') || expandedSteps.has(2)) && (
                  <div className="relative">
                    {(getStepStatus(2) === 'completed' && !stepEditMode.has(2)) && (
                      <div className="absolute inset-0 z-10 rounded-b-xl cursor-default" />
                    )}
                  <div className={`px-4 pt-4 pb-4 space-y-5 ${getStepStatus(2) === 'completed' && !stepEditMode.has(2) ? 'pointer-events-none opacity-60 select-none' : ''}`}>
                    {(() => {
                      const colonIdx = step1Data.indexOf(':');
                      const rawPrefix = colonIdx >= 0 ? step1Data.substring(0, colonIdx) : '';
                      const actualData = colonIdx >= 0 ? step1Data.substring(colonIdx + 1) : step1Data;
                      let sourceType: 'comets' | 'email' | 'self' | 'none' = 'none';
                      if (rawPrefix === 'comets' || (rawPrefix === '' && step1Data.trim().startsWith('http'))) sourceType = 'comets';
                      else if (rawPrefix === 'email') sourceType = 'email';
                      else if (rawPrefix === 'self') sourceType = 'self';
                      else if (step1Data.trim()) sourceType = 'comets';
                      if (sourceType === 'none') {
                        return (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />No order source found. Please complete Step 1 first.
                          </div>
                        );
                      }
                      const config = {
                        comets: { bg: 'bg-blue-50 border-blue-100', icon: ExternalLink, color: 'text-blue-600', title: 'COMETS Order' },
                        email: { bg: 'bg-purple-50 border-purple-100', icon: FileText, color: 'text-purple-600', title: 'Email Order' },
                        self: { bg: 'bg-green-50 border-green-100', icon: AlertCircle, color: 'text-green-600', title: 'Self-Initiated' },
                      };
                      const cfg = config[sourceType];
                      const Icon = cfg.icon;
                      return (
                        <div className={`rounded-xl p-4 ${cfg.bg}`}>
                          <div className="flex items-start gap-3">
                            <Icon className={`w-5 h-5 ${cfg.color} flex-shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold mb-1">{cfg.title} <span className="text-gray-400 font-normal">(from Step 1)</span></p>
                              {sourceType === 'comets' && actualData.trim() ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500 truncate">{actualData.trim()}</span>
                                  <a href={actualData.trim()} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap flex-shrink-0 transition-colors">
                                    <ExternalLink className="w-3 h-3" /> Open</a>
                                </div>
                              ) : sourceType === 'email' ? (
                                <p className="text-xs text-gray-500 mt-1">Order received via email with attachments</p>
                              ) : (
                                <p className="text-xs text-gray-500 mt-1">{actualData.trim() || 'Self-initiated work'}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" className="mt-0.5 w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={!!process.step2_complete}
                          onChange={async e => {
                            await handleSaveStep(2, step2Data, e.target.checked);
                            setSuccessMsg(e.target.checked ? 'Order confirmed!' : 'Confirmation removed');
                            setTimeout(() => setSuccessMsg(''), 3000);
                          }} />
                        <div>
                          <span className="text-sm font-semibold text-gray-800">
                            {(() => {
                              const colonIdx = step1Data.indexOf(':');
                              const rawPrefix = colonIdx >= 0 ? step1Data.substring(0, colonIdx) : '';
                              if (rawPrefix === 'comets' || (!rawPrefix && step1Data.trim().startsWith('http'))) return 'I have reviewed the COMETS order';
                              if (rawPrefix === 'email') return 'I have reviewed the email order';
                              if (rawPrefix === 'self') return 'I have confirmed the work reason';
                              return 'I have reviewed the order details';
                            })()}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">Check this box to confirm you have verified the order details</p>
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Comment <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea className="input-base w-full h-24 resize-none" placeholder="Any notes about the order confirmation..."
                        value={step2Data} onChange={e => setStep2Data(e.target.value)} />
                    </div>

                    {successMsg && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700">
                        <Check className="w-4 h-4" /> {successMsg}
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={async () => { await handleSaveStep(2, step2Data, !!process.step2_complete); setSuccessMsg('Saved!'); setTimeout(() => setSuccessMsg(''), 3000); }}
                        disabled={saving} className="btn-primary flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Comment
                      </button>
                    </div>
                  </div>
                </div>
                )}
                </div>

                {/* Step 3 */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-5">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      const next = new Set(expandedSteps);
                      if (next.has(3)) next.delete(3); else next.add(3);
                      setExpandedSteps(next);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      getStepStatus(3) === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getStepStatus(3) === 'completed' ? <Check className="w-4 h-4" /> : '3'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{PROCESS_STEP_LABELS[3].label}</h3>
                      <p className="text-xs text-gray-500 truncate">{PROCESS_STEP_LABELS[3].description}</p>
                    </div>
                    {getStepStatus(3) === 'completed' && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 flex-shrink-0">Completed</span>
                    )}
                    {getStepStatus(3) === 'completed' && !stepEditMode.has(3) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); const next = new Set(stepEditMode); next.add(3); setStepEditMode(next); }}
                        className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100 flex-shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${(!(getStepStatus(3) === 'completed') || expandedSteps.has(3)) ? '' : '-rotate-90'}`} />
                  </div>
                  {(!(getStepStatus(3) === 'completed') || expandedSteps.has(3)) && (
                  <div className="relative">
                    {(getStepStatus(3) === 'completed' && !stepEditMode.has(3)) && (
                      <div className="absolute inset-0 z-10 rounded-b-xl cursor-default" />
                    )}
                  <div className={`px-4 pt-4 pb-4 space-y-5 ${getStepStatus(3) === 'completed' && !stepEditMode.has(3) ? 'pointer-events-none opacity-60 select-none' : ''}`}>
                    <div className="space-y-3">
                      <div className={`border rounded-xl p-4 transition-all ${step3HasReport ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="radio" name="step3Option" className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                            checked={step3HasReport} onChange={() => { setStep3HasReport(true); }} />
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-800">Has Report Number</span>
                            <p className="text-xs text-gray-500 mt-0.5">Enter one or more APTX report numbers</p>
                          </div>
                        </label>
                        {step3HasReport && (
                          <div className="mt-3 pl-7 space-y-3">
                            {/* Existing reports list */}
                            {step3Reports.length > 0 && (
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Saved Reports</label>
                                {step3Reports.map(rn => (
                                  <div key={rn.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
                                    <span className="text-base font-mono font-bold text-gray-800 flex-1 tracking-wider">{rn.report_number}</span>
                                    {rn.item_description && (
                                      <span className="text-sm text-gray-500">{rn.item_description}</span>
                                    )}
                                    <button
                                      onClick={async () => {
                                        try {
                                          await deleteReportNumber(projectId, rn.id);
                                          const rns = await getReportNumbers(projectId);
                                          setStep3Reports(rns);
                                        } catch (e) { console.error(e); }
                                      }}
                                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add new report form */}
                            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                <input
                                  className="input-base flex-1 text-base tracking-widest font-mono uppercase min-w-0"
                                  placeholder="APTX26145" value={newReportNum}
                                  onChange={e => { const val = e.target.value.toUpperCase().replace(/[^APTX0-9]/g, ''); setNewReportNum(val); }}
                                  maxLength={10}
                                />
                                <input
                                  className="input-base flex-[2] text-sm"
                                  placeholder="Description (optional)"
                                  value={newReportDesc}
                                  onChange={e => setNewReportDesc(e.target.value)}
                                />
                                <button
                                  disabled={!/^APTX\d{5}$/.test(newReportNum.trim())}
                                  onClick={async () => {
                                    try {
                                      await createReportNumber(projectId, {
                                        report_number: newReportNum.trim(),
                                        item_description: newReportDesc.trim(),
                                      });
                                      setNewReportNum('');
                                      setNewReportDesc('');
                                      const rns = await getReportNumbers(projectId);
                                      setStep3Reports(rns);
                                    } catch (e) { console.error(e); }
                                  }}
                                  className="btn-primary flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add
                                </button>
                              </div>
                              {newReportNum.trim() && !/^APTX\d{5}$/.test(newReportNum.trim()) && (
                                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                  <span>Must be <strong>APTX</strong> + <strong>2-digit year</strong> + <strong>3-digit number</strong></span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={`border rounded-xl p-4 transition-all ${!step3HasReport ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="radio" name="step3Option" className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                            checked={!step3HasReport} onChange={() => { setStep3HasReport(false); }} />
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-800">No Report</span>
                            <p className="text-xs text-gray-500 mt-0.5">Skip this step — no report number needed</p>
                          </div>
                        </label>
                        {!step3HasReport && (
                          <div className="mt-3 pl-7">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-xs text-green-700">
                              <Check className="w-3.5 h-3.5 flex-shrink-0" /> Will use "No report"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {successMsg && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700">
                        <Check className="w-4 h-4" /> {successMsg}
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={async () => {
                          const data = step3HasReport
                            ? step3Reports.map(r => r.report_number).join(', ')
                            : 'No report';
                          await handleSaveStep(3, data, true);
                          setSuccessMsg('Report number saved!');
                          setTimeout(() => setSuccessMsg(''), 3000);
                        }}
                        disabled={saving || (step3HasReport && step3Reports.length === 0)}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" /> {process.step3_complete ? 'Update & Complete' : 'Save & Complete'}
                      </button>
                    </div>
                  </div>
                </div>
                )}
                </div>

                {/* Step 4 - Gantt Chart */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-5">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{PROCESS_STEP_LABELS[4].label}</h3>
                      <p className="text-xs text-gray-500">{PROCESS_STEP_LABELS[4].description}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex justify-start">
                      <button onClick={() => setShowTaskPopup(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 shadow-sm">
                        <Plus className="w-4 h-4" /> Add New Task
                      </button>
                    </div>

                    {/* Add Task Popup */}
                    {showTaskPopup && (
                      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-8" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Add New Task</h3>
                            <button onClick={() => { setShowTaskPopup(false); setNewTask({ name: '', planned_start: '', planned_end: '', color: 'blue' }); }}
                              className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                          </div>
                          <div className="space-y-5">
                            <div className="relative" style={{ minHeight: '60px' }}>
                              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Task Name</label>
                              <div className="relative">
                                <input ref={taskInputRef} className="input-base w-full text-base py-3 pr-10"
                                  placeholder="Type or select task..." value={newTask.name}
                                  onChange={e => { setNewTask({ ...newTask, name: e.target.value }); setShowAllSuggestions(false); if (e.target.value.trim()) setShowTaskDropdown(true); }}
                                  onFocus={() => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); if (newTask.name.trim()) setShowTaskDropdown(true); }}
                                  onBlur={() => { blurTimeoutRef.current = setTimeout(() => setShowTaskDropdown(false), 200); }} autoFocus />
                                <button type="button"
                                  onMouseDown={e => { e.preventDefault(); if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); }}
                                  onClick={() => { setShowAllSuggestions(true); setShowTaskDropdown(prev => !prev); }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                  <ChevronDown className="w-4 h-4" /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                              <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Planned Start</label>
                                <div className="flex gap-2">
                                  <input type="text" className="input-base flex-1 text-base py-3" placeholder="YYYY-MM-DD"
                                    value={newTask.planned_start} onChange={e => setNewTask({ ...newTask, planned_start: e.target.value })} />
                                  <button type="button" onClick={() => setDatePickerTarget('new_start_' + Date.now())}
                                    className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                                    title="Pick date from calendar"><Calendar className="w-5 h-5" /></button>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Planned End</label>
                                <div className="flex gap-2">
                                  <input type="text" className="input-base flex-1 text-base py-3" placeholder="YYYY-MM-DD"
                                    value={newTask.planned_end} onChange={e => setNewTask({ ...newTask, planned_end: e.target.value })} />
                                  <button type="button" onClick={() => setDatePickerTarget('new_end_' + Date.now())}
                                    className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                                    title="Pick date from calendar"><Calendar className="w-5 h-5" /></button>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                              <button onClick={() => { setShowTaskPopup(false); setNewTask({ name: '', planned_start: '', planned_end: '', color: 'blue' }); }}
                                className="btn-secondary flex-1 py-3 justify-center">Cancel</button>
                              <button onClick={async () => { await handleAddTask(); setShowTaskPopup(false); }}
                                disabled={!newTask.name.trim()}
                                className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 text-base">
                                <Plus className="w-5 h-5" /> Add Task</button>
                            </div>
                          </div>
                        </div>
                        {/* Dropdown */}
                        {showTaskPopup && showTaskDropdown && (() => {
                          const items = showAllSuggestions ? taskSuggestions : filteredSuggestions;
                          if (items.length === 0) return null;
                          const inputEl = taskInputRef.current;
                          if (!inputEl) return null;
                          const rect = inputEl.getBoundingClientRect();
                          return (
                            <div className="fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto scrollbar-thin"
                              style={{ left: rect.left + 'px', top: (rect.bottom + 4) + 'px', width: rect.width + 'px', maxHeight: '300px' }}>
                              {items.map((s, i) => (
                                <button key={i} type="button" className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-gray-100 last:border-b-0"
                                  onMouseDown={e => { e.preventDefault(); if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); setNewTask({ ...newTask, name: s }); setShowAllSuggestions(false); setShowTaskDropdown(false); }}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── Gantt Chart ── */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 gap-2">
                        <div className="flex items-center gap-1 bg-gray-200/60 rounded-lg p-0.5">
                          {(['week', 'month', 'year'] as const).map(v => (
                            <button key={v} onClick={() => setGanttView(v)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${ganttView === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              {v === 'week' ? 'Week' : v === 'month' ? 'Month' : 'Year'}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            if (ganttView === 'month') setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1));
                            else if (ganttView === 'week') setMonthStart(new Date(monthStart.getTime() - 7 * 24 * 60 * 60 * 1000));
                            else setMonthStart(new Date(monthStart.getFullYear() - 1, monthStart.getMonth(), 1));
                          }} className="p-1.5 hover:bg-gray-200 rounded-lg"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                          <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
                            {ganttView === 'month' && monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                            {ganttView === 'week' && `Week of ${viewDays[0]?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) || ''}`}
                            {ganttView === 'year' && `${monthStart.getFullYear()}`}
                          </span>
                          <button onClick={() => {
                            if (ganttView === 'month') setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1));
                            else if (ganttView === 'week') setMonthStart(new Date(monthStart.getTime() + 7 * 24 * 60 * 60 * 1000));
                            else setMonthStart(new Date(monthStart.getFullYear() + 1, monthStart.getMonth(), 1));
                          }} className="p-1.5 hover:bg-gray-200 rounded-lg"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
                          {totalProjectHours > 0 && (
                            <div className="flex items-center gap-1.5 pl-3 ml-3 border-l border-gray-300">
                              <div className="w-2.5 h-2.5 rounded-sm bg-green-500/80" />
                              <span className="text-[11px] font-bold text-gray-700">{totalProjectHours.toFixed(1)}h</span>
                              <span className="text-[10px] text-gray-400">total</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="gantt-grid grid min-w-[600px] border-b border-gray-200 bg-gray-100" style={{ gridTemplateColumns: `${taskColWidth}px repeat(${viewDays.length},1fr)` }}>
                          <div className="px-4 py-2.5 text-xs font-bold text-gray-600 border-r-2 border-gray-200 uppercase tracking-wider flex items-center relative">
                            Task
                            <div ref={resizeRef} onMouseDown={handleResizeStart}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors z-10" />
                          </div>
                          {viewDays.map((day, i) => {
                            if (ganttView === 'year') {
                              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                              return (
                                <div key={i} className="px-1 py-1.5 text-center text-[10px] font-semibold border-r border-gray-200 last:border-r-0 text-gray-500">
                                  <div className="text-[9px]">{monthNames[day.getMonth()]}</div>
                                </div>
                              );
                            }
                            const isToday = formatDate(day) === formatDate(new Date());
                            const dayOfWeek = day.getDay();
                            const dayName = DAY_NAMES_SHORT[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
                            const isFirst = day.getDate() === 1;
                            return (
                              <div key={i} className={`px-1 py-1.5 text-center text-[10px] font-semibold border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>
                                {ganttView === 'week' ? <div className="text-[8px] opacity-60">{dayName}</div> : (isFirst || dayOfWeek === 1) ? <div className="text-[8px] opacity-60">{dayName}</div> : <div className="h-3" />}
                                <div className={`${isToday ? 'font-bold' : ''} ${dayOfWeek === 0 || dayOfWeek === 6 ? 'text-gray-400' : ''}`}>{day.getDate()}</div>
                              </div>
                            );
                          })}
                        </div>
                        {ganttTasks.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No tasks yet. Click <strong>Add New Task</strong> to create one.</p>
                          </div>
                        ) : ganttTasks.map((task, index) => {
                              const plannedStyle = getBarStyle(task.planned_start, task.planned_end, ganttView === 'week' ? getMonday(monthStart) : monthStart, viewDays.length);
                              return (
                                <div key={task.id} className="border-b border-gray-100 last:border-b-0 group hover:bg-gray-50/50 transition-colors">
                                  <div className="gantt-grid grid min-w-[500px]" style={{ gridTemplateColumns: `${taskColWidth}px repeat(${viewDays.length},1fr)` }}>
                                    <div className="px-4 py-2 border-r-2 border-gray-200 bg-gray-50/80 flex flex-col justify-center gap-1.5 relative">
                                      <div onMouseDown={handleResizeStart}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors z-10" />
                                      <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-gray-200 text-[10px] font-bold text-gray-500 flex-shrink-0">{index + 1}</span>
                                        <span className="text-sm font-bold text-gray-900 truncate leading-tight">{task.name}</span>
                                        <button onClick={() => handleEditTaskDates(task)}
                                          className="p-0.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit dates">
                                          <Edit3 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDeleteTask(task.id)}
                                          className="p-0.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete task">
                                          <Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                      <div className="flex items-center gap-3 pl-7">
                                        <div className="flex items-center gap-1.5 ml-auto">
                                          <span className="text-[9px] text-gray-400">Progress:</span>
                                          <input type="range" min="0" max="100" value={task.progress}
                                            onChange={e => handleUpdateTaskProgress(task, parseInt(e.target.value))}
                                            className="w-14 h-1 accent-blue-600" />
                                          <span className="text-xs font-bold text-gray-600 w-7 text-right">{task.progress}%</span>
                                        </div>
                                        {taskHours[task.id] > 0 && (
                                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                            {taskHours[task.id].toFixed(1)}h
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="relative h-12 border-r border-gray-100" style={{ gridColumn: '2 / -1' }}>
                                      <div className="absolute inset-0 pointer-events-none">
                                        {viewDays.slice(1).map((_, i) => (
                                          <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100"
                                            style={{ left: `${((i + 1) / viewDays.length) * 100}%` }} />
                                        ))}
                                      </div>
                                      <div className="absolute inset-x-0 top-0 h-6 flex items-center">
                                    {plannedStyle ? (
                                      <div className="h-[18px] bg-blue-500/70 cursor-pointer hover:bg-blue-500/90 transition-colors relative"
                                        style={{ left: plannedStyle.left, width: plannedStyle.width, minWidth: '4px', position: 'absolute' }}
                                        title={`Planned: ${task.planned_start} → ${task.planned_end}`}>
                                        {parseFloat(plannedStyle.width) > 8 && (
                                          <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white truncate leading-none">
                                            {formatDMY(task.planned_start)} – {formatDMY(task.planned_end)}
                                          </span>
                                        )}
                                      </div>
                                    ) : task.planned_start ? (
                                      <div className="h-[18px] bg-blue-300/50 cursor-pointer" style={{ left: '1%', width: '6px', position: 'absolute' }}
                                        title={`Planned: ${task.planned_start} → ${task.planned_end || '?'}`} />
                                    ) : null}
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 h-6 flex items-center">
                                    {(() => {
                                      const hoursByDate = taskHoursByDate[task.id];
                                      const hasHours = hoursByDate && Object.keys(hoursByDate).length > 0;
                                      if (hasHours) {
                                        const maxHrs = 13;
                                        return Object.entries(hoursByDate!).map(([dateStr, hrs]) => {
                                          const dayIndex = viewDays.findIndex(d => formatDate(d) === dateStr);
                                          if (dayIndex === -1) return null;
                                          const opacity = 0.25 + Math.min(hrs / maxHrs, 1) * 0.75;
                                          const dayWidthPct = (1 / viewDays.length) * 100;
                                          return (
                                            <div key={dateStr}
                                              className="absolute h-[18px] rounded-sm bg-green-500 cursor-pointer hover:bg-green-600 transition-colors flex items-center justify-center"
                                              style={{ left: `${(dayIndex / viewDays.length) * 100}%`, width: `${dayWidthPct}%`, opacity, minWidth: '4px', position: 'absolute' }}
                                              title={`${dateStr}: ${hrs.toFixed(1)}h`}>
                                              {dayWidthPct > 8 && (
                                                <span className="text-[8px] font-bold text-white leading-none truncate px-0.5">{hrs.toFixed(1)}h</span>
                                              )}
                                            </div>
                                          );
                                        });
                                      }
                                      return task.actual_start ? (
                                        <div className="h-[18px] bg-green-400/60 cursor-pointer" style={{ left: '1%', width: '6px', position: 'absolute' }}
                                          title={`Actual: ${task.actual_start}`} />
                                      ) : null;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-t border-gray-200">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500/80" /><span className="text-[10px] text-gray-500">Planned</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500/80" /><span className="text-[10px] text-gray-500">Actual (per day)</span></div>
                      </div>
                    </div>

                    {ganttTasks.length > 0 && !process.step4_complete && (
                      <div className="flex justify-end">
                        <button onClick={() => handleSaveStep(4, JSON.stringify(ganttTasks), true)}
                          className="btn-primary flex items-center gap-2">
                          <Check className="w-4 h-4" /> Mark Step 4 Complete
                        </button>
                      </div>
                    )}

                    {/* Edit Task Dates Dialog */}
                    {editingTaskId !== null && (
                      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-xl p-6 w-96 mx-4">
                          <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Planned Dates</h3>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500">Planned Start</label>
                              <div className="flex gap-2 mt-1">
                                <input type="text" className="input-base flex-1" placeholder="YYYY-MM-DD"
                                  value={editPlannedStart} onChange={e => setEditPlannedStart(e.target.value)} />
                                <button type="button" onClick={() => setDatePickerTarget('edit_start_' + Date.now())}
                                  className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                                  title="Pick date from calendar"><Calendar className="w-4 h-4" /></button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Planned End</label>
                              <div className="flex gap-2 mt-1">
                                <input type="text" className="input-base flex-1" placeholder="YYYY-MM-DD"
                                  value={editPlannedEnd} onChange={e => setEditPlannedEnd(e.target.value)} />
                                <button type="button" onClick={() => setDatePickerTarget('edit_end_' + Date.now())}
                                  className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                                  title="Pick date from calendar"><Calendar className="w-4 h-4" /></button>
                              </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                              <button onClick={() => setEditingTaskId(null)} className="btn-secondary flex-1">Cancel</button>
                              <button onClick={handleSaveTaskDates} className="btn-primary flex-1">Save</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 5 - Final Review */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-5">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      const next = new Set(expandedSteps);
                      if (next.has(5)) next.delete(5); else next.add(5);
                      setExpandedSteps(next);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      getStepStatus(5) === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getStepStatus(5) === 'completed' ? <Check className="w-4 h-4" /> : '5'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{PROCESS_STEP_LABELS[5].label}</h3>
                      <p className="text-xs text-gray-500 truncate">{PROCESS_STEP_LABELS[5].description}</p>
                    </div>
                    {getStepStatus(5) === 'completed' && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 flex-shrink-0">Completed</span>
                    )}
                    {getStepStatus(5) === 'completed' && !stepEditMode.has(5) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); const next = new Set(stepEditMode); next.add(5); setStepEditMode(next); }}
                        className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 hover:bg-blue-100 flex-shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${(!(getStepStatus(5) === 'completed') || expandedSteps.has(5)) ? '' : '-rotate-90'}`} />
                  </div>
                  {(!(getStepStatus(5) === 'completed') || expandedSteps.has(5)) && (
                  <div className="relative">
                    {(getStepStatus(5) === 'completed' && !stepEditMode.has(5)) && (
                      <div className="absolute inset-0 z-10 rounded-b-xl cursor-default" />
                    )}
                  <div className={`px-4 pt-4 pb-4 space-y-8 ${getStepStatus(5) === 'completed' && !stepEditMode.has(5) ? 'pointer-events-none opacity-60 select-none' : ''}`}>
                    {/* Server Folder */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-bold text-gray-800">Server Folder</h3>
                      </div>
                      <div className="pt-10 px-5 pb-5 space-y-5">
                        <div className="flex items-start gap-3">
                          <div className="relative flex-1">
                            <FolderOpen className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input className="input-base w-full pl-10 text-sm font-mono"
                              placeholder='\\server\company\projects\ProjectName\ or C:\Projects\...'
                              value={folderPath} onChange={e => { setFolderPath(e.target.value); setFolderError(''); }} />
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={async () => {
                              if (!folderPath.trim()) return;
                              setFolderLoading(true); setFolderError('');
                              try { const result = await openFolder(folderPath.trim()); setFolderError(result.message); setTimeout(() => setFolderError(''), 3000); }
                              catch (e: any) { setFolderError(e.response?.data?.detail || 'Failed to open folder'); }
                              finally { setFolderLoading(false); }
                            }} disabled={folderLoading || !folderPath.trim()}
                              className="btn-primary flex items-center gap-2 px-4 py-2.5 whitespace-nowrap">
                              <ExternalLink className="w-4 h-4" /> Open Folder
                            </button>
                            <button onClick={async () => {
                              if (!folderPath.trim()) return;
                              setFolderLoading(true); setFolderError('');
                              try { const result = await listFolder(folderPath.trim()); setFolderItems(result.items); setCurrentFolderPath(result.folder_path); }
                              catch (e: any) { setFolderError(e.response?.data?.detail || 'Failed to list folder'); setFolderItems([]); }
                              finally { setFolderLoading(false); }
                            }} disabled={folderLoading || !folderPath.trim()}
                              className="btn-secondary flex items-center gap-2 px-4 py-2.5 whitespace-nowrap">
                              <FileText className="w-4 h-4" /> Browse
                            </button>
                          </div>
                        </div>
                        {folderError && (
                          <div className={`text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                            folderError.includes('Opened') || folderError.includes('success')
                              ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                          }`}>
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{folderError}
                          </div>
                        )}
                        {folderLoading ? (
                          <div className="text-center py-8 text-gray-400">
                            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                            <p className="text-sm">Loading folder contents...</p>
                          </div>
                        ) : folderItems.length > 0 ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200 flex items-center gap-2">
                              <Folder className="w-3.5 h-3.5" />{currentFolderPath}
                              <span className="ml-auto text-gray-400 font-normal">{folderItems.length} item(s)</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                              {currentFolderPath && (
                                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
                                  onClick={async () => {
                                    const parent = currentFolderPath.split('\\').slice(0, -1).join('\\');
                                    const parent2 = currentFolderPath.split('/').slice(0, -1).join('/');
                                    const parentPath = parent.length > parent2.length ? parent : parent2;
                                    if (parentPath && parentPath !== currentFolderPath) {
                                      setFolderLoading(true);
                                      try { const result = await listFolder(parentPath); setFolderItems(result.items); setCurrentFolderPath(result.folder_path); setFolderPath(parentPath); }
                                      catch (e: any) { setFolderError(e.response?.data?.detail || 'Failed'); }
                                      finally { setFolderLoading(false); }
                                    }
                                  }}>
                                  <Folder className="w-4 h-4 text-amber-400" />
                                  <span className="text-sm font-medium text-gray-700">.. (Parent folder)</span>
                                </button>
                              )}
                              {folderItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group">
                                  {item.is_dir ? (
                                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                      onClick={async () => {
                                        setFolderLoading(true);
                                        try { const result = await listFolder(item.path); setFolderItems(result.items); setCurrentFolderPath(result.folder_path); setFolderPath(result.folder_path); }
                                        catch (e: any) { setFolderError(e.response?.data?.detail || 'Failed'); }
                                        finally { setFolderLoading(false); }
                                      }}>
                                      <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                      <span className="text-sm text-gray-700 truncate">{item.name}</span>
                                    </button>
                                  ) : (
                                    <>
                                      <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.name}</span>
                                      <span className="text-xs text-gray-400 flex-shrink-0">
                                        {item.size < 1024 ? `${item.size} B` : item.size < 1024 * 1024 ? `${(item.size / 1024).toFixed(1)} KB` : `${(item.size / (1024 * 1024)).toFixed(1)} MB`}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : folderPath.trim() && !folderLoading ? (
                          <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Click <strong>Browse</strong> to view files</p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Per-Report Folder Paths */}
                    {step3Reports.length > 1 && (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-blue-600" />
                          <h3 className="text-sm font-bold text-gray-800">Server Folders per Report</h3>
                        </div>
                        <div className="p-5 space-y-4">
                          {step3Reports.map(rn => (
                            <div key={rn.id} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-gray-700">{rn.report_number}</span>
                                {rn.item_description && (
                                  <span className="text-[10px] text-gray-400">{rn.item_description}</span>
                                )}
                              </div>
                              <div className="relative flex-1">
                                <FolderOpen className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input className="input-base w-full pl-10 text-sm font-mono"
                                  placeholder={`\\\\server\\path\\for\\${rn.report_number}\\...`}
                                  value={rn.folder_path || ''}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    try {
                                      await updateReportNumber(projectId, rn.id, { folder_path: val });
                                      const rns = await getReportNumbers(projectId);
                                      setStep3Reports(rns);
                                    } catch (err) { console.error(err); }
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Uploaded Files */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-bold text-gray-800">All Uploaded Files</h3>
                        <button onClick={async () => { setFilesLoading(true); try { const files = await getProjectFiles(projectId); setAllProjectFiles(files); } catch (e) { console.error(e); } finally { setFilesLoading(false); } }}
                          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 ml-auto">
                          <RefreshCw className={`w-3 h-3 ${filesLoading ? 'animate-spin' : ''}`} /> Load Files
                        </button>
                      </div>
                      <div className="p-5 space-y-4">
                        {filesLoading ? (
                          <div className="text-center py-6 text-gray-400">
                            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                            <p className="text-sm">Loading files...</p>
                          </div>
                        ) : allProjectFiles.length === 0 ? (
                          <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Click <strong>Load Files</strong> to see all uploaded files</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="relative flex-1">
                                <Folder className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <input className="input-base w-full pl-9 text-sm font-mono" placeholder="Paste server folder path to copy files..."
                                  value={copyTargetFolder} onChange={e => setCopyTargetFolder(e.target.value)} />
                              </div>
                              <button onClick={async () => {
                                if (!copyTargetFolder.trim() || selectedFiles.size === 0) return;
                                setCopying(true); setCopyResult('');
                                let successCount = 0, failCount = 0;
                                for (const fileId of selectedFiles) {
                                  const file = allProjectFiles.find(f => f.id === fileId);
                                  if (!file) continue;
                                  try { await copyFileToFolder(file.file_path, copyTargetFolder.trim()); successCount++; }
                                  catch { failCount++; }
                                }
                                setCopyResult(`Copied ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
                                setSelectedFiles(new Set()); setCopying(false);
                                setTimeout(() => setCopyResult(''), 4000);
                              }} disabled={copying || selectedFiles.size === 0 || !copyTargetFolder.trim()}
                                className="btn-primary flex items-center gap-2 px-4 py-2.5 whitespace-nowrap">
                                <Copy className="w-4 h-4" /> {copying ? 'Copying...' : `Copy (${selectedFiles.size})`}
                              </button>
                            </div>
                            {copyResult && (
                              <div className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200">
                                <Check className="w-3.5 h-3.5" />{copyResult}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button onClick={() => { if (selectedFiles.size === allProjectFiles.length) setSelectedFiles(new Set()); else setSelectedFiles(new Set(allProjectFiles.map(f => f.id))); }}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                <Check className="w-3 h-3" />{selectedFiles.size === allProjectFiles.length ? 'Deselect All' : 'Select All'}
                              </button>
                              <span className="text-xs text-gray-400">{selectedFiles.size} of {allProjectFiles.length} selected</span>
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                              {allProjectFiles.map(file => (
                                <div key={file.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${selectedFiles.has(file.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selectedFiles.has(file.id)}
                                    onChange={() => { const next = new Set(selectedFiles); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); setSelectedFiles(next); }} />
                                  <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-gray-700 truncate block">{file.original_filename}</span>
                                    <span className="text-[10px] text-gray-400">{file.stage}{file.step_name ? ` / ${file.step_name}` : ''} · {file.file_size < 1024 ? `${file.file_size} B` : file.file_size < 1024 * 1024 ? `${(file.file_size / 1024).toFixed(1)} KB` : `${(file.file_size / (1024 * 1024)).toFixed(1)} MB`}</span>
                                  </div>
                                  <a href={`/api/files/${file.id}/view`} target="_blank" rel="noopener noreferrer"
                                    className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg" title="View"><Eye className="w-3.5 h-3.5" /></a>
                                  <a href={`/api/files/${file.id}/download`}
                                    className="p-1.5 text-green-500 hover:bg-green-100 rounded-lg" title="Download"><Download className="w-3.5 h-3.5" /></a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Final Review Notes */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />Final Review Notes <span className="text-[10px] font-normal text-gray-400">(optional)</span>
                      </h3>
                      <textarea className="input-base w-full h-24 resize-none text-sm" placeholder="Enter final review notes or comments (optional)..."
                        value={step5Data} onChange={e => setStep5Data(e.target.value)} />
                      {!folderPath.trim() && (
                        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Please specify a Folder Path</p>
                            <p className="mt-0.5">You must enter a server folder path before you can save and proceed</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 mt-3">
                        <div className="text-xs text-gray-400">
                          {folderPath.trim()
                            ? <span className="text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Folder path set</span>
                            : <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Folder path required</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={async () => {
                            if (folderPath.trim()) { try { await updateProcess(projectId, { folder_path: folderPath.trim() }); } catch (e) { console.error(e); } }
                            await handleSaveStep(5, step5Data, true);
                          }} disabled={saving || !folderPath.trim()}
                            className="btn-primary flex items-center gap-2">
                            <Save className="w-4 h-4" /> {process.step5_complete ? 'Update & Complete' : 'Save & Complete'}
                          </button>
                          {allStepsComplete && project?.current_stage === 'process' && (
                            <button onClick={handleAdvanceToOutputs}
                              className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
                              Advance to Outputs <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
                </div>
            </div>

          {/* ════════════════════════════════════════ */}
          {/* OUTPUTS                                 */}
          {/* ════════════════════════════════════════ */}
          <div className="border-t border-gray-200 pt-6 mt-6" ref={outputsRef}>
            {canAccessOutputs ? (
              <OutputsPanel
                projectId={projectId}
                project={project}
                onUpdate={fetchData}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <h3 className="text-base font-bold text-gray-700 mb-2">Outputs Checklist 🔒</h3>
                <p className="text-sm text-gray-400 mb-3">Complete all requirements below to unlock the Outputs Checklist:</p>
                <div className="inline-flex flex-col items-start gap-2 text-sm">
                  <span className={`flex items-center gap-2 ${allStepsComplete ? 'text-green-600' : 'text-gray-400'}`}>
                    {allStepsComplete ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />} Steps 1-5 completed
                  </span>
                  {(() => {
                    const incompleteTasks = ganttTasks.filter(t => t.progress < 100);
                    return incompleteTasks.length > 0 ? (
                      <span className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="w-4 h-4" /> {incompleteTasks.length} Gantt task(s) not at 100%
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-green-600">
                        <Check className="w-4 h-4" /> All Gantt tasks at 100%
                      </span>
                    );
                  })()}
                  <span className={`flex items-center gap-2 ${process?.folder_path ? 'text-green-600' : 'text-gray-400'}`}>
                    {process?.folder_path ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />} Server folder path set
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════ */}
          {/* FILES & ATTACHMENTS                     */}
          {/* ════════════════════════════════════════ */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Files & Attachments</h2>
              <FileUpload
                projectId={projectId}
                stage={project.current_stage}
                files={project.files || []}
                onFilesChange={fetchData}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete "${project.title}"? This action cannot be undone.`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
