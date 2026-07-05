import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Layers, Activity, CheckCircle2,
  ClipboardList, FileText, Settings, SlidersHorizontal,
} from 'lucide-react';
import { getProjects, getSummary } from '../api/client';
import type { Project, ProjectSummary } from '../types';
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
  label: string;
}> = {
  work_request: {
    topBar: 'bg-gray-900',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    badgeBg: 'bg-gray-200',
    badgeText: 'text-gray-600',
    label: STAGE_LABELS['work_request'],
  },
  process: {
    topBar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    label: STAGE_LABELS['process'],
  },
  outputs: {
    topBar: 'bg-green-600',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
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
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { year };
      if (search.trim()) params.search = search.trim();
      const data = await getProjects(params as any);
      setProjects(data);
      const sum = await getSummary({ year });
      setSummary(sum);
    } catch (e) {
      console.error('Failed to fetch projects', e);
    } finally {
      setLoading(false);
    }
  }, [year, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProjects = workType
    ? projects.filter(p => p.work_type?.toLowerCase() === workType.toLowerCase())
    : projects;

  const activeProjects = filteredProjects.filter(p => p.current_stage !== 'completed');
  const completedProjects = filteredProjects.filter(p => p.current_stage === 'completed');
  const overdueProjects = activeProjects.filter(p => isOverdue(p.due_date));

  const stageMap: Record<string, Project[]> = {
    work_request: [],
    process: [],
    outputs: [],
  };
  activeProjects.forEach(p => {
    if (stageMap[p.current_stage]) {
      stageMap[p.current_stage].push(p);
    }
  });

  return (
    <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Project Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-lg"><Activity className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Active</p>
              <p className="text-xl font-bold text-gray-900">{activeProjects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-lg"><Layers className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-gray-500">In Process</p>
              <p className="text-xl font-bold text-gray-900">{stageMap.process.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="text-xl font-bold text-gray-900">{completedProjects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-lg"><ClipboardList className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Overdue</p>
              <p className="text-xl font-bold text-gray-900">{overdueProjects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 rounded-lg"><Activity className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Avg Progress</p>
              <p className="text-xl font-bold text-gray-900">{avgProgress(activeProjects)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            className="input-base w-full"
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <select className="input-base w-36 sm:w-40" value={year} onChange={e => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="input-base flex-1 sm:w-48 min-w-0" value={workType} onChange={e => setWorkType(e.target.value)}>
            <option value="">All Work Types</option>
            {WORK_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
          </select>
          <button onClick={fetchData} className="btn-secondary p-2.5 flex-shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {KANBAN_STAGES.map(stage => {
          const cfg = columnConfig[stage];
          const list = stageMap[stage] || [];
          return (
            <div key={stage} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Column Header */}
              <div className={`${cfg.topBar} px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{cfg.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                    {list.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-3 min-h-[300px] max-h-[600px] overflow-y-auto">
                {list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <p className="text-sm">No projects</p>
                  </div>
                ) : (
                  list.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onUpdate={fetchData}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl">
            Completed Projects ({completedProjects.length})
          </summary>
          <div className="p-3 grid grid-cols-3 gap-3">
            {completedProjects.map(project => (
              <ProjectCard key={project.id} project={project} onUpdate={fetchData} />
            ))}
          </div>
        </details>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <ProjectForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
