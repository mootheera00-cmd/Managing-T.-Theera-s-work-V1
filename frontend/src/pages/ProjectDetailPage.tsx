import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Trash2, Edit3, Save, X,
  CheckCircle2, Circle, Loader2
} from 'lucide-react';
import { getProject, updateProject, deleteProject } from '../api/client';
import type { Project } from '../types';
import { STAGE_LABELS } from '../types';
import ProgressBar from '../components/ProgressBar';
import WorkRequestForm from '../components/WorkRequestForm';
import ProcessForm from '../components/ProcessForm';
import OutputForm from '../components/OutputForm';
import ConfirmDialog from '../components/ConfirmDialog';

const STAGES = ['work_request', 'process', 'outputs', 'completed'] as const;

function StageIndicator({ current }: { current: string }) {
  const idx = STAGES.indexOf(current as any);
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`w-8 h-0.5 ${done ? 'bg-gray-900' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                done ? 'bg-gray-900 text-white' :
                active ? 'bg-gray-900 text-white ring-2 ring-gray-300' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={`text-[10px] mt-1 whitespace-nowrap ${
                active ? 'text-gray-900 font-bold' : 'text-gray-400'
              }`}>
                {STAGE_LABELS[s]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [editTitle, setEditTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getProject(Number(id));
      setProject(data);
      if (!activeTab) {
        setActiveTab(data.current_stage === 'completed' ? 'outputs' : data.current_stage);
      }
    } catch (e) {
      console.error('Failed to fetch project', e);
    } finally {
      setLoading(false);
    }
  }, [id, activeTab]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleUpdate = (updated: Project) => {
    setProject(updated);
  };

  const handleTitleSave = async () => {
    if (!project || !titleInput.trim()) return;
    try {
      const updated = await updateProject(project.id, { title: titleInput.trim() });
      setProject(updated);
      setEditTitle(false);
    } catch (e) {
      console.error('Failed to update title', e);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await deleteProject(project.id);
      navigate('/');
    } catch (e) {
      console.error('Failed to delete project', e);
    }
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Project not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-gray-600 hover:underline text-sm">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const tabs = ['work_request', 'process', 'outputs'] as const;

  const wr = project.work_request;
  const wrWtKey = (wr?.work_type || '').toLowerCase();
  const wrWtBadge = wrWtKey === 'evaluation'
    ? 'bg-orange-100 text-orange-700'
    : (wrWtKey === 'investigation' || wrWtKey === 'investigation for benchmark' || wrWtKey === 'investigation for warranty')
    ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';

  const wrDueInfo = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = wr?.due_date ? new Date(wr.due_date) : null;
    if (due) due.setHours(0, 0, 0, 0);
    const received = wr?.received_date ? new Date(wr.received_date) : null;
    if (received) received.setHours(0, 0, 0, 0);

    const daysLeft = due ? Math.floor((due.getTime() - today.getTime()) / 86400000) : null;
    const totalSpan = (received && due) ? Math.floor((due.getTime() - received.getTime()) / 86400000) : null;

    let color = 'text-slate-600';
    let prefix = '';
    let badge = '—';
    let badgeBg = 'bg-slate-100 text-slate-500';

    if (daysLeft !== null) {
      if (daysLeft < 0) {
        color = 'text-red-600 font-bold'; prefix = 'Overdue · ';
        badge = `${Math.abs(daysLeft)}d overdue`; badgeBg = 'bg-red-100 text-red-700';
      } else if (daysLeft === 0) {
        color = 'text-red-600 font-bold'; prefix = 'Today · ';
        badge = 'Due today'; badgeBg = 'bg-red-100 text-red-700';
      } else if (daysLeft === 1) {
        color = 'text-orange-600 font-semibold'; prefix = 'Tomorrow · ';
        badge = '1 day left'; badgeBg = 'bg-orange-100 text-orange-700';
      } else if (daysLeft <= 7) {
        color = 'text-amber-600 font-semibold'; prefix = '';
        badge = `${daysLeft} days left`; badgeBg = 'bg-amber-100 text-amber-700';
      } else {
        color = 'text-slate-700'; prefix = '';
        badge = `${daysLeft} days left`; badgeBg = 'bg-green-100 text-green-700';
      }
    }

    return { color, prefix, badge, badgeBg, daysLeft, totalSpan };
  })();

  const fmtWrDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-2">
      {/* Stage indicator & Progress — with title + delete integrated */}
      <div className="card p-3 space-y-1.5">
        {/* Top row: back button + title/date (left) + delete (right) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {editTitle ? (
              <div className="flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  className="text-base font-bold border-b-2 border-gray-900 focus:outline-none bg-transparent px-1 min-w-0 w-full"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                />
                <button onClick={handleTitleSave} className="p-1 text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0">
                  <Save className="w-3 h-3" />
                </button>
                <button onClick={() => setEditTitle(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                <h1 className="text-base font-bold text-slate-800 truncate">{project.title}</h1>
                <button
                  onClick={() => { setTitleInput(project.title); setEditTitle(true); }}
                  className="p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-gray-400 ml-0.5 hidden sm:inline">
                  {project.year} &middot; {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
            title="Delete project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-center scale-90 -my-0.5">
          <StageIndicator current={project.current_stage} />
        </div>
        <ProgressBar value={project.progress_percent} />
        <div className="flex items-center justify-between text-[11px] text-gray-500 -mt-0.5">
          <span>Status: <strong className="capitalize text-gray-700">{project.status}</strong></span>
          <span>Stage: <strong className="text-gray-700">{STAGE_LABELS[project.current_stage]}</strong></span>
        </div>
      </div>

      {/* Work Request Info — always visible on every tab */}
      {wr && (
        <div className="card px-4 py-3">
          <div className="flex items-stretch divide-x divide-gray-100">
            <div className="flex-1 pr-4">
              <p className="text-[10px] text-slate-400 mb-1">Work Type</p>
              <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${wrWtBadge}`}>
                {wr.work_type || '—'}
              </span>
            </div>
            <div className="flex-1 px-4">
              <p className="text-[10px] text-slate-400 mb-1">Bearing No.</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{wr.bearing_no || '—'}</p>
            </div>
            <div className="flex-1 px-4">
              <p className="text-[10px] text-slate-400 mb-1">Customer Name</p>
              <p className="text-sm font-medium text-slate-700 truncate">{wr.customer_name || '—'}</p>
            </div>
            <div className="flex-1 px-4">
              <p className="text-[10px] text-slate-400 mb-1">Requester</p>
              <p className="text-sm font-medium text-slate-700 truncate">{wr.requester || '—'}</p>
            </div>
            <div className="flex-1 px-4">
              <p className="text-[10px] text-slate-400 mb-1">Received Date</p>
              <p className="text-sm font-medium text-slate-700">
                {wr.received_date ? fmtWrDate(wr.received_date) : '—'}
              </p>
            </div>
            <div className="flex-1 px-4">
              <p className="text-[10px] text-slate-400 mb-1">Due Date</p>
              <p className={`text-sm font-semibold ${wrDueInfo.color}`}>
                {wr.due_date ? `${wrDueInfo.prefix}${fmtWrDate(wr.due_date)}` : '—'}
              </p>
            </div>
            <div className="flex-[1.2] pl-4">
              <p className="text-[10px] text-slate-400 mb-1">Days Remaining</p>
              <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${wrDueInfo.badgeBg}`}>
                {wrDueInfo.badge}
              </span>
              {wrDueInfo.totalSpan !== null && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Total span: {wrDueInfo.totalSpan} days
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeTab === tab
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {STAGE_LABELS[tab]}
            {project.current_stage === tab && (
              <span className="inline-block w-2 h-2 bg-gray-900 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-4">
        {activeTab === 'work_request' && (
          <WorkRequestForm
            project={project}
            onUpdate={handleUpdate}
            onStart={p => { handleUpdate(p); setActiveTab('process'); }}
          />
        )}
        {activeTab === 'process' && (
          <ProcessForm project={project} onUpdate={handleUpdate} />
        )}
        {activeTab === 'outputs' && (
          <OutputForm project={project} onUpdate={handleUpdate} />
        )}
      </div>

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete "${project.title}"? All data and files will be permanently removed. This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
