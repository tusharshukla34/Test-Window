'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  Clock,
  Layers,
  Code,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  FileText
} from 'lucide-react';
import { Assignment, Batch } from '@/lib/db/types';

interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: (Assignment & { recipient_batch_names?: string[]; target_batches?: string[]; submission_count?: number }) | null;
  onSaved: (updated: Assignment & { recipient_batch_names: string[]; target_batches?: string[]; submission_count: number }) => void;
}

export default function EditAssignmentModal({
  isOpen,
  onClose,
  assignment,
  onSaved
}: EditAssignmentModalProps) {
  const [batches, setBatches] = useState<(Batch & { student_count: number })[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [instructions, setInstructions] = useState('');
  const [instructionsTab, setInstructionsTab] = useState<'write' | 'preview'>('write');
  const [submissionType, setSubmissionType] = useState<'both' | 'file_upload' | 'text_response'>('both');
  const [allowedFormats, setAllowedFormats] = useState<string[]>([]);
  const [customFormatInput, setCustomFormatInput] = useState('');
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(15);
  const [maxScore, setMaxScore] = useState(50);
  const [rubric, setRubric] = useState('');
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(true);
  const [deadline, setDeadline] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>('published');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const standardFormats = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg'];
  const codingFormats = ['ipynb', 'py', 'java', 'cpp', 'c', 'cs', 'js', 'ts', 'html', 'css', 'sql', 'json', 'zip'];
  const [availableFormats, setAvailableFormats] = useState<string[]>([
    'pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg',
    'ipynb', 'py', 'java', 'cpp', 'c', 'cs', 'js', 'ts', 'html', 'css', 'sql', 'json', 'zip'
  ]);

  // Load batches
  useEffect(() => {
    if (isOpen) {
      setLoadingBatches(true);
      fetch('/api/admin/batches')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setBatches(data);
        })
        .catch(() => {})
        .finally(() => setLoadingBatches(false));
    }
  }, [isOpen]);

  // Populate form when assignment changes
  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title || '');
      setSubject(assignment.subject || '');
      setInstructions(assignment.instructions || '');
      setSubmissionType(assignment.submission_type || 'both');
      
      const formats = Array.isArray(assignment.allowed_formats)
        ? assignment.allowed_formats.map(f => f.replace(/^\./, '').trim())
        : [];
      setAllowedFormats(formats);

      // Add any custom formats present in the assignment to availableFormats
      setAvailableFormats(prev => {
        const next = [...prev];
        for (const f of formats) {
          if (!next.includes(f)) next.push(f);
        }
        return next;
      });

      setMaxFileSizeMb(assignment.max_file_size_mb || 15);
      setMaxScore(assignment.max_score || 50);
      setRubric(assignment.rubric || '');
      setAllowLateSubmissions(Boolean(assignment.allow_late_submissions));
      setStatus(assignment.status || 'published');

      // Format ISO deadline to local input format: YYYY-MM-DDTHH:mm
      try {
        const d = new Date(assignment.deadline);
        // Local ISO string
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        setDeadline(localISOTime);
      } catch {
        setDeadline(assignment.deadline?.slice(0, 16) || '');
      }

      setSelectedBatchIds(assignment.target_batches || []);
      setError(null);
    }
  }, [assignment]);

  if (!isOpen || !assignment) return null;

  const handleAddCustomFormat = () => {
    const clean = customFormatInput.trim().replace(/^\./, '').toLowerCase();
    if (clean) {
      if (!availableFormats.includes(clean)) {
        setAvailableFormats(prev => [...prev, clean]);
      }
      if (!allowedFormats.includes(clean)) {
        setAllowedFormats(prev => [...prev, clean]);
      }
      setCustomFormatInput('');
    }
  };

  const handleSelectAllCoding = () => {
    const toAdd = codingFormats.filter(f => !allowedFormats.includes(f));
    setAllowedFormats(prev => [...prev, ...toAdd]);
  };

  const handleSelectAllDocuments = () => {
    const toAdd = standardFormats.filter(f => !allowedFormats.includes(f));
    setAllowedFormats(prev => [...prev, ...toAdd]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an assignment title.');
      return;
    }
    if (selectedBatchIds.length === 0) {
      setError('Please select at least one target batch.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const deadlineISO = new Date(deadline).toISOString();

      const res = await fetch(`/api/admin/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          instructions: instructions.trim(),
          submission_type: submissionType,
          allowed_formats: allowedFormats,
          max_file_size_mb: maxFileSizeMb,
          max_score: maxScore,
          rubric: rubric.trim() || null,
          allow_late_submissions: allowLateSubmissions,
          deadline: deadlineISO,
          batch_ids: selectedBatchIds,
          status
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update assignment');
      }

      onSaved(data.assignment);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Edit Homework Assignment</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                  {assignment.id}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">Modify questions, deadline, target batches, or allowed formats</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Assignment Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="e.g. Numpy Revision Questions"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Subject / Topic
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Python Libraries"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Section: Target Batches */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-indigo-600" /> Target Cohorts / Batches <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {selectedBatchIds.length} batch(es) selected
              </span>
            </label>

            {loadingBatches ? (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-indigo-600" /> Loading active batches...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1.5 rounded-xl border border-slate-200 bg-slate-50/50">
                {batches.map(b => {
                  const isChecked = selectedBatchIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-50/80 text-indigo-950 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedBatchIds(prev => prev.filter(id => id !== b.id));
                          } else {
                            setSelectedBatchIds(prev => [...prev, b.id]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="truncate">{b.name}</span>
                      <span className="text-[10px] text-slate-400 ml-auto shrink-0 font-mono">
                        {b.student_count || 0} stu
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Instructions & Questions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-600" /> Instructions &amp; Questions <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setInstructionsTab('write')}
                  className={`px-2.5 py-1 rounded-md transition ${instructionsTab === 'write' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'}`}
                >
                  Write / Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setInstructionsTab('preview')}
                  className={`px-2.5 py-1 rounded-md transition ${instructionsTab === 'preview' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'}`}
                >
                  Preview
                </button>
              </div>
            </div>

            {instructionsTab === 'write' ? (
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={5}
                required
                placeholder="Enter assignment requirements, questions, test cases, or submission guidelines..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs resize-y"
              />
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {instructions || <span className="text-slate-400 italic">No instructions provided.</span>}
              </div>
            )}
          </div>

          {/* Section: Deadlines & Scoring */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-600" /> Deadline Date &amp; Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Max Marks / Score
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={maxScore}
                onChange={e => setMaxScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Submission Type
              </label>
              <select
                value={submissionType}
                onChange={e => setSubmissionType(e.target.value as typeof submissionType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs bg-white"
              >
                <option value="both">Both (File + Text)</option>
                <option value="file_upload">File Upload Only</option>
                <option value="text_response">Text Response Only</option>
              </select>
            </div>
          </div>

          {/* Section: Allowed Formats (with .ipynb & coding file support) */}
          {submissionType !== 'text_response' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Code size={14} className="text-amber-600" /> Allowed Attachment Formats
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAllCoding}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    + All Code &amp; Notebooks
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllDocuments}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    + All Docs
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFormats(availableFormats)}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFormats([])}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Notebooks & Coding Formats Group */}
              <div className="space-y-1.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/90">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-950">
                  <Code size={13} className="text-amber-600" />
                  <span>Jupyter Notebooks &amp; Coding Files</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableFormats
                    .filter(fmt => codingFormats.includes(fmt) || (!standardFormats.includes(fmt) && !['pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg'].includes(fmt)))
                    .map(fmt => {
                      const isSelected = allowedFormats.includes(fmt);
                      const isNotebook = fmt === 'ipynb';
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAllowedFormats(allowedFormats.filter(f => f !== fmt));
                            } else {
                              setAllowedFormats([...allowedFormats, fmt]);
                            }
                          }}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? isNotebook
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-1 ring-amber-500'
                                : 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          .{fmt} {isNotebook && '📓'}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Documents & Images Group */}
              <div className="space-y-1.5 p-2.5 rounded-xl bg-white border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-700">
                  Documents &amp; Images
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableFormats
                    .filter(fmt => standardFormats.includes(fmt))
                    .map(fmt => {
                      const isSelected = allowedFormats.includes(fmt);
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAllowedFormats(allowedFormats.filter(f => f !== fmt));
                            } else {
                              setAllowedFormats([...allowedFormats, fmt]);
                            }
                          }}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          .{fmt}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Add Custom Extension Inline */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <div className="flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <span className="text-slate-400 font-mono font-bold mr-0.5">.</span>
                  <input
                    type="text"
                    value={customFormatInput}
                    onChange={e => setCustomFormatInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomFormat();
                      }
                    }}
                    placeholder="custom ext (e.g. r, go, rs)"
                    className="w-36 outline-none text-xs text-slate-800 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomFormat}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
                >
                  + Add Ext
                </button>
                <span className="text-[11px] text-slate-500 font-medium">
                  Active: <strong className="text-indigo-700">{allowedFormats.length}</strong> formats selected
                </span>
              </div>
            </div>
          )}

          {/* Section: Options */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allowLateSubmissions}
                onChange={e => setAllowLateSubmissions(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Allow Late Submissions (marked as late)</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Status:</span>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as typeof status)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="published">Active / Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Assignment Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
