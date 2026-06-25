import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Edit3, Save, X, Play } from 'lucide-react';
import { updateWorkRequest, startProcess } from '../api/client';
import { WORK_TYPES, REQUESTERS } from '../types';
import type { Project } from '../types';
import FileUpload from './FileUpload';

interface Props {
  project: Project;
  onUpdate: (p: Project) => void;
  onStart?: (p: Project) => void;
}

export default function WorkRequestForm({ project, onUpdate, onStart }: Props) {
  const wr = project.work_request;
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState({
    requester: wr?.requester || '',
    customer_name: wr?.customer_name || '',
    work_type: wr?.work_type || '',
    bearing_no: wr?.bearing_no || '',
    received_date: wr?.received_date || '',
    due_date: wr?.due_date || '',
    notes: wr?.notes || '',
  });

  useEffect(() => {
    if (wr) {
      setForm({
        requester: wr.requester || '',
        customer_name: wr.customer_name || '',
        work_type: wr.work_type || '',
        bearing_no: wr.bearing_no || '',
        received_date: wr.received_date || '',
        due_date: wr.due_date || '',
        notes: wr.notes || '',
      });
    }
  }, [wr]);

  const save = useCallback(async (field: string, value: string) => {
    try {
      const updated = await updateWorkRequest(project.id, { [field]: value });
      onUpdate(updated);
    } catch (e) {
      console.error('Save failed', e);
    }
  }, [project.id, onUpdate]);

  const handleSave = useCallback(async () => {
    try {
      const updated = await updateWorkRequest(project.id, form as Record<string, unknown>);
      onUpdate(updated);
      setIsEditMode(false);
    } catch (e) {
      console.error('Save failed', e);
    }
  }, [project.id, form, onUpdate]);

  const handleCancel = useCallback(() => {
    if (wr) {
      setForm({
        requester: wr.requester || '',
        customer_name: wr.customer_name || '',
        work_type: wr.work_type || '',
        bearing_no: wr.bearing_no || '',
        received_date: wr.received_date || '',
        due_date: wr.due_date || '',
        notes: wr.notes || '',
      });
    }
    setIsEditMode(false);
  }, [wr]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const [starting, setStarting] = useState(false);
  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      const updated = await startProcess(project.id);
      onUpdate(updated);
      onStart?.(updated);
    } catch (e) {
      console.error('Start failed', e);
    } finally {
      setStarting(false);
    }
  }, [project.id, onUpdate, onStart]);

  const requiredFields = ['requester', 'customer_name', 'work_type', 'bearing_no', 'due_date'];
  const filledCount = requiredFields.filter(f => (form as Record<string, string>)[f]?.trim()).length;
  const isComplete = filledCount === requiredFields.length;
  const canStart = project.current_stage === 'work_request';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
          <h3 className="text-base font-bold text-gray-900">Work Request</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {filledCount}/{requiredFields.length} fields completed
          </span>
          {isEditMode ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200">
                <Save className="w-3 h-3" /> Save
              </button>
              <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200">
                <X className="w-3 h-3" /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditMode(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-650 border border-gray-200 rounded-xl hover:bg-gray-100 hover:text-gray-900 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200">
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          )}
          {canStart && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-white" />
              {starting ? 'Starting...' : 'Start Process'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-start">
        {/* Left column */}
        <div className="space-y-2">
          {/* Requester */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">1</span>
              Requester
            </h4>
            <select
              value={form.requester}
              onChange={e => handleChange('requester', e.target.value)}
              disabled={!isEditMode}
              className={`w-48 px-3 py-1.5 border rounded-xl text-xs focus:outline-none disabled:opacity-100 transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.requester ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            >
              <option value="">Select requester...</option>
              {REQUESTERS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Customer Name */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">2</span>
              Customer Name
            </h4>
            <input
              type="text"
              value={form.customer_name}
              onChange={e => handleChange('customer_name', e.target.value)}
              readOnly={!isEditMode}
              placeholder="Customer name"
              className={`w-48 px-3 py-1.5 border rounded-xl text-xs focus:outline-none transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.customer_name ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            />
          </div>

          {/* Work Type */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">3</span>
              Work Type
            </h4>
            <select
              value={form.work_type}
              onChange={e => handleSelectChange('work_type', e.target.value)}
              disabled={!isEditMode}
              className={`w-48 px-3 py-1.5 border rounded-xl text-xs focus:outline-none disabled:opacity-100 transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.work_type ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            >
              <option value="">Select work type...</option>
              {WORK_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Bearing No. */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">4</span>
              Bearing No.
            </h4>
            <input
              type="text"
              value={form.bearing_no}
              onChange={e => handleChange('bearing_no', e.target.value)}
              readOnly={!isEditMode}
              placeholder="Bearing number"
              className={`w-48 px-3 py-1.5 border rounded-xl text-xs focus:outline-none transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.bearing_no ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {/* Received Date */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">5</span>
              Received Date
            </h4>
            <input
              type="date"
              value={form.received_date}
              onChange={e => handleSelectChange('received_date', e.target.value)}
              disabled={!isEditMode}
              className={`w-40 px-3 py-1.5 border rounded-xl text-xs focus:outline-none disabled:opacity-100 transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.received_date ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            />
          </div>

          {/* Due Date */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">6</span>
              Due Date
            </h4>
            <input
              type="date"
              value={form.due_date}
              onChange={e => handleSelectChange('due_date', e.target.value)}
              disabled={!isEditMode}
              className={`w-40 px-3 py-1.5 border rounded-xl text-xs focus:outline-none disabled:opacity-100 transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.due_date ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            />
          </div>

          {/* Notes */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">7</span>
              Notes
            </h4>
            <input
              type="text"
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              readOnly={!isEditMode}
              placeholder="Additional notes..."
              className={`w-48 px-3 py-1.5 border rounded-xl text-xs focus:outline-none transition-all ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.notes ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            />
          </div>

          {/* Attachments */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">8</span>
              Attachments
            </h4>
            <div className="ml-auto">
              <FileUpload
                projectId={project.id}
                stage="work_request"
                stepName="general"
                files={project.files || []}
                onFilesChange={() => save('requester', form.requester)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
