import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, CheckCircle2, Clock, BarChart3, FolderOpen, Search, ChevronDown
} from 'lucide-react';
import { formatDMY } from '../utils/dateUtils';
import { getProjects, getSummary } from '../api/client';
import type { Project, ProjectSummary } from '../types';
import { WORK_TYPES } from '../types';
import ProjectCard from '../components/ProjectCard';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function HistoryPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState<number | ''>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [filterType, setFilterType] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params: any = { year };
      if (month !== '') {
        const from = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month as number, 0).getDate();
        const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        params.date_from = from;
        params.date_to = to;
      }
      const [projs, sum] = await Promise.all([
        getProjects(params),
        getSummary({ year })
      ]);
      setProjects(projs);
      setSummary(sum);
    } catch (e) {
      console.error(e);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Completed projects, filtered by type, sorted by completed_at descending
  const completedProjects = useMemo(() => {
    let filtered = projects.filter(p => p.current_stage === 'completed');
    if (filterType) filtered = filtered.filter(p => p.work_type === filterType);
    return filtered.sort((a, b) => {
      const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [projects, filterType]);

  const workTypeColors: Record<string, string> = {
    'Evaluation': 'bg-orange-500',
    'Investigation': 'bg-blue-500',
    'Investigation for Benchmark': 'bg-cyan-500',
    'Investigation for Warranty': 'bg-red-500',
    'Maintenance': 'bg-green-500',
    'Improvement': 'bg-purple-500',
    'Others': 'bg-gray-500',
  };

  return (
    <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">History & Summary</h1>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-base w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Work Types</option>
            {WORK_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
          </select>
          <select className="input-base w-28" value={month} onChange={e => setMonth(e.target.value ? Number(e.target.value) : '')}>
            <option value="">All Year</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="input-base w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-lg"><FolderOpen className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Projects</p>
                <p className="text-xl font-bold text-gray-900">{summary.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Completed</p>
                <p className="text-xl font-bold text-gray-900">{summary.by_stage?.completed || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-xl font-bold text-gray-900">{summary.by_status?.active || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 rounded-lg"><BarChart3 className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Work Types</p>
                <p className="text-xl font-bold text-gray-900">{Object.keys(summary.by_type || {}).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 rounded-lg"><Calendar className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Paused</p>
                <p className="text-xl font-bold text-gray-900">{summary.by_status?.paused || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Type Distribution */}
      {summary?.by_type && Object.keys(summary.by_type).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Work Type Distribution</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_type).map(([type, count]) => {
              const total = summary.total || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-32 sm:w-40 truncate">{type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${workTypeColors[type] || 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Projects as Cards */}
      {completedProjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No completed projects for this period</p>
          <p className="text-sm mt-1">Projects will appear here once completed</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {completedProjects.map(project => (
            <ProjectCard key={project.id} project={project} onUpdate={fetchData} />
          ))}
        </div>
      )}
    </div>
  );
}
