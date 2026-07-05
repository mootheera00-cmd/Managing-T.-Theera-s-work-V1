import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Project } from '../types';
import { STAGE_LABELS } from '../types';
import { startProcess } from '../api/client';
import { formatDMY } from '../utils/dateUtils';

interface Props {
  project: Project;
  onUpdate: () => void;
}

const workTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  'Evaluation': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Investigation': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Investigation for Benchmark': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'Investigation for Warranty': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Maintenance': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Improvement': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Others': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return new Date(dueDate + 'T00:00:00') < now;
}

export default function ProjectCard({ project, onUpdate }: Props) {
  const navigate = useNavigate();
  const colors = workTypeColors[project.work_type || ''] || workTypeColors['Others'];
  const overdue = isOverdue(project.due_date);

  const handleStartProcess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await startProcess(project.id);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const stageDotColor = {
    work_request: 'bg-gray-400',
    process: 'bg-amber-400',
    outputs: 'bg-green-400',
    completed: 'bg-blue-400',
  }[project.current_stage] || 'bg-gray-400';

  // Stacked progress calculations
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

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer group relative"
    >
      {/* Work Type Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}>
          {project.work_type || 'N/A'}
        </span>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${stageDotColor}`} />
          <span className="text-[10px] text-gray-400">{STAGE_LABELS[project.current_stage]}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-gray-800 mb-2 line-clamp-2 leading-tight">
        {project.title}
      </h3>

      {/* Info */}
      <div className="space-y-1 mb-3">
        {project.customer_name && (
          <p className="text-xs text-gray-500 truncate">
            {project.requester && `${project.requester} • `}{project.customer_name}
          </p>
        )}
        {project.bearing_no && (
          <p className="text-xs text-gray-400 truncate">Bearing: {project.bearing_no}</p>
        )}
      </div>

      {/* Progress - Stacked Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400">Progress</span>
          <span className="text-[10px] font-semibold text-gray-600">{calcProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 flex overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${steps13Width}%` }} />
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${step4Width}%` }} />
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${step5Width}%` }} />
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${outputsWidth}%` }} />
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDMY(project.received_date)}
        </span>
        <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
          <Clock className="w-3 h-3" />
          {formatDMY(project.due_date)}
          {overdue && <AlertCircle className="w-3 h-3" />}
        </span>
      </div>

      {/* Start Process Button (for Work Request stage) */}
      {project.current_stage === 'work_request' && (
        <button
          onClick={handleStartProcess}
          className="mt-3 w-full btn-primary text-xs py-1.5 flex items-center justify-center gap-1"
        >
          <Play className="w-3 h-3" /> Start Process
        </button>
      )}

      {/* Chevron */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </div>
  );
}
