import { useNavigate } from 'react-router-dom';
import { CalendarDays, Building2, User, Cpu } from 'lucide-react';
import type { Project } from '../types';

interface Props {
  project: Project;
}

// Work-type colour mapping
function getWorkTypeStyle(workType: string | undefined): {
  badgeBg: string; badgeText: string; divider: string; cardBorder: string;
} {
  if (!workType) return {
    badgeBg: 'bg-gray-100', badgeText: 'text-gray-500',
    divider: 'border-gray-150', cardBorder: 'border-gray-200',
  };
  const wt = workType.trim().toLowerCase();
  if (wt === 'evaluation') return {
    badgeBg: 'bg-orange-50', badgeText: 'text-orange-700',
    divider: 'border-orange-100', cardBorder: 'border-orange-200',
  };
  if (wt.startsWith('investigation')) return {
    badgeBg: 'bg-blue-50', badgeText: 'text-blue-700',
    divider: 'border-blue-100', cardBorder: 'border-blue-200',
  };
  return {
    badgeBg: 'bg-gray-100', badgeText: 'text-gray-500',
    divider: 'border-gray-200', cardBorder: 'border-gray-200',
  };
}

// Due-date info
function getDueInfo(dueDate: string | undefined): {
  dateLabel: string; statusLabel: string; diff: number;
  chipBg: string; chipText: string;
} {
  if (!dueDate) return {
    dateLabel: 'No due date', statusLabel: '', diff: Infinity,
    chipBg: 'bg-gray-100', chipText: 'text-gray-400',
  };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateLabel = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (diff < 0)   return { dateLabel, statusLabel: `${Math.abs(diff)}d overdue`, diff, chipBg: 'bg-red-100',    chipText: 'text-red-700' };
  if (diff === 0) return { dateLabel, statusLabel: 'Due today',                  diff, chipBg: 'bg-red-100',    chipText: 'text-red-700' };
  if (diff <= 2)  return { dateLabel, statusLabel: `${diff}d left`,              diff, chipBg: 'bg-amber-100',  chipText: 'text-amber-700' };
  if (diff <= 7)  return { dateLabel, statusLabel: `${diff}d left`,              diff, chipBg: 'bg-yellow-50',  chipText: 'text-yellow-700' };
  return           { dateLabel, statusLabel: `${diff}d left`,                    diff, chipBg: 'bg-green-50',   chipText: 'text-green-700' };
}

export default function ProjectCard({ project }: Props) {
  const navigate = useNavigate();
  const wt = getWorkTypeStyle(project.work_type);
  const due = getDueInfo(project.due_date);
  const isOverdue = due.diff < 0;

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className={`bg-white rounded-xl border ${isOverdue ? 'border-red-300' : wt.cardBorder} cursor-pointer overflow-hidden group transition-shadow hover:shadow-sm`}
    >
      {/* ── Type badge strip ── */}
      <div className={`px-3 py-1 border-b ${wt.badgeBg} ${wt.divider}`}>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${wt.badgeText}`}>
          {project.work_type || 'General'}
        </span>
      </div>

      {/* ── Card body ── */}
      <div className="px-3 pt-2.5 pb-0">

        {/* Project title — most prominent */}
        <p className="text-[13.5px] font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-600 transition-colors mb-2">
          {project.title}
        </p>

        {/* Meta: bearing + customer + requester */}
        <div className="space-y-1 mb-2.5">
          {project.bearing_no && (
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <span className="text-[11px] font-mono text-gray-600 truncate">{project.bearing_no}</span>
            </div>
          )}
          {(project.customer_name || project.requester) && (
            <div className="flex items-center gap-3 min-w-0">
              {project.customer_name && (
                <div className="flex items-center gap-1 min-w-0">
                  <Building2 className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 truncate">{project.customer_name}</span>
                </div>
              )}
              {project.requester && (
                <div className="flex items-center gap-1 min-w-0">
                  <User className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 truncate">{project.requester}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Date row — full width, visually separated ── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <CalendarDays className={`w-3 h-3 flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
          <span className={`text-[11px] ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {due.dateLabel}
          </span>
        </div>
        {due.statusLabel && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${due.chipBg} ${due.chipText}`}>
            {due.statusLabel}
          </span>
        )}
      </div>

    </div>
  );
}

