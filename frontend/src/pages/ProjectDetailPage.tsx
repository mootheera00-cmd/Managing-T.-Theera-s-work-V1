import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Trash2, ChevronRight, Settings,
  FileText, ClipboardList, Clock, CheckCircle2, Check,
  AlertCircle, ExternalLink, Eye, ListChecks
} from 'lucide-react';
import { getProject, deleteProject, startProcess, updateProject } from '../api/client';
import type { Project } from '../types';
import { STAGE_LABELS, WORK_TYPES, PROCESS_STEP_LABELS, OUTPUT_STEP_LABELS } from '../types';
import FileUpload from '../components/FileUpload';
import ConfirmDialog from '../components/ConfirmDialog';
import OutputForm from '../components/OutputForm';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [error, setError] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      const p = await getProject(projectId);
      setProject(p);
      setEditTitle(p.title);
    } catch (e) {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleStartProcess = async () => {
    try {
      await startProcess(projectId);
      await fetchProject();
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
      setEditing(false);
      await fetchProject();
    } catch (e) {
      setError('Failed to update title');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!project) return <div className="p-8 text-center text-red-500">Project not found</div>;

  const canStartProcess = project.current_stage === 'work_request' &&
    project.requester && project.customer_name && project.work_type &&
    project.bearing_no && project.due_date;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projects')} className="btn-secondary p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input-base text-xl font-bold"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    autoFocus
                  />
                  <button onClick={handleSaveTitle} className="btn-primary text-sm">Save</button>
                  <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
                  <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">
                {project.work_type} • {project.customer_name} • {project.bearing_no}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                project.current_stage === 'work_request' ? 'bg-gray-100 text-gray-600' :
                project.current_stage === 'process' ? 'bg-amber-100 text-amber-700' :
                project.current_stage === 'outputs' ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {STAGE_LABELS[project.current_stage]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Primary action per stage ── */}
          {project.current_stage === 'process' && project.process && (
            <button
              onClick={() => navigate(`/project/${projectId}/process`)}
              className="btn-primary flex items-center gap-2 shadow-md"
            >
              <Settings className="w-4 h-4" /> Open Process <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {project.current_stage === 'outputs' && (
            <button
              onClick={() => {
                const el = document.getElementById('outputs-section');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="btn-primary flex items-center gap-2 shadow-md"
            >
              <ListChecks className="w-4 h-4" /> Open Outputs <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {project.current_stage === 'work_request' && canStartProcess && (
            <button onClick={handleStartProcess} className="btn-primary flex items-center gap-2 shadow-md">
              Start Process <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {/* ── Secondary: Review Process (for non-process stages that have data) ── */}
          {project.process && project.current_stage !== 'process' && (
            <button
              onClick={() => navigate(`/project/${projectId}/process`)}
              className="btn-secondary flex items-center gap-1.5 text-xs"
              title="View process steps history"
            >
              <Eye className="w-3.5 h-3.5" /> Review Process
            </button>
          )}
          {/* ── Delete (always visible) ── */}
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-secondary p-2 text-red-500 hover:bg-red-50" title="Delete project">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto">×</button>
        </div>
      )}

      {/* Progress - Stacked Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {(() => {
          const proc = project.process;
          const isCompleted = project.current_stage === 'completed';
          const steps13Done = proc ? [1,2,3].filter(s => proc[`step${s}_complete` as keyof typeof proc]).length : 0;
          const steps13Width = isCompleted ? 10 : (steps13Done / 3) * 10;
          const gantt = project.gantt_tasks || [];
          const ganttDone = gantt.filter(t => t.progress >= 100).length;
          const step4Width = isCompleted ? 79 : (gantt.length > 0 ? (ganttDone / gantt.length) * 79 : 0);
          const step5Width = isCompleted ? 1 : (proc?.step5_complete ? 1 : 0);
          const out = project.outputs;
          const outDone = out ? [1,2,3,4,5,6].filter(i => out[`step${i}_complete` as keyof typeof out]).length : 0;
          const outputsWidth = isCompleted ? 10 : (out ? (outDone / 6) * 10 : 0);
          const calcProgress = Math.round(steps13Width + step4Width + step5Width + outputsWidth);
          return (<>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Progress</span>
              <span className="text-sm font-bold text-blue-600">{calcProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 flex overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${steps13Width}%` }} title={`Steps 1-3: ${steps13Done}/3 (10%)`} />
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${step4Width}%` }} title={`Step 4: ${ganttDone}/${gantt.length} tasks (79%)`} />
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${step5Width}%` }} title={`Step 5: ${proc?.step5_complete ? 'Done' : 'Pending'} (1%)`} />
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${outputsWidth}%` }} title={`Outputs: ${outDone}/6 (10%)`} />
            </div>
          </>);
        })()}
      </div>

      {/* Project Info Cards */}
      {project.current_stage === 'work_request' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Work Request Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <label className="text-xs font-medium text-gray-500">Requester</label>
              <p className="text-sm font-semibold text-gray-800">{project.requester || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Customer</label>
              <p className="text-sm font-semibold text-gray-800">{project.customer_name || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Work Type</label>
              <p className="text-sm font-semibold text-gray-800">{project.work_type || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Bearing No.</label>
              <p className="text-sm font-semibold text-gray-800">{project.bearing_no || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Received Date</label>
              <p className="text-sm font-semibold text-gray-800">{project.received_date || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Due Date</label>
              <p className="text-sm font-semibold text-gray-800">{project.due_date || '-'}</p>
            </div>
          </div>
          {project.notes && (
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500">Notes</label>
              <p className="text-sm text-gray-700 mt-1">{project.notes}</p>
            </div>
          )}
          {!canStartProcess && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Fill in all required fields (Requester, Customer, Work Type, Bearing No., Due Date) to enable Start Process.
            </div>
          )}
        </div>
      )}

      {/* Process Summary - unified style with Outputs */}
      {project.process && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Gradient header (matches Outputs style) */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-gray-800">Process Steps</h3>
            <span className="text-[10px] text-gray-400 font-normal ml-auto">Steps 1-5 completed</span>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(stepNum => {
                const complete = project.process?.[`step${stepNum}_complete` as keyof typeof project.process];
                const label = PROCESS_STEP_LABELS[stepNum]?.label || `Step ${stepNum}`;
                const hasData = stepNum === 1 ? project.process?.step1_data :
                  stepNum === 2 ? project.process?.step2_data :
                  stepNum === 3 ? project.process?.step3_data :
                  stepNum === 4 ? project.process?.step4_data :
                  stepNum === 5 ? project.process?.step5_data : '';
                const ganttCount = project.gantt_tasks?.length || 0;
                const ganttDone = project.gantt_tasks?.filter(t => t.progress >= 100).length || 0;
                return (
                  <div key={stepNum} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {complete ? <Check className="w-4 h-4" /> : stepNum}
                      </div>
                      <div>
                        <span className={`text-sm ${complete ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                          {label}
                        </span>
                        {stepNum === 4 && ganttCount > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{ganttDone}/{ganttCount} tasks completed</p>
                        )}
                        {complete && hasData && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">{hasData}</p>
                        )}
                      </div>
                    </div>
                    {/* Status badge */}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      complete
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}>
                      {complete ? 'Done' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => navigate(`/project/${projectId}/process`)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Review all process steps
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Outputs */}
      {(project.current_stage === 'outputs' || project.current_stage === 'completed') && (
        <div id="outputs-section">
        <OutputForm
          projectId={projectId}
          project={project}
          onUpdate={fetchProject}
        />
        </div>
      )}

      {/* Files */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Files & Attachments</h2>
        <FileUpload
          projectId={projectId}
          stage={project.current_stage}
          files={project.files || []}
          onFilesChange={fetchProject}
        />
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
