import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Plus, Trash2, Calendar, Clock, Save,
  AlertCircle, ChevronRight, ChevronLeft, ChevronDown, FileText, Edit3, X,
  ExternalLink, FolderOpen, Copy, Download, Eye, Folder, File as FileIcon,
  RefreshCw, Lock, Unlock
} from 'lucide-react';
import {
  getProject, getProcess, updateProcessStep, updateProcess, advanceToOutputs,
  createGanttTask, updateGanttTask, deleteGanttTask,
  openFolder, listFolder, getProjectFiles, copyFileToFolder
} from '../api/client';
import type { Project, ProcessSteps, GanttTask, FileAttachment } from '../types';
import { PROCESS_STEP_LABELS, WORK_TYPES } from '../types';
import FileUpload from '../components/FileUpload';
import { formatDMY } from '../utils/dateUtils';

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

/** Calculate left offset and width percentage for a bar within a month */
function getBarStyle(startStr: string, endStr: string, monthStart: Date): { left: string; width: string } | null {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return null;

  const totalDays = getDaysInMonth(monthStart);
  const monthEnd = getMonthEnd(monthStart);
  
  // Clamp to visible month
  const visStart = start < monthStart ? monthStart : start;
  const visEnd = end > monthEnd ? monthEnd : end;
  
  if (visStart > monthEnd || visEnd < monthStart) return null;
  
  const startOffset = daysBetween(monthStart, visStart);
  const visibleDuration = daysBetween(visStart, visEnd) + 1;
  
  return {
    left: `${(startOffset / totalDays) * 100}%`,
    width: `${(visibleDuration / totalDays) * 100}%`,
  };
}

