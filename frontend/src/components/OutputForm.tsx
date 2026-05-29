import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, CheckCircle2, Circle, Edit3, Save, X } from 'lucide-react';
import { updateOutputs } from '../api/client';
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
  const [isEditMode, setIsEditMode] = useState(false);

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

      <div className="grid grid-cols-2 gap-3 items-start">
        {/* Left column */}
        <div className="space-y-2">
          {/* Report Approved */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">1</span>
              Report Approved
            </h4>
            <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
              <input
                type="checkbox"
                checked={form.report_approved}
                onChange={e => isEditMode && handleCheckbox('report_approved', e.target.checked)}
                disabled={!isEditMode}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
              />
              <span className="text-sm text-gray-700">Report approved</span>
            </label>
          </div>

          {/* Report Revising */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-1.5">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">2</span>
              Report Revising
            </h4>
            <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
              <input
                type="checkbox"
                checked={form.report_revising}
                onChange={e => isEditMode && handleCheckbox('report_revising', e.target.checked)}
                disabled={!isEditMode}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
              />
              <span className="text-sm text-gray-700">Report is being revised</span>
            </label>
            {form.report_revising && (
              <textarea
                value={form.revision_notes}
                onChange={e => handleChange('revision_notes', e.target.value)}
                readOnly={!isEditMode}
                placeholder="Revision details..."
                rows={2}
                className={`w-full px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none resize-none ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
              />
            )}
          </div>

          {/* Work Log Completed */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">3</span>
              Work Log Completed
            </h4>
            <div className="flex items-center justify-between">
              <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                <input
                  type="checkbox"
                  checked={form.work_log_completed}
                  onChange={e => isEditMode && handleCheckbox('work_log_completed', e.target.checked)}
                  disabled={!isEditMode}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
                />
                <span className="text-sm text-gray-700">Work Log Management Completed</span>
              </label>
              <a
                href="http://aptc150-096.asia.ad.nsk.com/signin.php"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {/* Claim Record - conditional */}
          {showClaim && (
            <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-1">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">4</span>
                Claim Record
              </h4>
              <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                <input
                  type="checkbox"
                  checked={form.claim_record_completed}
                  onChange={e => isEditMode && handleCheckbox('claim_record_completed', e.target.checked)}
                  disabled={!isEditMode}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
                />
                <span className="text-sm font-medium text-gray-700">Claim Record Completed</span>
              </label>
              <p className="text-xs text-gray-400 ml-6">Required for Investigation / Investigation for Warranty</p>
            </div>
          )}

          {/* Eval Record - conditional */}
          {showEval && (
            <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-1">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">4</span>
                Evaluation Record
              </h4>
              <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
                <input
                  type="checkbox"
                  checked={form.eval_record_completed}
                  onChange={e => isEditMode && handleCheckbox('eval_record_completed', e.target.checked)}
                  disabled={!isEditMode}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
                />
                <span className="text-sm font-medium text-gray-700">Evaluation Test Record Completed</span>
              </label>
              <p className="text-xs text-gray-400 ml-6">Required for Evaluation type</p>
            </div>
          )}

          {/* COMETS Submitted */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 space-y-1.5">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">5</span>
              Report Submitted in COMETS
            </h4>
            <label className={`flex items-center gap-2 ${isEditMode ? 'cursor-pointer' : 'cursor-default'}`}>
              <input
                type="checkbox"
                checked={form.comets_submitted}
                onChange={e => isEditMode && handleCheckbox('comets_submitted', e.target.checked)}
                disabled={!isEditMode}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-60"
              />
              <span className="text-sm text-gray-700">Submitted</span>
            </label>
            <input
              type="text"
              value={form.comets_no}
              onChange={e => handleChange('comets_no', e.target.value)}
              readOnly={!isEditMode}
              placeholder="COMETS No."
              className={`w-full px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
            />
          </div>

          {/* Report Submission Date */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">6</span>
              Report Submission Date
            </h4>
            <input
              type="date"
              value={form.submission_date}
              onChange={e => handleChange('submission_date', e.target.value)}
              disabled={!isEditMode}
              className={`w-full px-2.5 py-1.5 border rounded-xl text-sm focus:outline-none ${isEditMode ? 'border-gray-200 focus:ring-2 focus:ring-gray-900 bg-white' : 'border-gray-100 bg-gray-50 text-gray-600 cursor-default'}`}
            />
          </div>

          {/* Attachments */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">7</span>
              Attachments
            </h4>
            <FileUpload
              projectId={project.id}
              stage="outputs"
              stepName="general"
              files={project.files || []}
              onFilesChange={() => save('comets_submitted', form.comets_submitted)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
