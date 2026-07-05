import { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { updateProcessStep } from '../api/client';
import type { ProcessSteps } from '../types';

interface Props {
  projectId: number;
  process: ProcessSteps;
  stepNum: number;
  label: string;
  onUpdate: () => void;
}

export default function ProcessForm({ projectId, process, stepNum, label, onUpdate }: Props) {
  const [data, setData] = useState(process[`step${stepNum}_data` as keyof ProcessSteps] as string || '');
  const [saving, setSaving] = useState(false);

  const isComplete = process[`step${stepNum}_complete` as keyof ProcessSteps];

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProcessStep(projectId, stepNum, { data, complete: true });
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          isComplete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {isComplete ? <Check className="w-3 h-3" /> : stepNum}
        </div>
        <span className={`text-sm font-medium ${isComplete ? 'text-green-700' : 'text-gray-600'}`}>
          {label}
        </span>
      </div>
      <textarea
        className="input-base w-full h-24 resize-none text-sm"
        value={data}
        onChange={e => setData(e.target.value)}
        placeholder={`Enter details for ${label}...`}
      />
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !data.trim()}
          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
        >
          <Save className="w-3 h-3" /> {isComplete ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
}
