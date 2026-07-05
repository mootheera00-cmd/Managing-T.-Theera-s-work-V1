import { useState, useRef, useEffect } from 'react';
import { X, Plus, Calendar } from 'lucide-react';
import { createProject } from '../api/client';
import { REQUESTERS, WORK_TYPES } from '../types';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function ProjectForm({ onClose, onCreated }: Props) {
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    requester: '',
    customer_name: '',
    work_type: '',
    bearing_no: '',
    received_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Project title is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createProject({
        year: new Date().getFullYear(),
        ...form,
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Date picker trigger
  useEffect(() => {
    if (datePickerTarget && datePickerRef.current) {
      datePickerRef.current.value = '';
      datePickerRef.current.showPicker();
    }
  }, [datePickerTarget]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Hidden date picker */}
        <input type="date" ref={datePickerRef} className="fixed" style={{ top: '50%', left: '50%', opacity: 0.01, pointerEvents: 'none', zIndex: 99999, width: '200px', height: '30px' }}
          onChange={e => {
            if (!e.target.value || !datePickerTarget) return;
            if (datePickerTarget === 'received') updateField('received_date', e.target.value);
            else if (datePickerTarget === 'due') updateField('due_date', e.target.value);
            setDatePickerTarget(null);
          }}
        />
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Create New Project</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Title <span className="text-red-500">*</span>
            </label>
            <input
              className="input-base w-full"
              placeholder="Enter project title"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              autoFocus
            />
          </div>

          {/* Two-column fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requester</label>
              <select
                className="input-base w-full"
                value={form.requester}
                onChange={e => updateField('requester', e.target.value)}
              >
                <option value="">Select requester...</option>
                {REQUESTERS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                className="input-base w-full"
                placeholder="Customer name"
                value={form.customer_name}
                onChange={e => updateField('customer_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
              <select
                className="input-base w-full"
                value={form.work_type}
                onChange={e => updateField('work_type', e.target.value)}
              >
                <option value="">Select work type...</option>
                {WORK_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bearing No.</label>
              <input
                className="input-base w-full"
                placeholder="Bearing number"
                value={form.bearing_no}
                onChange={e => updateField('bearing_no', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Received Date</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-base flex-1"
                  placeholder="YYYY-MM-DD"
                  value={form.received_date}
                  onChange={e => updateField('received_date', e.target.value)}
                />
                <button type="button" onClick={() => setDatePickerTarget('received_' + Date.now())}
                  className="px-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"
                  title="Pick date from calendar"
                >
                  <Calendar className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-base flex-1"
                  placeholder="YYYY-MM-DD"
                  value={form.due_date}
                  onChange={e => updateField('due_date', e.target.value)}
                />
                <button type="button" onClick={() => setDatePickerTarget('due_' + Date.now())}
                  className="px-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"
                  title="Pick date from calendar"
                >
                  <Calendar className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input-base w-full h-24 resize-none"
              placeholder="Additional notes..."
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
