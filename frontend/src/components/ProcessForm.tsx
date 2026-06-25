import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, PauseCircle, PlayCircle, CheckCircle2, Circle, Edit3, Save, X, CalendarDays, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { updateProcess, pauseProject, resumeProject, openFolder, createReportNumber, updateReportNumber, deleteReportNumber, completeProcess } from '../api/client';
import { STATUS_LABELS } from '../types';
import type { Project, ReportNumber } from '../types';
import FileUpload from './FileUpload';

interface Props {
  project: Project;
  onUpdate: (p: Project) => void;
}

const PROCESS_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export default function ProcessForm({ project, onUpdate }: Props) {
  const navigate = useNavigate();
  const getStatusColor = (val: string) => {
    if (val === 'completed') return 'text-blue-600';
    if (val === 'in_progress') return 'text-orange-500 font-bold';
    return 'text-slate-400'; // pending
  };

  const getOptionStyle = (val: string): React.CSSProperties => {
    if (val === 'completed') return { color: '#2563eb' };
    if (val === 'in_progress') return { color: '#f97316', fontWeight: 'bold' };
    return { color: '#9ca3af' }; // pending
  };

  const ps = project.process;
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState({
    comets_no: ps?.comets_no || '',
    comets_url: ps?.comets_url || '',
    order_confirmed: !!ps?.order_confirmed,
    test_status: ps?.test_status || 'pending',
    report_status: ps?.report_status || 'pending',
    store_report_status: ps?.store_report_status || 'pending',
    check_status: ps?.check_status || 'pending',
  });
  const [reportNumbers, setReportNumbers] = useState<ReportNumber[]>(project.report_numbers || []);
  const [newRN, setNewRN] = useState({ report_number: '', item_description: '' });
  const [pauseReason, setPauseReason] = useState(project.pause_reason || '');
  const [showPauseInput, setShowPauseInput] = useState(false);

  useEffect(() => {
    if (ps) {
      setForm({
        comets_no: ps.comets_no || '',
        comets_url: ps.comets_url || '',
        order_confirmed: !!ps.order_confirmed,
        test_status: ps.test_status || 'pending',
        report_status: ps.report_status || 'pending',
        store_report_status: ps.store_report_status || 'pending',
        check_status: ps.check_status || 'pending',
      });
    }
  }, [ps]);

  useEffect(() => {
    setReportNumbers(project.report_numbers || []);
  }, [project.report_numbers]);

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
        comets_url: ps.comets_url || '',
        order_confirmed: !!ps.order_confirmed,
        test_status: ps.test_status || 'pending',
        report_status: ps.report_status || 'pending',
        store_report_status: ps.store_report_status || 'pending',
        check_status: ps.check_status || 'pending',
      });
    }
    setReportNumbers(project.report_numbers || []);
    setNewRN({ report_number: '', item_description: '' });
    setIsEditMode(false);
  }, [ps, project.report_numbers]);

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

  const handleOpenFolder = async () => {
    try {
      await openFolder(project.id);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to open folder. Please check if the folder path is correct and exists on this system.');
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

  const allStatuses = [form.test_status, form.report_status, form.store_report_status, form.check_status];
  const hasReportNumber = reportNumbers.some(rn => rn.report_number.trim() !== '');
  const completedSteps = allStatuses.filter(s => s === 'completed').length + (form.order_confirmed ? 1 : 0) + (form.comets_no.trim() ? 1 : 0) + (hasReportNumber ? 1 : 0);
  const totalSteps = 7;
  const isComplete = completedSteps === totalSteps;
  const isPaused = project.status === 'paused';

  return (
    <div className="space-y-3">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Circle className="w-5 h-5 text-slate-300" />
          )}
          <h3 className="text-base font-bold text-slate-900">Process Management</h3>
          <span className="text-xs text-slate-400 font-medium">({completedSteps}/{totalSteps} steps completed)</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200">
                <Save className="w-3 h-3" /> Save Changes
              </button>
              <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-650 border border-slate-200 rounded-xl hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200">
                <X className="w-3 h-3" /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditMode(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200">
              <Edit3 className="w-3 h-3" /> Edit Fields
            </button>
          )}
        </div>
      </div>

      {isPaused && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-1">
            <PauseCircle className="w-4 h-4 text-amber-600" /> Project Paused
          </div>
          {project.pause_reason && (
            <p className="text-xs text-amber-700 font-medium">Reason: {project.pause_reason}</p>
          )}
          <button
            onClick={handleResume}
            className="mt-2.5 flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Resume Project
          </button>
        </div>
      )}

      {!isPaused && (
        <div className="flex items-center gap-2">
          {showPauseInput ? (
            <div className="bg-slate-50 border border-slate-300 rounded-[10px] p-3 space-y-2.5 shadow-sm flex-1">
              <textarea
                value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                placeholder="Reason for pause (optional)..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
              <div className="flex gap-2">
                <button onClick={handlePause} className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-400 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200">Confirm Pause</button>
                <button onClick={() => setShowPauseInput(false)} className="px-3.5 py-1.5 text-xs font-medium text-slate-650 border border-slate-200 rounded-xl hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowPauseInput(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-700 border border-amber-250 rounded-xl hover:bg-amber-50 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200"
              >
                <PauseCircle className="w-3.5 h-3.5" /> Pause Project
              </button>
              <button
                onClick={async () => {
                  if (confirm('Complete this Process and move to Outputs? Incomplete steps will be skipped.')) {
                    try {
                      const updated = await completeProcess(project.id);
                      onUpdate(updated);
                    } catch (e: any) {
                      alert(e.response?.data?.detail || 'Failed to complete process');
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete Process
              </button>
            </>
          )}
        </div>
      )}

      {/* Sequential 1-7 Layout */}
      <div className="space-y-2">
        {/* 1. Order Receiving */}
        <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">1</span>
            Order Receiving
          </h4>
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Ticket No.:</span>
              <input
                type="text"
                value={form.comets_no}
                onChange={e => handleChange('comets_no', e.target.value)}
                readOnly={!isEditMode}
                placeholder="Reference ID"
                className={`w-32 px-3 py-1.5 border rounded-xl text-xs transition-all focus:outline-none ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-955 bg-white text-slate-850' : `${form.comets_no ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-slate-500'} cursor-default`}`}
              />
            </div>
            {isEditMode && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">COMETS URL:</span>
                <input
                  type="text"
                  value={form.comets_url}
                  onChange={e => handleChange('comets_url', e.target.value)}
                  placeholder="Paste COMETS URL"
                  className="w-48 px-3 py-1.5 border border-slate-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-955 bg-white text-slate-850"
                />
              </div>
            )}
            {form.comets_url && (
              <a
                href={form.comets_url.startsWith('http') ? form.comets_url : `https://${form.comets_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" /> COMETS Link
              </a>
            )}

            <div className="flex-shrink-0">
              <FileUpload projectId={project.id} stage="process" stepName="order_receiving" files={project.files || []} onFilesChange={() => save('comets_no', form.comets_no)} />
            </div>
          </div>
        </div>

        {/* 2. Confirmation of Order Detail */}
        <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">2</span>
            Confirmation of Order Detail
          </h4>
          <div className="flex items-center gap-4 ml-auto">
            <label className={`flex items-center gap-2.5 py-1 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
              <input
                type="checkbox"
                checked={form.order_confirmed}
                onChange={e => isEditMode && handleCheckbox('order_confirmed', e.target.checked)}
                disabled={!isEditMode}
                className="w-4.5 h-4.5 rounded border-slate-300 text-slate-955 focus:ring-slate-955 disabled:opacity-60"
              />
              <span className="text-xs font-semibold text-slate-700">Order details confirmed</span>
            </label>
            <div className="flex-shrink-0">
              <FileUpload projectId={project.id} stage="process" stepName="order_confirmation" files={project.files || []} onFilesChange={() => save('order_confirmed', form.order_confirmed)} />
            </div>
          </div>
        </div>

        {/* 3. Report Numbers */}
        <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">3</span>
              Report Number (Work Log Management)
            </h4>
            <a
              href="http://aptc150-096.asia.ad.nsk.com/signin.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Work Log Website
            </a>
          </div>

          {/* Existing Report Numbers */}
          {reportNumbers.length === 0 && !isEditMode && (
            <p className="text-xs text-slate-400 italic ml-7">No report numbers added yet.</p>
          )}

          <div className="space-y-2 ml-7">
            {reportNumbers.map((rn, idx) => (
              <div key={rn.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0">{idx + 1}.</span>
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      value={rn.report_number}
                      onChange={e => {
                        const updated = [...reportNumbers];
                        updated[idx] = { ...updated[idx], report_number: e.target.value };
                        setReportNumbers(updated);
                      }}
                      placeholder="Report No."
                      className="w-28 px-2.5 py-1.5 border border-slate-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-955 bg-white text-slate-850"
                    />
                    <input
                      type="text"
                      value={rn.item_description}
                      onChange={e => {
                        const updated = [...reportNumbers];
                        updated[idx] = { ...updated[idx], item_description: e.target.value };
                        setReportNumbers(updated);
                      }}
                      placeholder="Item description..."
                      className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-slate-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-955 bg-white text-slate-850"
                    />
                    <button
                      onClick={async () => {
                        await deleteReportNumber(project.id, rn.id);
                        setReportNumbers(prev => prev.filter(r => r.id !== rn.id));
                      }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-xs font-bold ${rn.report_number ? 'text-gray-900' : 'text-slate-400'}`}>
                      {rn.report_number || '—'}
                    </span>
                    {rn.item_description && (
                      <>
                        <span className="text-slate-300 text-xs">|</span>
                        <span className="text-xs text-slate-500 italic">{rn.item_description}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add new report number form (edit mode only) */}
            {isEditMode && (
              <div className="flex items-center gap-2 pt-1 border-t border-dashed border-slate-200 mt-2">
                <span className="text-[10px] font-bold text-slate-400 w-5 flex-shrink-0">+</span>
                <input
                  type="text"
                  value={newRN.report_number}
                  onChange={e => setNewRN(prev => ({ ...prev, report_number: e.target.value }))}
                  placeholder="New Report No."
                  className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-955 bg-white text-slate-850"
                />
                <input
                  type="text"
                  value={newRN.item_description}
                  onChange={e => setNewRN(prev => ({ ...prev, item_description: e.target.value }))}
                  placeholder="Item description..."
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-955 bg-white text-slate-850"
                />
                <button
                  onClick={async () => {
                    if (!newRN.report_number.trim()) return;
                    const created = await createReportNumber(project.id, {
                      report_number: newRN.report_number.trim(),
                      item_description: newRN.item_description.trim(),
                    });
                    setReportNumbers(prev => [...prev, created]);
                    setNewRN({ report_number: '', item_description: '' });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex-shrink-0"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. Perform Test / Investigation */}
        <div className={`bg-white border rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4 transition-colors duration-200 ${
          form.test_status === 'completed' ? 'border-green-400 bg-green-50/30' : 'border-slate-300'
        }`}>
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">4</span>
            <span className="truncate">Perform Test / Investigation</span>
          </h4>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => navigate(`/project/${project.id}/process?step=test_status`)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 shadow-sm"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Process Gantt
            </button>
            <select
              value={form.test_status}
              onChange={e => handleSelectChange('test_status', e.target.value)}
              disabled={!isEditMode}
              className={`px-3 py-1.5 border rounded-xl text-xs font-bold focus:outline-none transition-all disabled:opacity-100 ${
                getStatusColor(form.test_status)
              } ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-955 bg-white' : `${form.test_status === 'completed' ? 'bg-emerald-500 text-white' : form.test_status === 'in_progress' ? 'bg-orange-400 text-white border-orange-400' : 'border-slate-300 bg-slate-50/70'} cursor-default`}`}
            >
              {PROCESS_STATUSES.map(s => (
                <option key={s} value={s} style={getOptionStyle(s)}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 5. Making Report */}
        <div className={`bg-white border rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4 transition-colors duration-200 ${
          form.report_status === 'completed' ? 'border-green-400 bg-green-50/30' : 'border-slate-300'
        }`}>
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">5</span>
            <span className="truncate">Making Report</span>
          </h4>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => navigate(`/project/${project.id}/process?step=report_status`)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 shadow-sm"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Process Gantt
            </button>
            <select
              value={form.report_status}
              onChange={e => handleSelectChange('report_status', e.target.value)}
              disabled={!isEditMode}
              className={`px-3 py-1.5 border rounded-xl text-xs font-bold focus:outline-none transition-all disabled:opacity-100 ${
                getStatusColor(form.report_status)
              } ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-955 bg-white' : `${form.report_status === 'completed' ? 'bg-emerald-500 text-white' : form.report_status === 'in_progress' ? 'bg-orange-400 text-white border-orange-400' : 'border-slate-300 bg-slate-50/70'} cursor-default`}`}
            >
              {PROCESS_STATUSES.map(s => (
                <option key={s} value={s} style={getOptionStyle(s)}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 6. Store the report in the folder — per Report No */}
        <div className={`bg-white border rounded-[10px] p-3 shadow-sm transition-colors duration-200 ${
          form.store_report_status === 'completed' ? 'border-green-400 bg-green-50/30' : 'border-slate-300'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">6</span>
              <span>Store the report in the folder</span>
            </h4>
            <select
              value={form.store_report_status}
              onChange={e => handleSelectChange('store_report_status', e.target.value)}
              disabled={!isEditMode}
              className={`px-3 py-1.5 border rounded-xl text-xs font-bold focus:outline-none transition-all disabled:opacity-100 ${
                getStatusColor(form.store_report_status)
              } ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-955 bg-white' : `${form.store_report_status === 'completed' ? 'bg-emerald-500 text-white' : form.store_report_status === 'in_progress' ? 'bg-orange-400 text-white border-orange-400' : 'border-slate-300 bg-slate-50/70'} cursor-default`}`}
            >
              {PROCESS_STATUSES.map(s => (
                <option key={s} value={s} style={getOptionStyle(s)}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Per-Report-Number folder paths */}
          {reportNumbers.length === 0 ? (
            <p className="text-xs text-slate-400 italic ml-7">No report numbers. Add report numbers first.</p>
          ) : (
            <div className="space-y-2 ml-7">
              {reportNumbers.map((rn, idx) => (
                <div key={rn.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0">{idx + 1}.</span>
                  <span className="text-xs font-semibold text-slate-700 min-w-[80px]">{rn.report_number}</span>
                  {isEditMode ? (
                    <>
                      <input
                        type="text"
                        value={rn.folder_path || ''}
                        onChange={async e => {
                          const newPath = e.target.value;
                          // Update local state
                          const updated = [...reportNumbers];
                          updated[idx] = { ...updated[idx], folder_path: newPath };
                          setReportNumbers(updated);
                          // Save to backend immediately
                          await updateReportNumber(project.id, rn.id, { folder_path: newPath });
                        }}
                        placeholder="e.g. D:\Moo-2026\Files"
                        className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-slate-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-955 bg-white text-slate-850 truncate"
                      />
                      {rn.folder_path && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await openFolder(project.id, rn.id);
                            } catch (e: any) {
                              alert(e.response?.data?.detail || 'Failed to open folder.');
                            }
                          }}
                          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 flex-shrink-0"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Open
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-xs font-bold truncate ${rn.folder_path ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'text-slate-400'}`}>
                        {rn.folder_path || 'No folder set'}
                      </span>
                      {rn.folder_path && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await openFolder(project.id, rn.id);
                            } catch (e: any) {
                              alert(e.response?.data?.detail || 'Failed to open folder.');
                            }
                          }}
                          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 flex-shrink-0"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Open
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Check Report */}
        <div className={`bg-white border rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4 transition-colors duration-200 ${
          form.check_status === 'completed' ? 'border-green-400 bg-green-50/30' : 'border-slate-300'
        }`}>
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">7</span>
            <span className="truncate">Check Report</span>
          </h4>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => navigate(`/project/${project.id}/process?step=check_status`)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200 shadow-sm"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Process Gantt
            </button>
            <select
              value={form.check_status}
              onChange={e => handleSelectChange('check_status', e.target.value)}
              disabled={!isEditMode}
              className={`px-3 py-1.5 border rounded-xl text-xs font-bold focus:outline-none transition-all disabled:opacity-100 ${
                getStatusColor(form.check_status)
              } ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-955 bg-white' : `${form.check_status === 'completed' ? 'bg-emerald-500 text-white' : form.check_status === 'in_progress' ? 'bg-orange-400 text-white border-orange-400' : 'border-slate-300 bg-slate-50/70'} cursor-default`}`}
            >
              {PROCESS_STATUSES.map(s => (
                <option key={s} value={s} style={getOptionStyle(s)}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

