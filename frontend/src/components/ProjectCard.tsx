import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Building2, Cpu, CheckCircle } from 'lucide-react';
import type { Project } from '../types';
import { startProcess } from '../api/client';

interface Props {
  project: Project;
  onRefresh?: () => void;
}

// Work-type colour mapping — Color-Coded Flat (solid bg, white text, white borders)
function getWorkTypeStyle(workType: string | undefined): {
  badgeBg: string; badgeText: string; cardBg: string; cardBorder: string; cardGlow: string;
  metaText: string; metaIcon: string; titleText: string;
} {
  const base = {
    badgeBg: '', badgeText: 'text-white/90',
    metaText: 'text-white/90', metaIcon: 'text-white/60', titleText: 'text-white',
    cardBorder: 'border-white/25',
  };
  if (!workType) return {
    ...base, cardBg: 'bg-slate-600', cardGlow: 'shadow-slate-500/30',
  };
  const wt = workType.trim().toLowerCase();
  if (wt === 'evaluation') return {
    ...base, cardBg: 'bg-orange-500', cardGlow: 'shadow-orange-400/30',
  };
  if (wt.startsWith('investigation')) return {
    ...base, cardBg: 'bg-blue-500', cardGlow: 'shadow-blue-400/30',
  };
  if (wt === 'education for internal' || wt === 'maintenance' || wt === 'improvement') return {
    ...base, cardBg: 'bg-teal-500', cardGlow: 'shadow-teal-400/30',
  };
  if (wt === 'tech. support' || wt === 'tech. support for s-pro' || wt === 'tech. support for shirozu ex') return {
    ...base, cardBg: 'bg-violet-500', cardGlow: 'shadow-violet-400/30',
  };
  if (wt === 'meeting with internal' || wt === 'leave' || wt === 'admin' || wt === 'hr') return {
    ...base, cardBg: 'bg-rose-500', cardGlow: 'shadow-rose-400/30',
  };
  return {
    ...base, cardBg: 'bg-slate-500', cardGlow: 'shadow-slate-400/30',
  };
}

// Due-date info
function getDueInfo(dueDate: string | undefined): {
  dateLabel: string; statusLabel: string; diff: number;
  chipBg: string; chipText: string;
} {
  if (!dueDate) return {
    dateLabel: 'No due date', statusLabel: '', diff: Infinity,
    chipBg: '', chipText: '',
  };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateLabel = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (diff <= 0) return {
    dateLabel, diff,
    statusLabel: diff === 0 ? 'Due today' : `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`,
    chipBg: 'bg-red-600', chipText: 'text-white',
  };
  if (diff <= 7) return {
    dateLabel, diff,
    statusLabel: `${diff} day${diff === 1 ? '' : 's'} left`,
    chipBg: 'bg-amber-400', chipText: 'text-amber-900',
  };
  return {
    dateLabel, diff,
    statusLabel: `${diff} day${diff === 1 ? '' : 's'} left`,
    chipBg: 'bg-emerald-400', chipText: 'text-emerald-900',
  };
}

export default function ProjectCard({ project, onRefresh }: Props) {
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const wt = getWorkTypeStyle(project.work_type);
  const due = getDueInfo(project.due_date);
  const isOverdue = due.diff < 0;
  const isWorkRequest = project.current_stage === 'work_request';

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAccepting(true);
    try {
      await startProcess(project.id);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to accept work', err);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className={`rounded-xl border cursor-pointer overflow-hidden group transition-all p-3 flex flex-col gap-2 hover:-translate-y-1 hover:shadow-xl ${wt.cardBg} ${wt.cardBorder} ${wt.cardGlow} shadow-lg`}
    >
      {/* Line 1: Badge + Due status */}
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${wt.badgeBg} ${wt.badgeText} flex-shrink-0 leading-tight backdrop-blur-sm`}>
          {project.work_type || 'G'}
        </span>
        {due.statusLabel && (
          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${due.chipBg} ${due.chipText} flex-shrink-0 leading-tight ml-auto`}>
            {due.statusLabel}
          </span>
        )}
      </div>

      {/* Line 2: Title — no background */}
      <p className={`text-[13px] font-extrabold text-white leading-snug line-clamp-1 group-hover:opacity-80 transition-opacity`}>
        {project.title}
      </p>

      {/* Line 3: Meta — all plain text without background */}
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/90 min-w-0 flex-wrap">
        {project.bearing_no && (
          <span className="flex items-center gap-1 truncate max-w-[120px]">
            <Cpu className="w-3 h-3 text-white/60 flex-shrink-0" />
            <span className="truncate">{project.bearing_no}</span>
          </span>
        )}
        {project.customer_name && (
          <span className="flex items-center gap-1 truncate max-w-[120px]">
            <Building2 className="w-3 h-3 text-white/60 flex-shrink-0" />
            <span className="truncate">{project.customer_name}</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          <CalendarDays className="w-3 h-3 text-white/60" />
          <span className="text-white/90">{due.dateLabel}</span>
        </span>
        {isWorkRequest && (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-gray-900/80 hover:bg-gray-900 rounded-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex-shrink-0"
          >
            <CheckCircle className="w-3 h-3" />
            <span>{accepting ? '...' : 'Start'}</span>
          </button>
        )}
      </div>
    </div>
  );
}


