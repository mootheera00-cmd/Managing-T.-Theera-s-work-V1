import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { createProject, updateWorkRequest } from '../api/client';
import { WORK_TYPES, REQUESTERS } from '../types';
import type { Project } from '../types';

interface Props {
  onCreated: (project: Project) => void;
  onCancel: () => void;
}

export default function ProjectForm({ onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [wr, setWr] = useState({
    requester: '',
    customer_name: '',
    work_type: '',
    bearing_no: '',
    received_date: '',
    due_date: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const setWrField = (field: string, value: string) =>
    setWr(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const project = await createProject({ year, title: title.trim() });
      // Save WR fields if any are filled
      const anyFilled = Object.values(wr).some(v => v.trim());
      if (anyFilled) {
        const updated = await updateWorkRequest(project.id, wr as Record<string, unknown>);
        onCreated(updated);
      } else {
        onCreated(project);
      }
    } catch (err) {
      console.error('Failed to create project', err);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            <FolderPlus className="w-4 h-4 text-gray-900" />
          </div>
          <h2 className="text-base font-bold text-gray-900">New Project</h2>
          <button
            onClick={onCancel}
            className="ml-auto p-1 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Project info card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2.5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100">Project Info</h4>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter project title..."
                  className={inputCls}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  min={2020}
                  max={2099}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Work Request fields */}
            <div className="grid grid-cols-2 gap-3 items-start">
              {/* Left: Request Details */}
              <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2.5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold">1</span>
                  Request Details
                </h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Requester</label>
                  <select value={wr.requester} onChange={e => setWrField('requester', e.target.value)} className={inputCls}>
                    <option value="">Select requester...</option>
                    {REQUESTERS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name</label>
                  <input type="text" value={wr.customer_name} onChange={e => setWrField('customer_name', e.target.value)} placeholder="Customer name" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Work Type</label>
                  <select value={wr.work_type} onChange={e => setWrField('work_type', e.target.value)} className={inputCls}>
                    <option value="">Select work type...</option>
                    {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bearing No.</label>
                  <input type="text" value={wr.bearing_no} onChange={e => setWrField('bearing_no', e.target.value)} placeholder="Bearing number" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Received Date</label>
                  <input type="date" value={wr.received_date} onChange={e => setWrField('received_date', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                  <input type="date" value={wr.due_date} onChange={e => setWrField('due_date', e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Right: Notes */}
              <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold">2</span>
                  Notes
                </h4>
                <textarea
                  value={wr.notes}
                  onChange={e => setWrField('notes', e.target.value)}
                  placeholder="Additional notes..."
                  rows={11}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-6 py-2 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
