import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, AlertTriangle, CheckCircle2, ListChecks,
  ArrowRight, ChevronRight, FileText, BarChart3
} from 'lucide-react';
import { formatDMY } from '../utils/dateUtils';
import { getDashboard } from '../api/client';
import type { DashboardData } from '../api/client';

export default function HomeDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const d = await getDashboard();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-gray-500">No data available</div>;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Header - Centered Date */}
      <div className="text-center py-2">
        <p className="text-xs font-medium text-blue-600 bg-blue-50 inline-block px-4 py-1 rounded-full mb-2">
          {data.stats.today_task_count} task{data.stats.today_task_count !== 1 ? 's' : ''} today
        </p>
        <h1 className="text-3xl font-bold text-gray-900">{dateStr}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <ListChecks className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Projects</p>
              <p className="text-xl font-bold text-gray-900">{data.stats.total_active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Today's Tasks</p>
              <p className="text-xl font-bold text-gray-900">{data.stats.today_task_count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Due Soon (≤3 days)</p>
              <p className="text-xl font-bold text-amber-600">{data.stats.due_soon_count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Overdue</p>
              <p className="text-xl font-bold text-red-600">{data.stats.overdue_count}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* ── Today's Tasks (left 3 cols) ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <ListChecks className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Today's Plan</h2>
              </div>
              <span className="text-xs text-gray-400">{data.today_tasks.length} task{data.today_tasks.length !== 1 ? 's' : ''}</span>
            </div>

            {data.today_tasks.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No tasks scheduled for today</p>
                <p className="text-xs text-gray-400 mt-1">All planned tasks are complete or none are due today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.today_tasks.map((task, i) => {
                  const statusColor = task.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200'
                    : task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200';
                  const statusLabel = task.status === 'completed' ? 'Done'
                    : task.status === 'in_progress' ? 'Doing'
                    : 'Planned';

                  return (
                    <div
                      key={i}
                      onClick={() => navigate(`/project/${task.project_id}/process`)}
                      className="px-5 py-4 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-800 truncate">{task.name}</h3>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor} flex-shrink-0`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-gray-500 font-medium truncate">
                              {task.project_title}
                            </span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {task.work_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Plan: {task.planned_start} → {task.planned_end}
                            </span>
                            {task.actual_start && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                Started: {task.actual_start}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-700">{task.progress}%</div>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                              <div
                                className="h-1.5 rounded-full bg-blue-500"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Upcoming Deadlines (right 2 cols) ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Upcoming Deadlines</h2>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {data.active_projects.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No active projects</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                {data.active_projects.map((proj) => {
                  const days = proj.days_remaining;
                  let alertColor = 'text-gray-600 bg-gray-50';
                  let alertIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
                  if (days !== null && days < 0) {
                    alertColor = 'text-red-700 bg-red-50';
                    alertIcon = <AlertTriangle className="w-3.5 h-3.5" />;
                  } else if (days !== null && days <= 3) {
                    alertColor = 'text-amber-700 bg-amber-50';
                    alertIcon = <Clock className="w-3.5 h-3.5" />;
                  }

                  return (
                    <div
                      key={proj.id}
                      onClick={() => navigate(`/project/${proj.id}/process`)}
                      className="px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-800 truncate">{proj.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {proj.customer_name} • {proj.work_type}
                          </p>
                          {proj.due_date && (
                            <p className="text-xs text-gray-400 mt-1">
                              Due: {formatDMY(proj.due_date)}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 flex overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all" style={{ width: `${proj.current_stage === 'completed' ? 10 : (proj.process ? [1,2,3].filter(s => (proj.process as any)[`step${s}_complete`]).length : 0) / 3 * 10}%` }} />
                              <div className="h-full bg-teal-500 transition-all" style={{ width: `${proj.current_stage === 'completed' ? 79 : ((proj.total_tasks || 0) > 0 ? ((proj.completed_tasks || 0) / (proj.total_tasks || 1)) * 79 : 0)}%` }} />
                              <div className="h-full bg-amber-400 transition-all" style={{ width: `${proj.current_stage === 'completed' ? 1 : ((proj.process as any)?.step5_complete ? 1 : 0)}%` }} />
                              <div className="h-full bg-purple-500 transition-all" style={{ width: `${proj.current_stage === 'completed' ? 10 : (() => { const o = proj.outputs; if (!o) return 0; const done = [1,2,3,4,5,6].filter(i => (o as any)[`step${i}_complete`]).length; return (done / 6) * 10; })()}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-gray-500">{Math.round((proj.current_stage === 'completed' ? 10 : (proj.process ? [1,2,3].filter(s => (proj.process as any)['step' + s + '_complete']).length : 0) / 3 * 10) + (proj.current_stage === 'completed' ? 79 : ((proj.total_tasks || 0) > 0 ? ((proj.completed_tasks || 0) / (proj.total_tasks || 1)) * 79 : 0)) + (proj.current_stage === 'completed' ? 1 : ((proj.process as any)?.step5_complete ? 1 : 0)) + (proj.current_stage === 'completed' ? 10 : (() => { const o = proj.outputs; if (!o) return 0; const done = [1,2,3,4,5,6].filter(i => (o as any)['step' + i + '_complete']).length; return (done / 6) * 10; })()))}%</span>
                          </div>
                        </div>
                        {days !== null && (
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${alertColor}`}>
                            {alertIcon}
                            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today!' : `${days}d left`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/timesheet')}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all text-left"
            >
              <div className="p-2 bg-green-50 rounded-lg w-fit mb-2">
                <Clock className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm font-bold text-gray-800">Time Sheet</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Log your hours</p>
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all text-left"
            >
              <div className="p-2 bg-blue-50 rounded-lg w-fit mb-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-gray-800">Projects</p>
              <p className="text-[10px] text-gray-400 mt-0.5">View all projects</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
