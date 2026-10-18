'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, File, CheckCircle2, X, AlertCircle, Download, FileCode, Loader2 } from 'lucide-react';

interface FileUploadQuestionProps {
  fileUrl?: string | null;
  fileName?: string | null;
  onFileUploaded: (fileUrl: string | null, fileName: string | null) => void;
  allowedExtensions?: string | null;
  maxSizeMb?: number | null;
  readOnly?: boolean;
}

export default function FileUploadQuestion({
  fileUrl,
  fileName,
  onFileUploaded,
  allowedExtensions = 'pdf,png,jpg,ipynb,zip,txt,py,java,cpp',
  maxSizeMb = 10,
  readOnly = false
}: FileUploadQuestionProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanAllowed = (allowedExtensions || 'pdf,png,jpg,ipynb,zip,txt,py,java,cpp')
    .split(',')
    .map(ext => ext.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);

  const handleUploadFile = async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (cleanAllowed.length > 0 && !cleanAllowed.includes(ext)) {
      setError(`Invalid file type (.${ext}). Allowed formats: ${cleanAllowed.map(e => `.${e}`).join(', ')}`);
      return;
    }

    const maxBytes = (maxSizeMb || 10) * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${maxSizeMb}MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      onFileUploaded(data.url || data.fileUrl, file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (readOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    if (readOnly) return;
    onFileUploaded(null, null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const hasAttachment = Boolean(fileUrl);

  return (
    <div className="w-full space-y-3">
      {hasAttachment ? (
        <div className="p-4 rounded-2xl bg-white border border-teal-200/90 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <FileCode size={20} />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {fileName || 'Submitted Practical Attachment'}
                </span>
              </div>
              <span className="text-[11px] text-teal-700 font-semibold block mt-0.5">
                Saved & Uploaded Successfully
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
              >
                <Download size={13} /> View
              </a>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                title="Remove attachment"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !readOnly && !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-teal-500 bg-teal-50/70'
              : 'border-slate-300 hover:border-teal-400 bg-slate-50/60 hover:bg-white'
          } ${readOnly ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            onChange={handleChange}
            accept={cleanAllowed.map(e => `.${e}`).join(',')}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center shadow-xs">
              {uploading ? (
                <Loader2 size={24} className="animate-spin text-teal-600" />
              ) : (
                <UploadCloud size={24} />
              )}
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                {uploading ? 'Uploading your attachment...' : 'Click to upload or drag & drop solution file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supported formats: {cleanAllowed.map(e => `.${e}`).join(', ')} (Max {maxSizeMb}MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
