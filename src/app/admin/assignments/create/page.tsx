'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Calendar, Clock, ArrowLeft, Send, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Batch } from '@/lib/db/types';

export default function CreateAssignmentPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<(Batch & { student_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Mechanical Engineering');
  const [instructions, setInstructions] = useState('');
  const [submissionType, setSubmissionType] = useState<'both' | 'file_upload' | 'text_response'>('both');
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['pdf', 'docx', 'png']);
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

  const allFormats = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg'];

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
                placeholder="e.g. Mechanical Engineering / Heat Transfer"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Homework Instructions
              </label>
              <textarea
                rows={6}
                required
                placeholder="Enter complete instructions for students, problem statements, expected deliverables, and formatting expectations..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
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
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Allowed Attachment Formats
                </label>
                <div className="flex flex-wrap gap-2">
                  {allFormats.map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        if (allowedFormats.includes(fmt)) {
                          setAllowedFormats(allowedFormats.filter(f => f !== fmt));
                        } else {
                          setAllowedFormats([...allowedFormats, fmt]);
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                        allowedFormats.includes(fmt)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      .{fmt}
                    </button>
                  ))}
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
