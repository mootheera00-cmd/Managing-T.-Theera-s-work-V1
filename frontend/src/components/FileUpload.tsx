import { useState, useRef, useCallback } from 'react';
import { Upload, Eye, Download, Trash2, File as FileIcon } from 'lucide-react';
import { uploadFile, deleteFile } from '../api/client';
import type { FileAttachment } from '../types';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  projectId: number;
  stage: string;
  stepName?: string;
  files: FileAttachment[];
  onFilesChange: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FileUpload({ projectId, stage, stepName = '', files, onFilesChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stageFiles = files.filter(f => f.stage === stage && f.step_name === stepName);

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        await uploadFile(projectId, fileList[i], stage, stepName);
      }
      onFilesChange();
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [projectId, stage, stepName, onFilesChange]);

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await deleteFile(deleteTarget);
      onFilesChange();
    } catch (e) {
      console.error('Delete failed', e);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors px-3 py-1.5"
        style={{ border: '1px dashed #D1D5DB', borderRadius: 6 }}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-3 h-3" />
        <span>{uploading ? 'Uploading...' : 'Attach files'}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
      </button>

      {stageFiles.length > 0 && (
        <div className="space-y-1">
          {stageFiles.map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
              <FileIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-700">{f.original_filename}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{formatSize(f.file_size)}</span>
              <a
                href={`/api/files/${f.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                title="View"
              >
                <Eye className="w-4 h-4" />
              </a>
              <a
                href={`/api/files/${f.id}/download`}
                className="p-1 text-green-500 hover:bg-green-100 rounded"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => setDeleteTarget(f.id)}
                className="p-1 text-red-400 hover:bg-red-100 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title="Delete File"
          message="Are you sure you want to delete this file? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
