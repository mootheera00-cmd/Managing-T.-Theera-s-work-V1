import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, PauseCircle, PlayCircle, CheckCircle2, Circle, Edit3, Save, X } from 'lucide-react';
import { updateProcess, pauseProject, resumeProject } from '../api/client';
import { STATUS_LABELS } from '../types';
import type { Project } from '../types';
import FileUpload from './FileUpload';

interface Props {
  project: Project;
  onUpdate: (p: Project) => void;
}

const PROCESS_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export default function ProcessForm({ project, onUpdate }: Props) {
  const ps = project.process;
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState({
    comets_no: ps?.comets_no || '',
    email_from: ps?.email_from || '',
    order_confirmed: !!ps?.order_confirmed,
    report_number: ps?.report_number || '',
    test_status: ps?.test_status || 'pending',
    report_status: ps?.report_status || 'pending',
    check_status: ps?.check_status || 'pending',
    issue_status: ps?.issue_status || 'pending',
  });
  const [pauseReason, setPauseReason] = useState(project.pause_reason || '');
  const [showPauseInput, setShowPauseInput] = useState(false);

  useEffect(() => {
    if (ps) {
      setForm({
        comets_no: ps.comets_no || '',
        email_from: ps.email_from || '',
        order_confirmed: !!ps.order_confirmed,
        report_number: ps.report_number || '',
        test_status: ps.test_status || 'pending',
        report_status: ps.report_status || 'pending',
        check_status: ps.check_status || 'pending',
        issue_status: ps.issue_status || 'pending',
      });
    }
  }, [ps]);

  const save = useCallback(async (field: string, value: string | boolean) => {
    try {
      const updated = await updateProcess(project.id, { [field]: value });
      onUpdate(updated);
    } catch (e) {
      console.error('Save failed', e);
    }
  }, [project.id, onUpdate]);

  const handleSave = useCallback(async () => {
    try {
      const updated = await updateProcess(project.id, form as Record<string, unknown>);
      onUpdate(updated);
      setIsEditMode(false);
    } catch (e) {
      console.error('Save failed', e);
    }
  }, [project.id, form, onUpdate]);

  const handleCancel = useCallback(() => {
    if (ps) {
      setForm({
        comets_no: ps.comets_no || '',
        email_from: ps.email_from || '',
        order_confirmed: !!ps.order_confirmed,
        report_number: ps.report_number || '',
        test_status: ps.test_status || 'pending',
        report_status: ps.report_status || 'pending',
        check_status: ps.check_status || 'pending',
        issue_status: ps.issue_status || 'pending',
      });
    }
    setIsEditMode(false);
  }, [ps]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckbox = (field: string, value: boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePause = async () => {
    try {
      const updated = await pauseProject(project.id, pauseReason);
      onUpdate(updated);
      setShowPauseInput(false);
    } catch (e) {
      console.error('Pause failed', e);
    }
  };

  const handleResume = async () => {
    try {
      const updated = await resumeProject(project.id);
      onUpdate(updated);
      setPauseReason('');
    } catch (e) {
      console.error('Resume failed', e);
    }
  };

  const allStatuses = [form.test_status, form.report_status, form.check_status, form.issue_status];
  const completedSteps = allStatuses.filter(s => s === 'completed').length + (form.order_confirmed ? 1 : 0) + (form.comets_no.trim() ? 1 : 0) + (form.email_from.trim() ? 1 : 0) + (form.report_number.trim() ? 1 : 0);
  const totalSteps = 8;
  const isComplete = completedSteps === totalSteps;
  const isPaused = project.status === 'paused';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
          <h3 className="text-base font-bold text-gray-900">Process</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{completedSteps}/{totalSteps} steps completed</span>
          {isEditMode ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800">
                <Save className="w-3 h-3" /> Save
              </button>
              <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                <X className="w-3 h-3" /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditMode(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>

      {isPaused && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
            <PauseCircle className="w-4 h-4" /> Project Paused
          </div>
          {project.pause_reason && (
            <p className="text-xs text-amber-600">Reason: {project.pause_reason}</p>
          )}
          <button
            onClick={handleResume}
            className="mt-1.5 flex items-center gap-1 px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-xl hover:bg-green-700"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Resume
          </button>
        </div>
      )}

      {!isPaused && (
        <div>
          {showPauseInput ? (
            <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
              <textarea
                value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                placeholder="Reason for pause (optional)..."
                rows={2}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex gap-2">
                <button onClick={handlePause} className="px-3 py-1 text-xs font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600">Confirm Pause</button>
                <button onClick={() => setShowPauseInput(false)} className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPauseInput(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-50"
            >
              <PauseCircle className="w-3.5 h-3.5" /> Pause Project
            </button>
          )}
        </div>
      )}

      {/* All 7 sections in 2-column grid */}
      <div className="grid grid-cols-2 gap-3 items-start">

        {/* 1. Order Receiving */}
        <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">1</span>
            Order Receiving
          </h4>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">COMETS No.</label>
            <input
              type="text"
              value={form.comets_no}
              onChange={e => handleChange('comets_no', e.target.value)}
              readOnly={!isEditMode}
              placeholder="COMETS No."
              className={`w-full px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email From</label>
            <input
              type="text"
              value={form.email_from}
              onChange={e => handleChange('email_from', e.target.value)}
              readOnly={!isEditMode}
              placeholder="Who sent the email?"
              className={`w-full px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
            />
          </div>
          <FileUpload projectId={project.id} stage="process" stepName="order_receiving" files={project.files || []} onFilesChange={() => save('comets_no', form.comets_no)} />
        </div>

        {/* 2. Confirmation of Order Detail */}
        <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2 self-start">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">2</span>
            Confirmation of Order Detail
          </h4>
          <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
            <input
              type="checkbox"
              checked={form.order_confirmed}
              onChange={e => isEditMode && handleCheckbox('order_confirmed', e.target.checked)}
              disabled={!isEditMode}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
            />
            <span className="text-sm text-gray-700">Order details confirmed</span>
          </label>
          <FileUpload projectId={project.id} stage="process" stepName="order_confirmation" files={project.files || []} onFilesChange={() => save('order_confirmed', form.order_confirmed)} />
        </div>

        {/* 3. Report Number */}
        <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">3</span>
            Report Number (Work Log Management)
          </h4>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.report_number}
              onChange={e => handleChange('report_number', e.target.value)}
              readOnly={!isEditMode}
              placeholder="e.g. APTX26124"
              className={`flex-1 px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
            />
            <a
              href="http://aptc150-096.asia.ad.nsk.com/signin.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Work Log
            </a>
          </div>
        </div>

        {/* 4–7: Test, Report, Check, Issue statuses */}
        {([
          { key: 'test_status', label: '4. Perform Test / Investigation' },
          { key: 'report_status', label: '5. Making Report' },
          { key: 'check_status', label: '6. Check Report' },
          { key: 'issue_status', label: '7. Issue Report' },
        ] as const).map(({ key, label }) => (
          <div key={key} className={`bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-2${key === 'issue_status' ? ' col-span-2' : ''}`}>
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">
                {label.split('.')[0]}
              </span>
              {label.split('. ').slice(1).join('. ')}
            </h4>
            <select
              value={(form as Record<string, string | boolean>)[key] as string}
              onChange={e => handleSelectChange(key, e.target.value)}
              disabled={!isEditMode}
              className={`px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none ${key === 'issue_status' ? 'w-1/2' : 'w-full'} ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
            >
              {PROCESS_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <FileUpload projectId={project.id} stage="process" stepName={key} files={project.files || []} onFilesChange={() => save(key, (form as Record<string, string | boolean>)[key])} />
          </div>
        ))}
      </div>
    </div>
  );
}
