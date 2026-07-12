import { useState, useEffect, useCallback } from 'react';
import { Users, Search } from 'lucide-react';
import { getProjects } from '../api/client';
import type { Project } from '../types';
import { WORK_TYPES } from '../types';
import ProjectCard from '../components/ProjectCard';

const wtDotColors: Record<string, string> = {
  'Evaluation': 'bg-orange-500',
  'Investigation': 'bg-blue-500',
  'Investigation for Benchmark': 'bg-cyan-500',
  'Investigation for Warranty': 'bg-red-500',
  'Maintenance': 'bg-green-500',
  'Improvement': 'bg-purple-500',
  'Tech. support': 'bg-teal-500',
  'Meeting with internal': 'bg-pink-500',
  'Leave': 'bg-gray-500',
  'Admin': 'bg-amber-500',
  'Others': 'bg-gray-500',
};

export default function ProjectGroupPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedWorkType, setSelectedWorkType] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');

  const fetchAllProjects = useCallback(async () => {
    try {
      const data = await getProjects({ year: new Date().getFullYear() });
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllProjects(); }, [fetchAllProjects]);

  const filtered = projects.filter(p => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.requester?.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedWorkType && p.work_type !== selectedWorkType) return false;
    if (selectedOwner && p.owner_username !== selectedOwner) return false;
    return true;
  });

  // Unique owners for filter
  const ownerList = [...new Set(projects.filter(p => p.owner_username).map(p => p.owner_username))].sort();

  const grouped = filtered.reduce<Record<string, Project[]>>((acc, p) => {
    const wt = p.work_type || 'Others';
    if (!acc[wt]) acc[wt] = [];
    acc[wt].push(p);
    return acc;
  }, {});

  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const priority = ['Investigation', 'Evaluation', 'Tech. support'];
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Project Group</h1>
          <p className="text-xs text-gray-500">All team projects — read-only for others' projects</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Search projects..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base w-full text-xs" style={{ paddingLeft: '2.25rem' }} />
          </div>
          <select className="input-base flex-1 min-w-[120px] text-xs" value={selectedWorkType}
            onChange={e => setSelectedWorkType(e.target.value)}>
            <option value="">All Work Types</option>
            {WORK_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
          </select>
          <select className="input-base flex-1 min-w-[120px] text-xs" value={selectedOwner}
            onChange={e => setSelectedOwner(e.target.value)}>
            <option value="">All Owners</option>
            {ownerList.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {sortedTypes.map(wt => (
          <div key={wt}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-3 h-3 rounded-full ${wtDotColors[wt] || 'bg-gray-500'}`} />
              <h2 className="text-sm font-bold text-gray-800">{wt}</h2>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{grouped[wt].length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped[wt].map(p => (
                <ProjectCard key={p.id} project={p} onUpdate={fetchAllProjects} />
              ))}
            </div>
          </div>
        ))}
        {sortedTypes.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No projects found</p>
          </div>
        )}
      </div>
    </div>
  );
}
