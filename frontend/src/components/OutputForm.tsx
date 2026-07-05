import { useState, useEffect, useCallback } from 'react';
import { Check, X, Save, ChevronRight, AlertCircle, CheckCircle2, Edit3, Lock, Unlock, Forward, FileText } from 'lucide-react';
import { getOutputs, updateOutputs, completeOutputs } from '../api/client';
import type { Project } from '../types';
import { OUTPUT_STEP_LABELS } from '../types';

interface Props {
  projectId: number;
  project: Project;
  onUpdate: () => void;
}

export default function OutputForm({ projectId, project, onUpdate }: Props) {
  const [outputs, setOutputs] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [step7Option, setStep7Option] = useState<'skip' | 'revise' | null>(null);
  const [step7Data, setStep7Data] = useState('');

  const fetchOutputs = useCallback(async () => {
    try {
      const resp = await getOutputs(projectId);
      setOutputs(resp.outputs);
      setProgress(resp.progress);
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => { fetchOutputs(); }, [fetchOutputs]);

  // Sync step7Data from outputs when loaded
  useEffect(() => {
    if (outputs?.step7_data) {
      setStep7Data(outputs.step7_data);
      setStep7Option('revise');
    } else if (outputs?.step7_complete) {
      setStep7Option('skip');
    }
  }, [outputs]);

  const handleToggleStep = async (stepNum: number) => {
    if (!outputs) return;
    setSaving(true);
    try {
      const newVal = outputs[`step${stepNum}_complete`] ? false : true;
      await updateOutputs(projectId, { [`step${stepNum}_complete`]: newVal });
      await fetchOutputs();
      onUpdate();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Complete this project? This will move it to History.')) return;
    setSaving(true);
    try {
      const result = await completeOutputs(projectId);
      setSuccess(result.message);
      onUpdate();
      await fetchOutputs();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to complete');
    } finally {
      setSaving(false);
    }
  };

  const allRequiredComplete = outputs && [1,2,3,4,5,6].every(i => outputs[`step${i}_complete`]);
  const displayStepNum = (n: number) => n + 5; // Display steps 6-12 (continuation from Process 1-5)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Outputs</h2>
          <p className="text-sm text-gray-500">
            6 required steps (10% of project) • Step 12 optional (report revision)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm ${
                editMode
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border border-emerald-400 shadow-emerald-200 hover:from-emerald-600 hover:to-green-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-amber-400 shadow-amber-200 hover:from-amber-600 hover:to-orange-600'
              }`}
              title={editMode ? 'Disable edit mode' : 'Enable edit mode to make changes'}
            >
              {editMode ? (
                <Unlock className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>{editMode ? 'Editing Mode' : 'Edit Mode'}</span>
              <kbd className={`text-[9px] px-1 py-0.5 rounded ${
                editMode ? 'bg-emerald-600/40 text-emerald-100' : 'bg-amber-600/40 text-amber-100'
              }`}>
                {editMode ? 'ON' : 'OFF'}
              </kbd>
            </button>
            {!editMode && (
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                ⚡ Click to unlock editing
              </div>
            )}
          </div>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {progress}% / 10%
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
        <div
          className="h-2 rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${(progress / 10) * 100}%` }}
        />
      </div>

      {/* Locked overlay hint */}
      {!editMode && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">🔒 Editing is locked</p>
            <p className="text-xs text-amber-600">Click <strong className="text-amber-700">Edit Mode</strong> above to enable editing and mark steps complete</p>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className={`space-y-3 ${!editMode ? 'pointer-events-none opacity-60 select-none' : ''}`}>
        {[1, 2, 3, 4, 5, 6].map(stepNum => {
          const complete = outputs?.[`step${stepNum}_complete`];
          const displayNum = displayStepNum(stepNum);
          return (
            <div key={stepNum} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {complete ? <Check className="w-4 h-4" /> : displayNum}
                </div>
                <div>
                  <span className={`text-sm ${complete ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                    {OUTPUT_STEP_LABELS[displayNum]}
                  </span>
                  {displayNum === 8 && project.work_type === 'Others' && (
                    <span className="text-xs text-gray-400 ml-2">(Optional for Others type)</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleToggleStep(stepNum)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  complete
                    ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {complete ? 'Done' : 'Mark Done'}
              </button>
            </div>
          );
        })}

        {/* Step 12 (Optional) — Two options */}
        <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              outputs?.step7_complete ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {outputs?.step7_complete ? <Check className="w-4 h-4" /> : '12'}
            </div>
            <div>
              <span className="text-sm text-gray-700 font-medium">{OUTPUT_STEP_LABELS[12]}</span>
              <p className="text-[10px] text-gray-400">Choose an option below to proceed</p>
            </div>
            {outputs?.step7_complete && (
              <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Done
              </span>
            )}
          </div>

          {/* Option 1: Skip */}
          <button
            onClick={async () => {
              setSaving(true);
              setStep7Option('skip');
              try {
                await updateOutputs(projectId, { step7_complete: true, step7_data: '' });
                await fetchOutputs();
                onUpdate();
              } catch (e: any) {
                setError(e.response?.data?.detail || 'Failed');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !editMode}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              step7Option === 'skip'
                ? 'border-green-400 bg-green-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'
            } ${!editMode ? 'opacity-60 pointer-events-none select-none' : ''}`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              step7Option === 'skip' ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              <Forward className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className={`text-sm font-bold ${step7Option === 'skip' ? 'text-green-800' : 'text-gray-700'}`}>
                Skip — No revision needed
              </span>
              <p className="text-[11px] text-gray-500 mt-0.5">Report is final, no changes required</p>
            </div>
            {step7Option === 'skip' && (
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            )}
          </button>

          {/* Option 2: Revise */}
          <div className={`rounded-xl border-2 transition-all ${
            step7Option === 'revise'
              ? 'border-blue-400 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white'
          } ${!editMode ? 'opacity-60 pointer-events-none select-none' : ''}`}>
            <button
              onClick={() => {
                if (!editMode) return;
                setStep7Option('revise');
              }}
              disabled={!editMode}
              className="w-full flex items-center gap-3 p-3.5 text-left"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                step7Option === 'revise' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400'
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className={`text-sm font-bold ${step7Option === 'revise' ? 'text-blue-800' : 'text-gray-700'}`}>
                  Revised — Report was revised
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5">Fill in revision details below</p>
              </div>
              {step7Option === 'revise' && (
                <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
              )}
            </button>

            {/* Revision form (shown when Revise selected) */}
            {step7Option === 'revise' && (
              <div className="px-3.5 pb-4 space-y-3">
                <div className="h-px bg-blue-200/50" />
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Revision reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="input-base w-full h-24 resize-none text-sm"
                    placeholder="Who requested the revision and why?&#10;e.g.: Customer requested changes to test criteria"
                    value={step7Data}
                    onChange={e => setStep7Data(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      if (!step7Data.trim()) return;
                      setSaving(true);
                      try {
                        await updateOutputs(projectId, { step7_complete: true, step7_data: step7Data.trim() });
                        await fetchOutputs();
                        onUpdate();
                      } catch (e: any) {
                        setError(e.response?.data?.detail || 'Failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || !step7Data.trim()}
                    className="btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    {outputs?.step7_complete ? 'Update Revision' : 'Save Revision'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Button */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleComplete}
          disabled={saving || !allRequiredComplete || !editMode}
          className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          {project.current_stage === 'completed' ? 'Project Completed' : 'Complete Project'}
        </button>
      </div>
    </div>
  );
}
