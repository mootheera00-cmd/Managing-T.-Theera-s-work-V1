import { useState, useEffect } from 'react';
import { Search, BarChart3, Briefcase, Clock, PauseCircle, CheckCircle2 } from 'lucide-react';
import { getProjects, getSummary } from '../api/client';
import type { Project, ProjectSummary } from '../types';
import ProjectCard from '../components/ProjectCard';

export default function HistoryPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { year };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [proj, sum] = await Promise.all([
        getProjects(params as any),
        getSummary(params as any),
      ]);
      setProjects(proj);
      setSummary(sum);
    } catch (e) {
      console.error('Failed to fetch', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const years = [];
  for (let y = 2020; y <= 2099; y++) years.push(y);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">History & Summary</h2>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
              <Briefcase className="w-4 h-4" /> Total Projects
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-green-600 text-xs font-medium mb-1">
              <Clock className="w-4 h-4" /> Active
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.by_status.active || 0}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-amber-500 text-xs font-medium mb-1">
              <PauseCircle className="w-4 h-4" /> Paused
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.by_status.paused || 0}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
              <CheckCircle2 className="w-4 h-4" /> Completed
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.by_status.completed || 0}</p>
          </div>
        </div>
      )}

      {/* By Type Breakdown */}
      {summary && Object.keys(summary.by_type).length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-700">Projects by Work Type</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(summary.by_type)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-48 truncate">{type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gray-900 h-2.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Projects List */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">
          Projects ({projects.length})
        </h3>
        {projects.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No projects found for the selected criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
