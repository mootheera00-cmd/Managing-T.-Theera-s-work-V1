import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, CheckCircle2, Circle, Edit3, Save, X, Copy, Clipboard, Mail } from 'lucide-react';
import { updateOutputs, completeOutputs } from '../api/client';
import type { Project } from '../types';
import FileUpload from './FileUpload';

interface Props {
  project: Project;
  onUpdate: (p: Project) => void;
}

export default function OutputForm({ project, onUpdate }: Props) {
  const out = project.outputs;
  const workType = project.work_request?.work_type || '';
  const showClaim = workType === 'Investigation' || workType === 'Investigation for Warranty';
  const showEval = workType === 'Evaluation';
  const cometsUrl = project.process?.comets_url || '';
  const [isEditMode, setIsEditMode] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    report_approved: !!out?.report_approved,
    report_revising: !!out?.report_revising,
    revision_notes: out?.revision_notes || '',
    work_log_completed: !!out?.work_log_completed,
    claim_record_completed: !!out?.claim_record_completed,
    eval_record_completed: !!out?.eval_record_completed,
    comets_submitted: !!out?.comets_submitted,
    comets_no: out?.comets_no || '',
    submission_date: out?.submission_date || '',
  });

  useEffect(() => {
    if (out) {
      setForm({
        report_approved: !!out.report_approved,
        report_revising: !!out.report_revising,
        revision_notes: out.revision_notes || '',
        work_log_completed: !!out.work_log_completed,
        claim_record_completed: !!out.claim_record_completed,
        eval_record_completed: !!out.eval_record_completed,
        comets_submitted: !!out.comets_submitted,
        comets_no: out.comets_no || '',
        submission_date: out.submission_date || '',
      });
    }
  }, [out]);

  const save = useCallback(async (field: string, value: string | boolean) => {
    try {
      const updated = await updateOutputs(project.id, { [field]: value });
      onUpdate(updated);
    } catch (e) {
      console.error('Save failed', e);
    }
  }, [project.id, onUpdate]);

  const handleSave = useCallback(async () => {
    try {
      const updated = await updateOutputs(project.id, form as Record<string, unknown>);
      onUpdate(updated);
      setIsEditMode(false);
    } catch (e) {
      console.error('Save failed', e);
    }
  }, [project.id, form, onUpdate]);

  const handleCancel = useCallback(() => {
    if (out) {
      setForm({
        report_approved: !!out.report_approved,
        report_revising: !!out.report_revising,
        revision_notes: out.revision_notes || '',
        work_log_completed: !!out.work_log_completed,
        claim_record_completed: !!out.claim_record_completed,
        eval_record_completed: !!out.eval_record_completed,
        comets_submitted: !!out.comets_submitted,
        comets_no: out.comets_no || '',
        submission_date: out.submission_date || '',
      });
    }
    setIsEditMode(false);
  }, [out]);

  const handleCheckbox = (field: string, value: boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const checks = [form.report_approved, form.work_log_completed, form.comets_submitted];
  if (showClaim) checks.push(form.claim_record_completed);
  if (showEval) checks.push(form.eval_record_completed);
  const completedCount = checks.filter(Boolean).length;
  const totalCount = checks.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
          <h3 className="text-base font-bold text-gray-900">Outputs</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{completedCount}/{totalCount} items completed</span>
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-start">
        {/* Left column */}
        <div className="space-y-2">
          {/* Report Approved */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">1</span>
              Report Approved
            </h4>
            <label className={`flex items-center gap-2 flex-shrink-0 ml-auto ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
              <span className="text-sm text-gray-700 font-semibold">Approved</span>
              <input
                type="checkbox"
                checked={form.report_approved}
                onChange={e => isEditMode && handleCheckbox('report_approved', e.target.checked)}
                disabled={!isEditMode}
                className="w-4.5 h-4.5 rounded border-slate-300 text-slate-955 focus:ring-slate-955 disabled:opacity-60"
              />
            </label>
          </div>

          {/* Work Log Completed */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">2</span>
              Work Log Completed
            </h4>
            <div className="flex items-center gap-3 ml-auto">
              <a
                href="http://aptc150-096.asia.ad.nsk.com/signin.php"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-slate-655 border border-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-900 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200 flex-shrink-0"
              >
                <ExternalLink className="w-3 h-3" /> Open Log
              </a>
              <label className={`flex items-center gap-2 flex-shrink-0 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className="text-sm text-gray-700 font-semibold">Completed</span>
                <input
                  type="checkbox"
                  checked={form.work_log_completed}
                  onChange={e => isEditMode && handleCheckbox('work_log_completed', e.target.checked)}
                  disabled={!isEditMode}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-slate-950 focus:ring-slate-950 disabled:opacity-60"
                />
              </label>
            </div>
          </div>

          {/* Claim Record - conditional */}
          {showClaim && (
            <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">3</span>
                Claim Record
              </h4>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-[11px] text-slate-450 hidden sm:inline">Required for Investigation</span>
                <label className={`flex items-center gap-2 flex-shrink-0 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                  <span className="text-sm font-semibold text-gray-755">Completed</span>
                  <input
                    type="checkbox"
                    checked={form.claim_record_completed}
                    onChange={e => isEditMode && handleCheckbox('claim_record_completed', e.target.checked)}
                    disabled={!isEditMode}
                    className="w-4.5 h-4.5 rounded border-slate-300 text-slate-955 focus:ring-slate-955 disabled:opacity-60"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Eval Record - conditional */}
          {showEval && (
            <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">3</span>
                Evaluation Record
              </h4>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-[11px] text-slate-455 hidden sm:inline">Required for Evaluation</span>
                <label className={`flex items-center gap-2 flex-shrink-0 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                  <span className="text-sm font-semibold text-gray-755">Completed</span>
                  <input
                    type="checkbox"
                    checked={form.eval_record_completed}
                    onChange={e => isEditMode && handleCheckbox('eval_record_completed', e.target.checked)}
                    disabled={!isEditMode}
                    className="w-4.5 h-4.5 rounded border-slate-300 text-slate-955 focus:ring-slate-955 disabled:opacity-60"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {/* Complete & Finish button */}
          <div className="bg-white border border-emerald-200 rounded-[10px] p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex-shrink-0">★</span>
                Complete Project
              </h4>
              <button
                onClick={async () => {
                  if (confirm('Mark this project as Completed? Incomplete items will be skipped.')) {
                    try {
                      const updated = await completeOutputs(project.id);
                      onUpdate(updated);
                    } catch (e: any) {
                      alert(e.response?.data?.detail || 'Failed to complete project');
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md transition-all duration-200"
              >
                <CheckCircle2 className="w-4 h-4" /> Complete &amp; Finish
              </button>
            </div>
          </div>

          {/* COMETS Submitted */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">4</span>
              Report Submitted in COMETS
            </h4>
            <div className="flex items-center gap-3 ml-auto">
              {cometsUrl && (
                <a
                  href={cometsUrl.startsWith('http') ? cometsUrl : `https://${cometsUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-slate-655 border border-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-900 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200 flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" /> COMETS Link
                </a>
              )}
              <button
                type="button"
                onClick={() => { setShowNotifModal(true); setCopied(false); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-655 border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-slate-909 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm transition-all duration-200 flex-shrink-0"
                title="Send notification to requester"
              >
                <Mail className="w-3.5 h-3.5" /> Notify
              </button>
              <label className={`flex items-center gap-2 flex-shrink-0 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className="text-sm text-gray-700 font-semibold">Submitted</span>
                <input
                  type="checkbox"
                  checked={form.comets_submitted}
                  onChange={e => isEditMode && handleCheckbox('comets_submitted', e.target.checked)}
                  disabled={!isEditMode}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-slate-950 focus:ring-slate-955 disabled:opacity-60"
                />
              </label>
            </div>
          </div>

          {/* Report Submission Date */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">5</span>
              Report Submission Date
            </h4>
            <input
              type="date"
              value={form.submission_date}
              onChange={e => handleChange('submission_date', e.target.value)}
              disabled={!isEditMode}
              className={`w-40 px-2.5 py-1 border rounded-xl text-xs focus:outline-none ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.submission_date ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-400'} cursor-default`}`}
            />
          </div>

          {/* Attachments */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">6</span>
              Attachments
            </h4>
            <div className="ml-auto">
              <FileUpload
                projectId={project.id}
                stage="outputs"
                stepName="general"
                files={project.files || []}
                onFilesChange={() => save('comets_submitted', form.comets_submitted)}
              />
            </div>
          </div>

          {/* Report Revising — moved to last */}
          <div className="bg-white border border-slate-300 rounded-[10px] p-3 shadow-sm flex flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex-shrink-0">7</span>
              Report Revising
            </h4>
            <div className="flex items-center gap-3 ml-auto">
              {form.report_revising && (
                <input
                  type="text"
                  value={form.revision_notes}
                  onChange={e => handleChange('revision_notes', e.target.value)}
                  readOnly={!isEditMode}
                  placeholder="Revision details..."
                  className={`w-36 px-2.5 py-1 border rounded-xl text-xs focus:outline-none ${isEditMode ? 'border-slate-400 focus:ring-2 focus:ring-slate-900 bg-white text-slate-855' : `${form.revision_notes ? 'bg-emerald-500 text-white font-bold' : 'border-slate-300 bg-slate-50/70 text-gray-600'} cursor-default`}`}
                />
              )}
              <label className={`flex items-center gap-2 flex-shrink-0 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className="text-sm text-gray-700 font-semibold">Revising</span>
                <input
                  type="checkbox"
                  checked={form.report_revising}
                  onChange={e => isEditMode && handleCheckbox('report_revising', e.target.checked)}
                  disabled={!isEditMode}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-slate-950 focus:ring-slate-950 disabled:opacity-60"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notification Modal ── */}
      {showNotifModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNotifModal(false)}>
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">Send Notification</h3>
              <button onClick={() => setShowNotifModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-700 font-mono leading-relaxed">
                <p>Dear Requester,</p>
                <p className="mt-3">
                  I would like to submit the I would like to send{' '}
                  <span className="text-red-500 font-bold">investigation report of returned front wheel bearing from Indonesia</span>.
                </p>
                <p className="mt-3">
                  Brg. No. {project.work_request?.bearing_no || '—'}<br />
                  {(() => {
                    const rns = project.report_numbers || [];
                    const rnText = rns.length > 0
                      ? rns.map(rn => rn.report_number).join(', ')
                      : project.process?.report_number || form.comets_no || '—';
                    return <>{rnText}{form.comets_no ? ' = 4pcs.' : ''}</>;
                  })()}
                </p>
                <p className="mt-3">
                  password : {(() => {
                    const rns = project.report_numbers || [];
                    const pwd = rns.length > 0
                      ? rns.map(rn => rn.report_number).join(', ')
                      : project.process?.report_number || form.comets_no || '';
                    const digits = pwd.match(/\d+/)?.[0] || '';
                    const num = digits || '26124';
                    return <><span className="text-slate-700">aptc</span><span className="text-red-500 font-bold">{num}</span></>;
                  })()}
                </p>
                <p className="mt-3">
                  Best regards,<br />
                  [APTC]T. Theera
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-end">
              <button
                onClick={() => {
                  const rns = project.report_numbers || [];
                  const rnText = rns.length > 0
                    ? rns.map(rn => rn.report_number).join(', ')
                    : project.process?.report_number || form.comets_no || '—';
                  const pwdText = rns.length > 0
                    ? rns.map(rn => rn.report_number).join(', ')
                    : project.process?.report_number || form.comets_no || '';
                  const pwdDigits = pwdText.match(/\d+/)?.[0] || '';
                  const password = pwdDigits ? `aptc${pwdDigits}` : 'aptc26124';
                  const text = `Dear Requester,\n\nI would like to submit the I would like to send investigation report of returned front wheel bearing from Indonesia.\n\nBrg. No. ${project.work_request?.bearing_no || '—'}\n${rnText} ${form.comets_no ? '= 4pcs.' : ''}\n\npassword : ${password}\n\nBest regards,\n[APTC]T. Theera`;
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {copied ? <><Clipboard className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Message</>}
              </button>
              <button onClick={() => setShowNotifModal(false)} className="px-4 py-2.5 text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
