'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, Calendar, Clock, ArrowLeft, Send, CheckCircle2, ShieldCheck, Users,
  Eye, Edit3, PlusCircle, List, Code, Bold, Sparkles, HelpCircle
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import FormattedInstructions from '@/components/ui/FormattedInstructions';
import { Batch } from '@/lib/db/types';

export default function CreateAssignmentPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<(Batch & { student_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [instructions, setInstructions] = useState('');
  const [instructionsTab, setInstructionsTab] = useState<'write' | 'preview'>('write');
  const [submissionType, setSubmissionType] = useState<'both' | 'file_upload' | 'text_response'>('both');
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['pdf', 'docx', 'png', 'ipynb', 'py']);
  const [customFormatInput, setCustomFormatInput] = useState('');
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(15);
  const [maxScore, setMaxScore] = useState(50);
  const [rubric, setRubric] = useState('');
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(true);

  // Default deadline = 3 days from now
  const defaultDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [deadline, setDeadline] = useState(defaultDeadline);

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/batches')
      .then(res => res.json())
      .then(data => {
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatchIds([data[0].id]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const eligibleStudentCount = batches
    .filter(b => selectedBatchIds.includes(b.id))
    .reduce((sum, b) => sum + b.student_count, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBatchIds.length === 0) {
      setError('Please select at least one target batch.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          instructions,
          submission_type: submissionType,
          allowed_formats: allowedFormats,
          max_file_size_mb: maxFileSizeMb,
          max_score: maxScore,
          rubric,
          allow_late_submissions: allowLateSubmissions,
          deadline: new Date(deadline).toISOString(),
          batch_ids: selectedBatchIds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish assignment');

      router.push('/admin/assignments');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating assignment');
      setSubmitting(false);
    }
  };

  const standardFormats = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg'];
  const codingFormats = ['ipynb', 'py', 'java', 'cpp', 'c', 'cs', 'js', 'ts', 'html', 'css', 'sql', 'json', 'zip'];
  const [availableFormats, setAvailableFormats] = useState<string[]>([
    'pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg',
    'ipynb', 'py', 'java', 'cpp', 'c', 'cs', 'js', 'ts', 'html', 'css', 'sql', 'json', 'zip'
  ]);

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white text-slate-600 hover:text-slate-900 shadow-xs border border-slate-200 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-indigo-600" /> Create Daily Assignment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Publish coursework with batch-restricted visibility and strict deadline management.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-in fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details (2 cols) */}
          <ClayCard className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
              1. Assignment Details & Instructions
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assignment Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Thermodynamics Cycle Analysis & Efficiency Report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject / Topic
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Python Programming / Web Development"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>

            {/* Detailed Homework Instructions & Questions */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Detailed Homework Instructions & Questions
                </label>
                
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInstructionsTab('write')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      instructionsTab === 'write'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructionsTab('preview')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      instructionsTab === 'preview'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-indigo-600'
                    }`}
                  >
                    <Eye size={12} /> Student Preview
                  </button>
                </div>
              </div>

              {/* Formatting Toolbar */}
              {instructionsTab === 'write' && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Quick Format:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const template = `General Instructions:
- Read all question statements and constraints carefully before attempting.
- Provide proper comments or derivations along with your answer.
- Submit clean code or upload your solution document before the deadline.

Q1. Write a function to solve the given problem statement.
- Input: Array of numbers [3, 7, 2, 9, 5]
- Expected Output: Maximum value = 9
- Marks: [10 Marks]

Q2. What is the time complexity and space complexity of your algorithm?
- Explain your reasoning in 2-3 sentences.
- Marks: [5 Marks]`;
                      setInstructions((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${template}` : template));
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition"
                    title="Insert full sample assignment template with Q1, Q2, instructions"
                  >
                    <Sparkles size={12} className="text-indigo-600" /> + Insert Template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const matches = instructions.match(/(?:Q\d+|Question\s*\d+|\d+[\.\)])/gi);
                      const nextNum = (matches?.length || 0) + 1;
                      const qBlock = `Q${nextNum}. [Enter Question Title / Problem Statement here]\n- Description & Constraints: \n- Expected Output: \n- Marks: [10 Marks]`;
                      setInstructions((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${qBlock}` : qBlock));
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200 transition shadow-2xs"
                  >
                    <PlusCircle size={12} className="text-emerald-600" /> + Add Question
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInstructions((prev) => (prev.trim() ? `${prev.trimEnd()}\n- ` : '- '));
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200 transition shadow-2xs"
                  >
                    <List size={12} className="text-slate-500" /> Bullet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = '```python\n# Paste or write code snippet here\ndef solution():\n    pass\n```';
                      setInstructions((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${snippet}\n` : `${snippet}\n`));
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200 transition shadow-2xs"
                  >
                    <Code size={12} className="text-purple-600" /> Code Block
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInstructions((prev) => (prev.trim() ? `${prev.trimEnd()}\n**Important:** ` : '**Important:** '));
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 transition shadow-2xs"
                  >
                    <Bold size={12} className="text-slate-700" /> Bold
                  </button>
                </div>
              )}

              {/* Input Area or Live Student Preview */}
              {instructionsTab === 'write' ? (
                <>
                  <textarea
                    rows={8}
                    required
                    placeholder="Enter complete instructions for students, problem statements, expected deliverables, and formatting expectations...&#10;&#10;Tip: Start questions with 'Q1.', 'Q2.' or '1.' to auto-generate beautiful question cards with marks badges!"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="clay-input w-full p-3 text-xs text-slate-800 font-mono leading-relaxed resize-y min-h-[160px]"
                  />
                  <div className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-500 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100/60">
                    <HelpCircle size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-indigo-950 font-bold">Smart Auto-Detection:</strong> Lines starting with <strong className="text-slate-800">Q1.</strong>, <strong className="text-slate-800">Q2.</strong>, or <strong className="text-slate-800">1.</strong> and markers like <strong className="text-slate-800">[10 Marks]</strong> will automatically convert into separate, styled Question Cards with badges for students. Click <strong className="text-indigo-600">Student Preview</strong> above anytime to check!
                    </span>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/20 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100 text-xs">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Eye size={13} className="text-indigo-600" />
                      Live Student View (How students will see this):
                    </span>
                    <button
                      type="button"
                      onClick={() => setInstructionsTab('write')}
                      className="text-[11px] font-bold text-indigo-700 hover:underline"
                    >
                      ← Back to Edit
                    </button>
                  </div>
                  <FormattedInstructions content={instructions} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Submission Mode
                </label>
                <select
                  value={submissionType}
                  onChange={(e) => setSubmissionType(e.target.value as any)}
                  className="clay-input w-full p-2.5 text-xs text-slate-800"
                >
                  <option value="both">File Upload + Text Response</option>
                  <option value="file_upload">File Upload Only</option>
                  <option value="text_response">Text Response Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Score / Marks
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
                />
              </div>
            </div>

            {/* Allowed Formats */}
            {submissionType !== 'text_response' && (
              <div className="pt-2 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Allowed Attachment Formats
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSelectAllCoding}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition cursor-pointer"
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
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowedFormats([])}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Notebooks & Coding Formats Group */}
                <div className="space-y-1.5 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
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

                {/* Documents & Media Group */}
                <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
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
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
          </ClayCard>

          {/* Right Column: Targeting, Deadlines & Pre-Publish Preview */}
          <div className="space-y-6">
            <ClayCard className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" /> 2. Target Batches
              </h3>

              <p className="text-xs text-slate-500">
                Only students enrolled in the selected batches will receive access.
              </p>

              <div className="space-y-2">
                {batches.map(b => (
                  <label
                    key={b.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                      selectedBatchIds.includes(b.id)
                        ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBatchIds([...selectedBatchIds, b.id]);
                          } else {
                            setSelectedBatchIds(selectedBatchIds.filter(id => id !== b.id));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{b.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {b.student_count} students
                    </span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Submission Deadline (IST)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="clay-input w-full p-2.5 text-xs text-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={allowLateSubmissions}
                  onChange={(e) => setAllowLateSubmissions(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Allow late submissions (flagged as late)</span>
              </label>
            </ClayCard>

            {/* Pre-Publishing Audit Preview */}
            <ClayCard variant="teal" className="space-y-2.5">
              <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={16} /> Pre-Publish Audit Summary
              </h4>
              <div className="text-xs text-teal-950 space-y-1">
                <p>• <strong>Target Cohorts:</strong> {selectedBatchIds.length} batch(es) selected</p>
                <p>• <strong>Eligible Students:</strong> ~{eligibleStudentCount} students</p>
                <p>• <strong>Max Marks:</strong> {maxScore} points</p>
                <p>• <strong>Isolation Guarantee:</strong> Students in other batches will be rejected server-side</p>
              </div>

              <ClayButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitting}
                className="w-full mt-3 shadow-lg"
              >
                <Send size={16} /> {submitting ? 'Publishing...' : 'Publish Assignment to Batches'}
              </ClayButton>
            </ClayCard>
          </div>
        </div>
      </form>
    </div>
  );
}
