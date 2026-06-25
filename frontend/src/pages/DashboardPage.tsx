import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, Layers, Activity, PauseCircle,
  AlertCircle, ChevronDown, ChevronUp, Inbox,
  FileText, Settings, ClipboardList, CheckCircle2, SlidersHorizontal,
} from 'lucide-react';
import { getProjects } from '../api/client';
import type { Project } from '../types';
import { STAGE_LABELS, WORK_TYPES } from '../types';
import ProjectCard from '../components/ProjectCard';
import ProjectForm from '../components/ProjectForm';

const KANBAN_STAGES = ['work_request', 'process', 'outputs'] as const;

const columnConfig: Record<string, {
  topBar: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  emptyIcon: React.ReactNode;
  label: string;
}> = {
  work_request: {
    topBar: 'bg-gray-900',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    badgeBg: 'bg-gray-200',
    badgeText: 'text-gray-600',
    emptyIcon: <ClipboardList className="w-8 h-8" />,
    label: STAGE_LABELS['work_request'],
  },
  process: {
    topBar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    emptyIcon: <Settings className="w-8 h-8" />,
    label: STAGE_LABELS['process'],
  },
  outputs: {
    topBar: 'bg-green-600',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    emptyIcon: <FileText className="w-8 h-8" />,
    label: STAGE_LABELS['outputs'],
  },
};

function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return new Date(dueDate + 'T00:00:00') < now;
}

function avgProgress(list: Project[]): number {
  if (!list.length) return 0;
  return Math.round(list.reduce((s, p) => s + p.progress_percent, 0) / list.length);
}

export default function DashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [workType, setWorkType] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { year };
      if (search.trim()) params.search = search.trim();
      const data = await getProjects(params as any);
      setProjects(data);
    } catch (e) {
      console.error('Failed to fetch projects', e);
    } finally {
      setLoading(false);
    }
  }, [year, search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = workType
    ? projects.filter(p => p.work_type?.toLowerCase() === workType.toLowerCase())
    : projects;

  const activeProjects = filteredProjects.filter(p => p.current_stage !== 'completed');
  const completedProjects = filteredProjects.filter(p => p.current_stage === 'completed');
  const pausedProjects = filteredProjects.filter(p => p.status === 'paused');
  const overdueProjects = activeProjects.filter(p => isOverdue(p.due_date));
  const inProgressCount = filteredProjects.filter(p => p.status === 'active' && p.current_stage !== 'completed').length;

  const years: number[] = [];
  for (let y = 2020; y <= 2099; y++) years.push(y);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const statCards = [
    {
      label: 'Total Active',
      value: activeProjects.length,
      icon: <Layers className="w-4 h-4" />,
      colors: 'bg-sky-50 text-sky-700',
      valueColor: 'text-sky-900',
    },
    {
      label: 'In Progress',
      value: inProgressCount,
      icon: <Activity className="w-4 h-4" />,
      colors: 'bg-emerald-50 text-emerald-700',
      valueColor: 'text-emerald-900',
    },
    {
      label: 'Paused',
      value: pausedProjects.length,
      icon: <PauseCircle className="w-4 h-4" />,
      colors: 'bg-amber-50 text-amber-700',
      valueColor: 'text-amber-900',
    },
    {
      label: 'Overdue',
      value: overdueProjects.length,
      icon: <AlertCircle className="w-4 h-4" />,
      colors: 'bg-rose-50 text-rose-700',
      valueColor: 'text-rose-900',
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Project Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* ── KPI Summary Cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 flex items-center gap-3.5 border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.colors}`}>
              {s.icon}
            </div>
            <div>
              <p className={`text-xl font-black leading-none tracking-tight ${s.valueColor}`}>{s.value}</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter / Control Bar ────────────────────── */}
      <div className="bg-white flex flex-wrap items-center gap-3 px-4 py-2 border border-slate-200 rounded-xl shadow-sm">
        {/* Label */}
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-xs font-bold text-slate-400 flex-shrink-0 uppercase tracking-wider">Filters</span>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 flex-shrink-0" />

        {/* Year */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <label className="text-xs font-medium text-slate-500">Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 flex-shrink-0" />

        {/* Work Type */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <label className="text-xs font-medium text-slate-500">Type</label>
          <select
            value={workType}
            onChange={e => setWorkType(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent"
          >
            <option value="">All</option>
            {WORK_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
          </select>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 flex-shrink-0" />

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchProjects()}
            placeholder="Search projects, customers, bearings..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent"
          />
        </div>

        {/* Clear + Refresh */}
        {search && (
          <button
            onClick={() => { setSearch(''); fetchProjects(); }}
            className="flex-shrink-0 text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors"
          >
            ✕ Clear
          </button>
        )}
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Kanban Board ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {KANBAN_STAGES.map(stage => {
          const cfg = columnConfig[stage];
          const stageProjects = filteredProjects
            .filter(p => p.current_stage === stage)
            .sort((a, b) => {
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            });
          const avg = avgProgress(stageProjects);

          return (
            <div key={stage} className="card flex flex-col overflow-hidden">

              {/* Column Header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-xl ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <span className={cfg.iconColor}>
                      {stage === 'work_request' && <ClipboardList className="w-4 h-4" />}
                      {stage === 'process' && <Settings className="w-4 h-4" />}
                      {stage === 'outputs' && <FileText className="w-4 h-4" />}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm text-slate-800">{STAGE_LABELS[stage]}</h2>
                    {stageProjects.length > 0 && (
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">Avg. progress {avg}%</p>
                    )}
                  </div>
                </div>
                <span className={`w-5.5 h-5.5 rounded-full font-bold flex items-center justify-center flex-shrink-0 text-[11px] ${cfg.badgeBg} ${cfg.badgeText}`}>
                  {stageProjects.length}
                </span>
              </div>

              {/* Cards Area */}
              <div className="flex-1 p-3 space-y-2.5 max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin bg-slate-50/70">
                {stageProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-slate-300">
                    <span className={cfg.iconColor + ' opacity-35'}>{cfg.emptyIcon}</span>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-2">No projects</p>
                  </div>
                ) : (
                  stageProjects.map(p => <ProjectCard key={p.id} project={p} onRefresh={fetchProjects} />)
                )}
              </div>

              {/* Column Footer */}
              {stageProjects.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 bg-white">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Overall progress</span>
                    <span className="text-[10px] font-bold text-slate-600">{avg}%</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-1 rounded-full transition-all duration-500 ${cfg.topBar}`}
                      style={{ width: `${avg}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Completed Projects ──────────────────────── */}
      {completedProjects.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm font-semibold text-gray-800">Completed Projects</span>
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {completedProjects.length}
              </span>
            </div>
            {showCompleted
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </button>
          {showCompleted && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50/50 border-t border-gray-100">
              {completedProjects.map(p => <ProjectCard key={p.id} project={p} onRefresh={fetchProjects} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────── */}
      {showCreate && (
        <ProjectForm
          onCreated={() => {
            setShowCreate(false);
            fetchProjects();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
