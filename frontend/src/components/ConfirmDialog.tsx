import { X, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  iconDirection?: 'left' | 'right';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  variant = 'danger',
  iconDirection = 'left',
  onConfirm,
  onCancel,
}: Props) {
  const isWarning = variant === 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
            isWarning ? 'bg-amber-50' : 'bg-red-50'
          }`}>
            {isWarning ? (
              iconDirection === 'right' ? (
                <ArrowRight className="w-6 h-6 text-amber-500" />
              ) : (
                <ArrowLeft className="w-6 h-6 text-amber-500" />
              )
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-colors ${
              isWarning
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
