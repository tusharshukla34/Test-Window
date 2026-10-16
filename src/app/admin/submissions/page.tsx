'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Check,
  Send,
  User,
  GraduationCap
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import FormattedInstructions from '@/components/ui/FormattedInstructions';
import { Batch, Assignment } from '@/lib/db/types';

interface SubmissionQueueItem {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  assignment_title: string;
  batch_name: string;
  version: number;
  text_response: string | null;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  submitted_at: string;
  is_late: boolean;
  status: 'submitted' | 'under_review' | 'evaluated';
  marks_awarded: number | null;
  feedback: string | null;
  feedback_released: boolean;
}

export default function SubmissionsQueuePage() {
  const [submissions, setSubmissions] = useState<SubmissionQueueItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Evaluation Modal
  const [activeSub, setActiveSub] = useState<SubmissionQueueItem | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [marks, setMarks] = useState<number | string>('');
  const [feedback, setFeedback] = useState('');
  const [releaseDraft, setReleaseDraft] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const fetchData = async () => {
    try {
      let url = '/api/admin/submissions?';
      if (selectedBatch) url += `batch_id=${selectedBatch}&`;
      if (selectedAssignment) url += `assignment_id=${selectedAssignment}&`;
      if (selectedStatus) url += `status=${selectedStatus}&`;

      const [resSubs, resBatches, resAsg] = await Promise.all([
        fetch(url),
        fetch('/api/admin/batches'),
        fetch('/api/admin/assignments')
      ]);

      if (resSubs.status === 401 || resSubs.status === 403 || resBatches.status === 401 || resBatches.status === 403) {
        window.location.href = '/login';
        return;
      }

      const subsData = await resSubs.json();
      const batchesData = await resBatches.json();
      const asgData = await resAsg.json();

      setSubmissions(Array.isArray(subsData) ? subsData : []);
      setBatches(Array.isArray(batchesData) ? batchesData : []);
      setAssignments(Array.isArray(asgData) ? asgData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatch, selectedAssignment, selectedStatus]);

  const handleOpenEvaluation = (sub: SubmissionQueueItem) => {
    setActiveSub(sub);
    setMarks(sub.marks_awarded !== null ? sub.marks_awarded : '');
    setFeedback(sub.feedback || '');
    setReleaseDraft(true);
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSub) return;
    setEvaluating(true);

    try {
      const res = await fetch(`/api/admin/submissions/${activeSub.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marks_awarded: Number(marks),
          feedback,
          release_draft: releaseDraft
        })
      });

      if (res.ok) {
        setActiveSub(null);
        fetchData();
      }
    } catch {}
    setEvaluating(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <CheckCircle2 size={24} className="text-indigo-600" /> Daily Homework Evaluation Queue
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Review student submissions, inspect attachments, award marks, and release written feedback.
        </p>
      </div>

      {/* Filter Bar */}
      <ClayCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Filter by Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="clay-input w-full p-2 text-xs"
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Filter by Assignment
            </label>
            <select
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
              className="clay-input w-full p-2 text-xs"
            >
              <option value="">All Assignments</option>
              {assignments.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Evaluation Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="clay-input w-full p-2 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="submitted">Needs Evaluation</option>
              <option value="evaluated">Already Evaluated</option>
            </select>
          </div>
        </div>
      </ClayCard>

      {/* Submissions List */}
      <ClayCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Student</th>
                <th className="p-3.5">Assignment</th>
                <th className="p-3.5">Batch</th>
                <th className="p-3.5">Submitted At</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Marks</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No submissions matching your filter criteria.
                  </td>
                </tr>
              ) : (
                submissions.map(sub => {
                  const subDate = new Date(sub.submitted_at);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{sub.student_name}</div>
                        <div className="text-[11px] font-mono text-indigo-600">{sub.student_code}</div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800 max-w-xs truncate">
                        {sub.assignment_title}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {sub.batch_name}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        <div>{subDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        {sub.is_late && (
                          <span className="text-[10px] font-bold text-rose-600">Late Submission</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'evaluated'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {sub.status === 'evaluated' ? 'Evaluated' : 'Pending Evaluation'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">
                        {sub.marks_awarded !== null ? `${sub.marks_awarded} pts` : '-'}
                      </td>
                      <td className="p-3.5 text-right">
                        <ClayButton
                          size="sm"
                          variant={sub.status === 'evaluated' ? 'outline' : 'primary'}
                          onClick={() => handleOpenEvaluation(sub)}
                        >
                          {sub.status === 'evaluated' ? 'Re-Evaluate' : 'Grade Work'}
                        </ClayButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>

      {/* Evaluation Modal */}
      <Modal
        isOpen={Boolean(activeSub)}
        onClose={() => setActiveSub(null)}
        title={`Evaluate Homework: ${activeSub?.assignment_title}`}
        maxWidth="max-w-2xl"
      >
        {activeSub && (
          <form onSubmit={handleSaveEvaluation} className="space-y-5">
            {/* Student & Submission Info Banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{activeSub.student_name} ({activeSub.student_code})</p>
                <p className="text-[11px] text-slate-500">Batch: {activeSub.batch_name} • Version #{activeSub.version}</p>
              </div>
              {activeSub.is_late && (
                <span className="text-xs font-bold px-2 py-1 bg-rose-100 text-rose-700 rounded-lg">
                  Submitted Late
                </span>
              )}
            </div>

            {/* View Assigned Questions Collapsible */}
            {(() => {
              const currentAsg = assignments.find((a) => a.id === activeSub.assignment_id);
              if (!currentAsg?.instructions) return null;
              return (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowQuestions(!showQuestions)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText size={13} className="text-indigo-600" />
                      View Assignment Questions & Instructions
                    </span>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      {showQuestions ? 'Hide' : 'Show Questions'}
                    </span>
                  </button>
                  {showQuestions && (
                    <div className="p-3 bg-white border-t border-slate-200">
                      <FormattedInstructions content={currentAsg.instructions} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Student Text Response */}
            {activeSub.text_response && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Written Response
                </label>
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap">
                  {activeSub.text_response}
                </div>
              </div>
            )}

            {/* Student Attachment */}
            {activeSub.file_url ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attached Deliverable
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-indigo-950">{activeSub.file_name || 'Downloadable Attachment'}</p>
                      {activeSub.file_size && (
                        <p className="text-[10px] text-indigo-600 font-mono">{(activeSub.file_size / (1024 * 1024)).toFixed(2)} MB</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={activeSub.file_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="clay-btn px-3 py-1.5 rounded-lg bg-white text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 hover:bg-indigo-50"
                  >
                    <Download size={14} /> Download File
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No file attachment submitted with this task.</p>
            )}

            {/* Marks & Feedback */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marks Awarded
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  placeholder="e.g. 45"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Feedback Release Status
                </label>
                <label className="flex items-center gap-2 pt-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={releaseDraft}
                    onChange={(e) => setReleaseDraft(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Release feedback to student immediately</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Written Trainer Feedback & Constructive Remarks
              </label>
              <textarea
                rows={4}
                placeholder="Provide constructive feedback, notes on diagrams or numerical working, and suggestions for improvement..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <ClayButton
                type="button"
                variant="secondary"
                onClick={() => setActiveSub(null)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="primary"
                disabled={evaluating}
              >
                <Send size={15} /> {evaluating ? 'Saving...' : 'Submit Evaluation'}
              </ClayButton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