export default function ProcessPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  
  const [project, setProject] = useState<Project | null>(null);
  const [process, setProcess] = useState<ProcessSteps | null>(null);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editMode, setEditMode] = useState(false);
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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = taskColWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(140, Math.min(500, startWidth + (ev.clientX - startX)));
      setTaskColWidth(newWidth);
      // Update grid template columns directly for smooth resize
      const grids = document.querySelectorAll('.gantt-grid');
      grids.forEach(el => {
        (el as HTMLElement).style.gridTemplateColumns = `${newWidth}px repeat(7,1fr)`;
      });
    };

    const onMouseUp = () => {
      isResizing.current = false;
      const finalWidth = Math.max(140, Math.min(500, taskColWidth));
      localStorage.setItem('gantt_task_col_width', String(finalWidth));
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

  // Computed month days
  const monthDays = useMemo(() => {
    const total = getDaysInMonth(monthStart);
    const days: Date[] = [];
    for (let i = 0; i < total; i++) days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
    return days;
  }, [monthStart]);

  // Step form data
  const [step1Data, setStep1Data] = useState('');
  const [step1Source, setStep1Source] = useState<'comets' | 'email' | 'self'>('comets');
  const [step2Data, setStep2Data] = useState('');
  const [step3Data, setStep3Data] = useState('');
  const [step5Data, setStep5Data] = useState('');

  // New gantt task form
  const [newTask, setNewTask] = useState({ name: '', planned_start: '', planned_end: '', color: 'blue' });
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [customTasks, setCustomTasks] = useState<string[]>([]);

  // Step 5: Final Review state
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

  // Project work type for presets
  const workType = project?.work_type || '';
  const presetTasks = getPresetTasks(workType);

  // Combined suggestions: presets + custom tasks
  const taskSuggestions = useMemo(() => {
    const presets = getPresetTasks(workType);
    const customs = loadCustomTasks(workType).filter(t => !presets.includes(t));
    return [...presets, ...customs];
  }, [workType]);

  // Filtered suggestions based on typed text
  const filteredSuggestions = useMemo(() => {
    if (!newTask.name.trim()) return taskSuggestions;
    const q = newTask.name.toLowerCase();
    return taskSuggestions.filter(t => t.toLowerCase().includes(q));
  }, [newTask.name, taskSuggestions]);

  const fetchData = useCallback(async () => {
    try {
      const [proj, proc] = await Promise.all([
        getProject(projectId),
        getProcess(projectId)
      ]);
      setProject(proj);
      setProcess(proc.process);
      setGanttTasks(proc.gantt_tasks);
      setStep1Data(proc.process.step1_data || '');
      setStep2Data(proc.process.step2_data || '');
      setStep3Data(proc.process.step3_data || '');
      setStep5Data(proc.process.step5_data || '');
    } catch (e) {
      console.error(e);
      setError('Failed to load process data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Trigger native date picker when target is set
  useEffect(() => {
    if (datePickerTarget && datePickerRef.current) {
      // Clear value first so selecting same date triggers onChange
      datePickerRef.current.value = '';
      datePickerRef.current.showPicker();
    }
  }, [datePickerTarget]);

  const handleSaveStep = async (stepNum: number, data: string, complete: boolean) => {
    setSaving(true);
    try {
      const result = await updateProcessStep(projectId, stepNum, {
        data,
        complete
      });
      await fetchData();
      if (result.all_steps_complete && stepNum === 5) {
        // All steps done
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
      // Save to custom tasks if it's not a preset
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

  const handleUpdateTaskDates = async (taskId: number, start: string, end: string) => {
    try {
      await updateGanttTask(projectId, taskId, { planned_start: start, planned_end: end });
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
      // Check all gantt tasks are 100% before advancing
      const incompleteTasks = ganttTasks.filter(t => t.progress < 100);
      if (incompleteTasks.length > 0) {
        setError(`Cannot advance to Outputs: ${incompleteTasks.length} task(s) still in progress. Set all tasks to 100% first.`);
        return;
      }
      // Check folder path is set
      if (!process?.folder_path && !folderPath.trim()) {
        setError('Cannot advance to Outputs: Please set the Server Folder Path in Step 5 first');
        return;
      }
      await advanceToOutputs(projectId);
      navigate(`/project/${projectId}`);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to advance to outputs');
    }
  };

  const getStepStatus = (stepNum: number) => {
    if (!process) return 'pending';
    return process[`step${stepNum}_complete` as keyof ProcessSteps] ? 'completed' : 'pending';
  };

  const allStepsComplete = process && 
    process.step1_complete && process.step2_complete && process.step3_complete &&
    process.step4_complete && process.step5_complete;



  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!project || !process) return <div className="p-8 text-center text-red-500">Project not found</div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Hidden date picker input (fixed position so picker opens centered-ish) */}
      <input
        type="date"
        ref={datePickerRef}
        className="fixed"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 99999, opacity: 0.01, pointerEvents: 'none', width: '200px', height: '30px' }}
        onChange={e => {
          if (!e.target.value || !datePickerTarget) return;
          const val = e.target.value;
          // Determine which field to update based on target
          if (datePickerTarget.startsWith('new_start')) setNewTask(p => ({ ...p, planned_start: val }));
          else if (datePickerTarget.startsWith('new_end')) setNewTask(p => ({ ...p, planned_end: val }));
          else if (datePickerTarget.startsWith('edit_start')) setEditPlannedStart(val);
          else if (datePickerTarget.startsWith('edit_end')) setEditPlannedEnd(val);
          setDatePickerTarget(null);
        }}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/project/${projectId}`)} className="btn-secondary p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-sm text-gray-500">{project.work_type} • {project.customer_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Edit Mode Toggle - Enhanced UX */}
          <div className="relative group">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm ${
                editMode
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border border-emerald-400 shadow-emerald-200 hover:from-emerald-600 hover:to-green-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-amber-400 shadow-amber-200 hover:from-amber-600 hover:to-orange-600 animate-pulse-subtle'
              }`}
              title={editMode ? 'Disable edit mode (lock content)' : 'Enable edit mode to make changes'}
            >
              {editMode ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>{editMode ? 'Editing Mode' : 'Edit Mode'}</span>
              <kbd className={`text-[10px] px-1.5 py-0.5 rounded ${editMode ? 'bg-emerald-600/40 text-emerald-100' : 'bg-amber-600/40 text-amber-100'}`}>
                {editMode ? 'ON' : 'OFF'}
              </kbd>
            </button>
            {/* Tooltip hint */}
            {!editMode && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                ⚡ Click to unlock editing
              </div>
            )}
          </div>
          {allStepsComplete && project?.current_stage === 'process' && (
            <button onClick={handleAdvanceToOutputs} className="btn-primary flex items-center gap-2">
              Advance to Outputs <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Step Navigation */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map(stepNum => {
            const status = getStepStatus(stepNum);
            const isActive = activeStep === stepNum;
            return (
              <button
                key={stepNum}
                onClick={() => setActiveStep(stepNum)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : status === 'completed'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {status === 'completed' && <Check className="w-4 h-4" />}
                Step {stepNum}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 relative">
        {/* Locked overlay hint when edit mode is off */}
        {!editMode && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-white/40 backdrop-blur-[1px] absolute inset-0 rounded-xl" />
            <div className="relative bg-white/90 border border-amber-200 rounded-xl px-6 py-4 shadow-lg flex items-center gap-4 max-w-md opacity-0 hover:opacity-100 transition-opacity duration-300">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">🔒 Editing is locked</p>
                <p className="text-xs text-amber-600 mt-0.5">Click the <strong className="text-amber-700">Edit Mode</strong> button above to enable editing</p>
              </div>
            </div>
          </div>
        )}
        {activeStep === 1 && (
          <div className={`space-y-5 ${!editMode ? 'pointer-events-none opacity-60 select-none' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{PROCESS_STEP_LABELS[1].label}</h2>
                <p className="text-sm text-gray-500">{PROCESS_STEP_LABELS[1].description}</p>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">10% of project</span>
            </div>

            {/* Order Source Selection */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 block">Order Source</label>

              {/* Option 1: COMETS */}
              <div className={`border rounded-xl p-4 transition-all ${step1Source === 'comets' ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="step1Source"
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    checked={step1Source === 'comets'}
                    onChange={() => setStep1Source('comets')}
                  />
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
                        </div>
                        <a href={step1Data.trim()} target="_blank" rel="noopener noreferrer"
                          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap">
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                        <button onClick={() => setStep1Editing(true)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Change URL">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="url" disabled={!editMode} className="input-base w-full text-sm"
                          placeholder="https://comets.nsk.com/order/..."
                          value={step1Data}
                          onChange={e => setStep1Data(e.target.value)}
                        />
                        {step1Data.trim() && (
                          <a href={step1Data.trim()} target="_blank" rel="noopener noreferrer"
                            className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs whitespace-nowrap">
                            <ExternalLink className="w-3 h-3" /> Test
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Option 2: Email */}
              <div className={`border rounded-xl p-4 transition-all ${step1Source === 'email' ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="step1Source"
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    checked={step1Source === 'email'}
                    onChange={() => setStep1Source('email')}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">Received via Email</span>
                    <p className="text-xs text-gray-500 mt-0.5">Order sent via email with attached file</p>
                  </div>
                </label>
                {step1Source === 'email' && (
                  <div className="mt-3 pl-7">
                    <p className="text-xs text-gray-500 mb-2">Attach the email or order file:</p>
                    <FileUpload
                      projectId={projectId}
                      stage="process"
                      stepName="step1_email"
                      files={project?.files?.filter(f => f.stage === 'process' && f.step_name === 'step1_email') || []}
                      onFilesChange={fetchData}
                    />
                  </div>
                )}
              </div>

              {/* Option 3: Self-initiated */}
              <div className={`border rounded-xl p-4 transition-all ${step1Source === 'self' ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="step1Source"
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    checked={step1Source === 'self'}
                    onChange={() => setStep1Source('self')}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">Self-Initiated</span>
                    <p className="text-xs text-gray-500 mt-0.5">No order received, we want to do this work</p>
                  </div>
                </label>
                {step1Source === 'self' && (
                  <div className="mt-3 pl-7 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Reason / Justification</label>
                      <textarea
                        className="input-base w-full h-20 resize-none text-sm"
                        placeholder="Explain why this work is needed..."
                        value={step1Data}
                        onChange={e => setStep1Data(e.target.value)}
                      />
                    </div>
                    <FileUpload
                      projectId={projectId}
                      stage="process"
                      stepName="step1_self"
                      files={project?.files?.filter(f => f.stage === 'process' && f.step_name === 'step1_self') || []}
                      onFilesChange={fetchData}
                    />
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
                  const dataToSave = `${step1Source}:${step1Data}`;
                  await handleSaveStep(1, dataToSave, true);
                  setStep1Editing(false);
                  setSuccessMsg('Saved and completed!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }}
                disabled={saving || (step1Source === 'comets' && !step1Data.trim())}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {process.step1_complete ? 'Update & Complete' : 'Save & Complete'}
              </button>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className={`space-y-5 ${!editMode ? 'pointer-events-none opacity-60 select-none' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{PROCESS_STEP_LABELS[2].label}</h2>
                <p className="text-sm text-gray-500">{PROCESS_STEP_LABELS[2].description}</p>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">10% of project</span>
            </div>

            {/* Order Source Summary from Step 1 - auto updates */}
            {(() => {
              // Parse source from step1_data: "sourcePrefix:actualData" or just plain URL (legacy)
              const colonIdx = step1Data.indexOf(':');
              const rawPrefix = colonIdx >= 0 ? step1Data.substring(0, colonIdx) : '';
              const actualData = colonIdx >= 0 ? step1Data.substring(colonIdx + 1) : step1Data;
              
              // Determine source type
              let sourceType: 'comets' | 'email' | 'self' | 'none' = 'none';
              if (rawPrefix === 'comets' || (rawPrefix === '' && step1Data.trim().startsWith('http'))) sourceType = 'comets';
              else if (rawPrefix === 'email') sourceType = 'email';
              else if (rawPrefix === 'self') sourceType = 'self';
              else if (step1Data.trim()) sourceType = 'comets'; // legacy: treat plain URL as comets

              if (sourceType === 'none') {
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    No order source found. Please complete Step 1 first.
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
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
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

            {/* Confirmation */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={!!process.step2_complete}
                  onChange={async e => {
                    const checked = e.target.checked;
                    await handleSaveStep(2, step2Data, checked);
                    setSuccessMsg(checked ? 'Order confirmed!' : 'Confirmation removed');
                    setTimeout(() => setSuccessMsg(''), 3000);
                  }}
                />
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

            {/* Optional Comment */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Comment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                className="input-base w-full h-24 resize-none"
                placeholder="Any notes about the order confirmation..."
                value={step2Data}
                onChange={e => setStep2Data(e.target.value)}
              />
            </div>

            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700">
                <Check className="w-4 h-4" /> {successMsg}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={async () => {
                  await handleSaveStep(2, step2Data, !!process.step2_complete);
                  setSuccessMsg('Saved!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }}
                disabled={saving}
                className="btn-secondary flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Comment
              </button>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className={`space-y-5 ${!editMode ? 'pointer-events-none opacity-60 select-none' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{PROCESS_STEP_LABELS[3].label}</h2>
                <p className="text-sm text-gray-500">{PROCESS_STEP_LABELS[3].description}</p>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">10% of project</span>
            </div>

            {/* Option Selection */}
            <div className="space-y-3">
              {/* Option 1: Has Report No. */}
              <div className={`border rounded-xl p-4 transition-all ${step3HasReport ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="step3Option"
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    checked={step3HasReport}
                    onChange={() => { setStep3HasReport(true); setStep3Data(''); }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">Has Report Number</span>
                    <p className="text-xs text-gray-500 mt-0.5">Enter APTX report number</p>
                  </div>
                </label>
                {step3HasReport && (
                  <div className="mt-3 pl-7 space-y-3">
                    {/* Report No. Input */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Report Number <span className="text-gray-400 font-normal">(format: APTX + 2-digit year + 3-digit number)</span>
                      </label>
                      <input
                        className="input-base w-full text-base tracking-widest font-mono uppercase"
                        placeholder="APTX26145"
                        value={step3Data}
                        onChange={e => {
                          const val = e.target.value.toUpperCase().replace(/[^APTX0-9]/g, '');
                          setStep3Data(val);
                        }}
                        maxLength={10}
                      />

                      {/* Validation - only for Has Report option */}
                      {step3HasReport && step3Data.trim() && (() => {
                        const pattern = /^APTX\d{5}$/;
                        if (pattern.test(step3Data.trim())) {
                          const year = step3Data.substring(4, 6);
                          const num = step3Data.substring(6);
                          return (
                            <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                              <Check className="w-3.5 h-3.5 flex-shrink-0" />
                              Valid: APTX{year}{num} — Report #{parseInt(num)} of 20{year}
                            </div>
                          );
                        }
                        return (
                          <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Invalid format</p>
                              <p className="mt-0.5">Must be <strong>APTX</strong> + <strong>2-digit year</strong> + <strong>3-digit number</strong> (e.g., APTX<span className="text-blue-600">26</span><span className="text-purple-600">145</span>)</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>


                  </div>
                )}
              </div>

              {/* Option 2: No Report */}
              <div className={`border rounded-xl p-4 transition-all ${!step3HasReport ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="step3Option"
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    checked={!step3HasReport}
                    onChange={() => { setStep3HasReport(false); setStep3Data('No report'); }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">No Report</span>
                    <p className="text-xs text-gray-500 mt-0.5">Skip this step — no report number needed</p>
                  </div>
                </label>
                {!step3HasReport && (
                  <div className="mt-3 pl-7">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-xs text-green-700">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      Will use "No report" — you can proceed to the next step
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
                  await handleSaveStep(3, step3Data, true);
                  setSuccessMsg('Report number saved!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }}
                disabled={saving || (step3Data.trim() !== 'No report' && !/^APTX\d{5}$/.test(step3Data.trim()))}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {process.step3_complete ? 'Update & Complete' : 'Save & Complete'}
              </button>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className={`space-y-6 ${!editMode ? 'pointer-events-none opacity-60 select-none' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{PROCESS_STEP_LABELS[4].label}</h2>
                <p className="text-sm text-gray-500">{PROCESS_STEP_LABELS[4].description}</p>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">80% of project (divided among tasks)</span>
            </div>

            {/* Add Task Button - opens popup */}
            <div className="flex justify-start">
              <button
                onClick={() => setShowTaskPopup(true)}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add New Task
              </button>
            </div>

            {/* Add Task Popup Modal */}
            {showTaskPopup && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-8" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Add New Task</h3>
                    <button onClick={() => { setShowTaskPopup(false); setNewTask({ name: '', planned_start: '', planned_end: '', color: 'blue' }); }} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-5">
                    {/* Task name with dropdown suggestions */}
                    <div className="relative" style={{ minHeight: '60px' }}>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Task Name</label>
                      <div className="relative">
                        <input
                          ref={taskInputRef}
                          className="input-base w-full text-base py-3 pr-10"
                          placeholder="Type or select task..."
                          value={newTask.name}
                          onChange={e => {
                            setNewTask({ ...newTask, name: e.target.value });
                            setShowAllSuggestions(false);
                            if (e.target.value.trim()) setShowTaskDropdown(true);
                          }}
                          onFocus={() => {
                            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                            if (newTask.name.trim()) setShowTaskDropdown(true);
                          }}
                          onBlur={() => {
                            blurTimeoutRef.current = setTimeout(() => setShowTaskDropdown(false), 200);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); }}
                          onClick={() => { setShowAllSuggestions(true); setShowTaskDropdown(prev => !prev); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Show task suggestions"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Planned Start</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="input-base flex-1 text-base py-3"
                            placeholder="YYYY-MM-DD"
                            value={newTask.planned_start}
                            onChange={e => setNewTask({ ...newTask, planned_start: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setDatePickerTarget('new_start_' + Date.now())}
                            className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                            title="Pick date from calendar"
                          >
                            <Calendar className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Planned End</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="input-base flex-1 text-base py-3"
                            placeholder="YYYY-MM-DD"
                            value={newTask.planned_end}
                            onChange={e => setNewTask({ ...newTask, planned_end: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setDatePickerTarget('new_end_' + Date.now())}
                            className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                            title="Pick date from calendar"
                          >
                            <Calendar className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => { setShowTaskPopup(false); setNewTask({ name: '', planned_start: '', planned_end: '', color: 'blue' }); }}
                        className="btn-secondary flex-1 py-3 justify-center"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => { await handleAddTask(); setShowTaskPopup(false); }}
                        disabled={!newTask.name.trim() || !editMode}
                        className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 text-base"
                      >
                        <Plus className="w-5 h-5" /> Add Task
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dropdown rendered outside popup overflow, positioned by input */}
                {showTaskPopup && showTaskDropdown && (() => {
                  const items = showAllSuggestions ? taskSuggestions : filteredSuggestions;
                  if (items.length === 0) return null;
                  const inputEl = taskInputRef.current;
                  if (!inputEl) return null;
                  const rect = inputEl.getBoundingClientRect();
                  return (
                    <div
                      className="fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto scrollbar-thin"
                      style={{
                        left: rect.left + 'px',
                        top: (rect.bottom + 4) + 'px',
                        width: rect.width + 'px',
                        maxHeight: '300px',
                        overscrollBehavior: 'contain',
                        scrollbarWidth: 'thin',
                      }}
                    >
                      {items.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-gray-100 last:border-b-0"
                          onMouseDown={e => {
                            e.preventDefault();
                            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                            setNewTask({ ...newTask, name: s }); setShowAllSuggestions(false);
                            setShowTaskDropdown(false);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Weekly Gantt Chart ── */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Week Navigation */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <button
                    onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">
                    {monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Gantt Chart Grid */}
                <div className="overflow-x-auto">
                  {/* ── Header Row: Day names ── */}
                  <div className="gantt-grid grid min-w-[900px] border-b border-gray-200 bg-gray-100" style={{ gridTemplateColumns: `${taskColWidth}px repeat(${monthDays.length},1fr)` }}>
                    <div className="px-4 py-2.5 text-xs font-bold text-gray-600 border-r-2 border-gray-200 uppercase tracking-wider flex items-center relative">
                      Task
                      {/* Resize Handle */}
                      <div
                        ref={resizeRef}
                        onMouseDown={handleResizeStart}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors z-10"
                        title="Drag to resize task column"
                      />
                    </div>
                    {monthDays.map((day, i) => {
                      const isToday = formatDate(day) === formatDate(new Date());
                      const dayOfWeek = day.getDay(); // 0=Sun, 1=Mon...
                      const dayName = DAY_NAMES_SHORT[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
                      const isFirst = day.getDate() === 1;
                      return (
                        <div
                          key={i}
                          className={`px-1 py-1.5 text-center text-[10px] font-semibold border-r border-gray-200 last:border-r-0 ${
                            isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-500'
                          }`}
                        >
                          {isFirst || dayOfWeek === 1 ? <div className="text-[8px] opacity-60">{dayName}</div> : <div className="h-3" />}
                          <div className={`${isToday ? 'font-bold' : ''} ${dayOfWeek === 0 || dayOfWeek === 6 ? 'text-gray-400' : ''}`}>{day.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Task Rows ── */}
                  {ganttTasks.length === 0 ? <div className="text-center py-12 text-gray-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks yet. Click <strong>Add New Task</strong> to create one.</p>
                    </div> : ganttTasks.map((task, index) => {
                    const plannedStyle = getBarStyle(task.planned_start, task.planned_end, monthStart);
                    const actualStyle = getBarStyle(task.actual_start, task.actual_end, monthStart);

                    return (
                      <div key={task.id} className="border-b border-gray-100 last:border-b-0 group hover:bg-gray-50/50 transition-colors">
                        <div className="gantt-grid grid min-w-[700px]" style={{ gridTemplateColumns: `${taskColWidth}px repeat(7,1fr)` }}>
                          {/* ── Left panel: info + controls ── */}
                          <div className="px-4 py-2 border-r-2 border-gray-200 bg-gray-50/80 flex flex-col justify-center gap-1.5 relative">
                            {/* Resize Handle */}
                            <div
                              onMouseDown={handleResizeStart}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors z-10"
                              title="Drag to resize task column"
                            />
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-md bg-gray-200 text-[10px] font-bold text-gray-500 flex-shrink-0">{index + 1}</span>
                              <span className="text-sm font-bold text-gray-900 truncate leading-tight">{task.name}</span>
                              <button
                                onClick={() => handleEditTaskDates(task)}
                                className="p-0.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit planned dates"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-0.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-3 pl-7">

                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-[9px] text-gray-400">Progress:</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={task.progress}
                                  onChange={e => handleUpdateTaskProgress(task, parseInt(e.target.value))}
                                  className="w-14 h-1 accent-blue-600"
                                />
                                <span className="text-xs font-bold text-gray-600 w-7 text-right">{task.progress}%</span>
                              </div>
                            </div>
                          </div>

                          {/* ── Gantt bars area (7 columns) ── */}
                          <div className="relative col-span-7 h-12 border-r border-gray-100">
                            {/* Day grid lines */}
                            {/* Day separators as thin lines instead of border-r (to keep bar alignment) */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {[1,2,3,4,5,6].map(i => (
                                <div key={i} className="w-full h-full flex" style={{ flex: '1 1 0%' }}>
                                  <div className="w-px bg-gray-100 h-full ml-auto" />
                                </div>
                              ))}
                              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                                {[0,1,2,3,4,5,6].map(i => (
                                  <div key={i} className={`${i % 2 === 0 ? '' : 'bg-gray-50/30'}`} />
                                ))}
                              </div>
                            </div>

                            {/* Planned bar (top half) */}
                            <div className="absolute inset-x-0 top-0 h-6 flex items-center">
                              {plannedStyle ? (
                                <div
                                  className="h-[18px] bg-blue-500/70 cursor-pointer hover:bg-blue-500/90 transition-colors relative"
                                  style={{ left: plannedStyle.left, width: plannedStyle.width, minWidth: '4px', position: 'absolute' }}
                                  title={`Planned: ${task.planned_start} → ${task.planned_end}`}
                                >
                                  {parseFloat(plannedStyle.width) > 8 && (
                                    <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white truncate leading-none">
                                      {formatDMY(task.planned_start)} – {formatDMY(task.planned_end)}
                                    </span>
                                  )}
                                </div>
                              ) : task.planned_start ? (
                                <div
                                  className="h-[18px] bg-blue-300/50 cursor-pointer"
                                  style={{ left: '1%', width: '6px', position: 'absolute' }}
                                  title={`Planned: ${task.planned_start} → ${task.planned_end || '?'}`}
                                />
                              ) : null}
                            </div>

                            {/* Actual bar (bottom half) */}
                            <div className="absolute inset-x-0 bottom-0 h-6 flex items-center">
                              {actualStyle ? (
                                <div
                                  className="h-[18px] bg-green-500/80 cursor-pointer hover:bg-green-500/95 transition-colors relative"
                                  style={{ left: actualStyle.left, width: actualStyle.width, minWidth: '4px', position: 'absolute' }}
                                  title={`Actual: ${task.actual_start || '?'} → ${task.actual_end || '?'}`}
                                >
                                  {parseFloat(actualStyle.width) > 8 && (
                                    <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white truncate leading-none">
                                      {formatDMY(task.actual_start)} – {formatDMY(task.actual_end)}
                                    </span>
                                  )}
                                </div>
                              ) : task.actual_start ? (
                                <div
                                  className="h-[18px] bg-green-400/60 cursor-pointer"
                                  style={{ left: '1%', width: '6px', position: 'absolute' }}
                                  title={`Actual: ${task.actual_start}`}
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-500/80" />
                    <span className="text-[10px] text-gray-500">Planned</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-green-500/80" />
                    <span className="text-[10px] text-gray-500">Actual</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-gray-400">Task progress:</span>
                    <input type="range" min="0" max="100" className="w-16 h-1" disabled />
                  </div>
                </div>
              </div>

            {ganttTasks.length > 0 && !process.step4_complete && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleSaveStep(4, JSON.stringify(ganttTasks), true)}
                  className="btn-primary flex items-center gap-2"
                >
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
                        <input
                          type="text"
                          className="input-base flex-1"
                          placeholder="YYYY-MM-DD"
                          value={editPlannedStart}
                          onChange={e => setEditPlannedStart(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setDatePickerTarget('edit_start_' + Date.now())}
                          className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                          title="Pick date from calendar"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Planned End</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          className="input-base flex-1"
                          placeholder="YYYY-MM-DD"
                          value={editPlannedEnd}
                          onChange={e => setEditPlannedEnd(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setDatePickerTarget('edit_end_' + Date.now())}
                          className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                          title="Pick date from calendar"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
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
        )}

        {activeStep === 5 && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{PROCESS_STEP_LABELS[5].label}</h2>
                <p className="text-sm text-gray-500">{PROCESS_STEP_LABELS[5].description}</p>
              </div>
            </div>

            {/* ════════════════════════════════════════════ */}
            {/* Section 1: Server Folder Path & Browser   */}
            {/* ════════════════════════════════════════════ */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-800">Server Folder</h3>
                <span className="text-[10px] text-gray-400 font-normal ml-auto">Paste the company server folder path to browse files</span>
              </div>
              <div className="p-5 space-y-4">
                {/* Folder Path Input + Buttons */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input-base w-full pl-9 text-sm font-mono"
                      placeholder="\\server\company\projects\ProjectName\ or C:\Projects\..."
                      value={folderPath}
                      onChange={e => { setFolderPath(e.target.value); setFolderError(''); }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!folderPath.trim()) return;
                      setFolderLoading(true);
                      setFolderError('');
                      try {
                        const result = await openFolder(folderPath.trim());
                        setFolderError(result.message);
                        setTimeout(() => setFolderError(''), 3000);
                      } catch (e: any) {
                        setFolderError(e.response?.data?.detail || 'Failed to open folder');
                      } finally {
                        setFolderLoading(false);
                      }
                    }}
                    disabled={folderLoading || !folderPath.trim()}
                    className="btn-primary flex items-center gap-2 px-4 py-2.5 whitespace-nowrap"
                    title="Open folder in Windows Explorer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Folder
                  </button>
                  <button
                    onClick={async () => {
                      if (!folderPath.trim()) return;
                      setFolderLoading(true);
                      setFolderError('');
                      try {
                        const result = await listFolder(folderPath.trim());
                        setFolderItems(result.items);
                        setCurrentFolderPath(result.folder_path);
                      } catch (e: any) {
                        setFolderError(e.response?.data?.detail || 'Failed to list folder');
                        setFolderItems([]);
                      } finally {
                        setFolderLoading(false);
                      }
                    }}
                    disabled={folderLoading || !folderPath.trim()}
                    className="btn-secondary flex items-center gap-2 px-4 py-2.5 whitespace-nowrap"
                    title="Browse files in this folder"
                  >
                    <FileText className="w-4 h-4" />
                    Browse
                  </button>
                </div>

                {folderError && (
                  <div className={`text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                    folderError.includes('Opened') || folderError.includes('success')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {folderError}
                  </div>
                )}

                {/* Folder Content Browser */}
                {folderLoading ? (
                  <div className="text-center py-8 text-gray-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Loading folder contents...</p>
                  </div>
                ) : folderItems.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200 flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      {currentFolderPath}
                      <span className="ml-auto text-gray-400 font-normal">{folderItems.length} item(s)</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                      {/* Parent folder link */}
                      {currentFolderPath && (
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
                          onClick={async () => {
                            const parent = currentFolderPath.split('\\').slice(0, -1).join('\\');
                            const parent2 = currentFolderPath.split('/').slice(0, -1).join('/');
                            const parentPath = parent.length > parent2.length ? parent : parent2;
                            if (parentPath && parentPath !== currentFolderPath) {
                              setFolderLoading(true);
                              try {
                                const result = await listFolder(parentPath);
                                setFolderItems(result.items);
                                setCurrentFolderPath(result.folder_path);
                                setFolderPath(parentPath);
                              } catch (e: any) {
                                setFolderError(e.response?.data?.detail || 'Failed');
                              } finally {
                                setFolderLoading(false);
                              }
                            }
                          }}
                        >
                          <Folder className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-medium text-gray-700">.. (Parent folder)</span>
                        </button>
                      )}
                      {folderItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group">
                          {item.is_dir ? (
                            <button
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                              onClick={async () => {
                                setFolderLoading(true);
                                try {
                                  const result = await listFolder(item.path);
                                  setFolderItems(result.items);
                                  setCurrentFolderPath(result.folder_path);
                                  setFolderPath(result.folder_path);
                                } catch (e: any) {
                                  setFolderError(e.response?.data?.detail || 'Failed');
                                } finally {
                                  setFolderLoading(false);
                                }
                              }}
                            >
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
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg"
                                  title="Open file with default program"
                                  onClick={async () => {
                                    try {
                                      const result = await openFolder(item.path);
                                    } catch {}
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : folderPath.trim() && !folderLoading ? (
                  <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click <strong>Browse</strong> to view files in this folder</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ════════════════════════════════════════════ */}
            {/* Section 2: All Uploaded Files Collection    */}
            {/* ════════════════════════════════════════════ */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-gray-800">All Uploaded Files</h3>
                <span className="text-[10px] text-gray-400 font-normal ml-auto">
                  Collect files to copy to the company server folder
                </span>
                <button
                  onClick={async () => {
                    setFilesLoading(true);
                    try {
                      const files = await getProjectFiles(projectId);
                      setAllProjectFiles(files);
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setFilesLoading(false);
                    }
                  }}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${filesLoading ? 'animate-spin' : ''}`} />
                  Load Files
                </button>
              </div>

              {/* Files List */}
              <div className="p-5">
                {filesLoading ? (
                  <div className="text-center py-6 text-gray-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Loading files...</p>
                  </div>
                ) : allProjectFiles.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click <strong>Load Files</strong> to see all uploaded files for this project</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Copy target folder input */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          className="input-base w-full pl-9 text-sm font-mono"
                          placeholder="Paste server folder path to copy files..."
                          value={copyTargetFolder}
                          onChange={e => setCopyTargetFolder(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!copyTargetFolder.trim() || selectedFiles.size === 0) return;
                          setCopying(true);
                          setCopyResult('');
                          let successCount = 0;
                          let failCount = 0;
                          for (const fileId of selectedFiles) {
                            const file = allProjectFiles.find(f => f.id === fileId);
                            if (!file) continue;
                            try {
                              await copyFileToFolder(file.file_path, copyTargetFolder.trim());
                              successCount++;
                            } catch {
                              failCount++;
                            }
                          }
                          setCopyResult(`Copied ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
                          setSelectedFiles(new Set());
                          setCopying(false);
                          setTimeout(() => setCopyResult(''), 4000);
                        }}
                        disabled={copying || selectedFiles.size === 0 || !copyTargetFolder.trim()}
                        className="btn-primary flex items-center gap-2 px-4 py-2.5 whitespace-nowrap"
                      >
                        <Copy className="w-4 h-4" />
                        {copying ? 'Copying...' : `Copy (${selectedFiles.size})`}
                      </button>
                    </div>

                    {copyResult && (
                      <div className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200">
                        <Check className="w-3.5 h-3.5" />
                        {copyResult}
                      </div>
                    )}

                    {/* Select All / Deselect */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectedFiles.size === allProjectFiles.length) {
                            setSelectedFiles(new Set());
                          } else {
                            setSelectedFiles(new Set(allProjectFiles.map(f => f.id)));
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {selectedFiles.size === allProjectFiles.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className="text-xs text-gray-400">
                        {selectedFiles.size} of {allProjectFiles.length} selected
                      </span>
                    </div>

                    {/* File List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                      {allProjectFiles.map(file => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            selectedFiles.has(file.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedFiles.has(file.id)}
                            onChange={() => {
                              const next = new Set(selectedFiles);
                              if (next.has(file.id)) next.delete(file.id);
                              else next.add(file.id);
                              setSelectedFiles(next);
                            }}
                          />
                          <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{file.original_filename}</span>
                            <span className="text-[10px] text-gray-400">
                              {file.stage === 'process' ? 'Process' : file.stage} 
                              {file.step_name ? ` / ${file.step_name}` : ''}
                              {' · '}
                              {file.file_size < 1024 ? `${file.file_size} B` : file.file_size < 1024 * 1024 ? `${(file.file_size / 1024).toFixed(1)} KB` : `${(file.file_size / (1024 * 1024)).toFixed(1)} MB`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={`/api/files/${file.id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`/api/files/${file.id}/download`}
                              className="p-1.5 text-green-500 hover:bg-green-100 rounded-lg"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════ */}
            {/* Section 3: Final Review Notes & Complete    */}
            {/* ════════════════════════════════════════════ */}
            <div className={`bg-white border border-gray-200 rounded-xl p-5 ${!editMode ? 'pointer-events-none opacity-60 select-none' : ''}`}>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                Final Review Notes
                <span className="text-[10px] font-normal text-gray-400 ml-1">(optional)</span>
              </h3>
              <textarea
                className="input-base w-full h-24 resize-none text-sm"
                placeholder="Enter final review notes or comments (optional)..."
                value={step5Data}
                onChange={e => setStep5Data(e.target.value)}
              />

              {/* Folder path validation warning */}
              {!folderPath.trim() && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Please specify a Folder Path</p>
                    <p className="mt-0.5">You must enter a server folder path before you can save and proceed to the next step</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mt-3">
                <div className="text-xs text-gray-400">
                  {folderPath.trim() ? (
                    <span className="text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Folder path set</span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Folder path required</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      // Save folder path first
                      if (folderPath.trim()) {
                        try {
                          await updateProcess(projectId, { folder_path: folderPath.trim() });
                        } catch (e) {
                          console.error('Failed to save folder path', e);
                        }
                      }
                      // Then save step 5 with notes (optional)
                      await handleSaveStep(5, step5Data, true);
                    }}
                    disabled={saving || !folderPath.trim()}
                    className="btn-primary flex items-center gap-2"
                    title={!folderPath.trim() ? 'Please enter a Folder Path first' : 'Save & Complete'}
                  >
                    <Save className="w-4 h-4" /> {process.step5_complete ? 'Update & Complete' : 'Save & Complete'}
                  </button>
                  {allStepsComplete && project?.current_stage === 'process' && (
                    <button onClick={handleAdvanceToOutputs} disabled={!editMode} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
                    Advance to Outputs <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Progress Overview - Compact Stacked Bar (like card) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Process Progress</h3>
          <span className="text-sm font-bold text-blue-600">{(() => { const s13 = project?.current_stage === 'completed' ? 10 : (process ? ([1,2,3].filter(s => getStepStatus(s) === 'completed').length / 3) * 10 : 0); const s4 = project?.current_stage === 'completed' ? 79 : (ganttTasks.length > 0 ? (ganttTasks.filter(t => t.progress >= 100).length / ganttTasks.length) * 79 : 0); const s5 = project?.current_stage === 'completed' ? 1 : (process?.step5_complete ? 1 : 0); const out = project?.current_stage === 'completed' ? 10 : (() => { const o = project?.outputs; if (!o) return 0; const done = [1,2,3,4,5,6].filter(i => o[`step${i}_complete` as keyof typeof o]).length; return (done / 6) * 10; })(); return Math.round(s13 + s4 + s5 + out); })()}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 flex overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 10 : (process ? ([1,2,3].filter(s => getStepStatus(s) === 'completed').length / 3) * 10 : 0)}%` }} title={`Steps 1-3: ${process ? [1,2,3].filter(s => getStepStatus(s) === 'completed').length : 0}/3 (10%)`} />
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 79 : (ganttTasks.length > 0 ? (ganttTasks.filter(t => t.progress >= 100).length / ganttTasks.length) * 79 : 0)}%` }} title={`Step 4: ${ganttTasks.filter(t => t.progress >= 100).length}/${ganttTasks.length} tasks (79%)`} />
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 1 : (process?.step5_complete ? 1 : 0)}%` }} title={`Step 5: ${process?.step5_complete ? 'Done' : 'Pending'} (1%)`} />
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${project?.current_stage === 'completed' ? 10 : (() => { const o = project?.outputs; if (!o) return 0; const done = [1,2,3,4,5,6].filter(i => o[`step${i}_complete` as keyof typeof o]).length; return (done / 6) * 10; })()}%` }} title={`Outputs: ${(() => { const o = project?.outputs; if (!o) return '0/6 (10%)'; const done = [1,2,3,4,5,6].filter(i => o[`step${i}_complete` as keyof typeof o]).length; return `${done}/6 (10%)`; })()}`} />
        </div>
      </div>
    </div>
  );
}
