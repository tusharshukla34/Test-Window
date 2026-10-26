'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Send,
  Eye,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
  Users,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Batch, Exam } from '@/lib/db/types';

interface EvaluationAttemptRow {
  id: string;
  exam_id: string;
  exam_title: string;
  exam_max_marks: number;
  student_id: string;
  student_name: string;
  student_id_code: string;
  student_email: string;
  batch_id: string | null;
  batch_name: string;
  status: string;
  submitted_at: string | null;
  time_spent_seconds: number;
  total_score: number | null;
  percentage: number | null;
  evaluation_status: 'pending_evaluation' | 'in_progress' | 'evaluated' | 'published';
  is_published: boolean;
  published_at: string | null;
  evaluated_at: string | null;
  evaluated_by: string | null;
  trainer_feedback: string | null;
  is_absent?: number | boolean;
  result_status?: string;
}

export default function AdminExamEvaluationsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attempts, setAttempts] = useState<EvaluationAttemptRow[]>([]);
  const [metrics, setMetrics] = useState({
    total_assigned: 0,
    not_started_count: 0,
    in_progress_count: 0,
    submitted_count: 0,
    pending_evaluation_count: 0,
    evaluated_count: 0,
    published_count: 0
  });
  const [loading, setLoading] = useState(true);

  // Multi-select for Batch Publishing
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [auditNote, setAuditNote] = useState('');
  const [publishing, setPublishing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBatch !== 'all') params.set('batch_id', selectedBatch);
      if (selectedExam !== 'all') params.set('exam_id', selectedExam);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/exams/evaluations?${params.toString()}`);
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();

      if (data && !data.error) {
        setBatches(Array.isArray(data.batches) ? data.batches : []);
        setExams(Array.isArray(data.exams) ? data.exams : []);
        setMetrics(data.metrics || {});
        setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
      }
    } catch (err) {
      console.error('Failed to load evaluations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatch, selectedExam, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Selection toggle
  const toggleSelectAllEvaluated = () => {
    const evaluatedIds = attempts
      .filter(a => a.evaluation_status === 'evaluated' || a.is_published)
      .map(a => a.student_id);

    if (selectedStudentIds.length === evaluatedIds.length && evaluatedIds.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(evaluatedIds);
    }
  };

  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Batch Result Publishing
  const handlePublishResults = async () => {
    if (!selectedExam || selectedExam === 'all') {
      alert('Please select a specific examination to publish results.');
      return;
    }
    if (!selectedBatch || selectedBatch === 'all') {
      alert('Please select a target batch to publish results.');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/admin/exams/evaluations/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: selectedExam,
          batch_id: selectedBatch,
          student_ids: selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
          audit_note: auditNote || 'Results published for batch'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publishing failed');

      alert(data.message || 'Results published successfully!');
      setPublishModalOpen(false);
      setSelectedStudentIds([]);
      setAuditNote('');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error publishing results');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
            <Sparkles size={13} /> Trainer Examination Evaluation Queue
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Examination Evaluations & Result Publishing
          </h1>
          <p className="text-xs text-slate-500">
            Inspect student answer sheets, review question marks, save drafts, and release results batch-wise.
          </p>
        </div>

        {/* Batch Publishing Action Button */}
        {selectedBatch !== 'all' && selectedExam !== 'all' && (
          <ClayButton
            onClick={() => setPublishModalOpen(true)}
            variant="primary"
            className="flex items-center gap-2 text-xs font-bold py-2.5 px-4 shadow-sm"
          >
            <Send size={15} /> Publish Results for Selected Batch
          </ClayButton>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1 block">{metrics.total_assigned}</span>
        </ClayCard>
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Not Started</span>
          <span className="text-xl font-black text-slate-600 font-mono mt-1 block">{metrics.not_started_count}</span>
        </ClayCard>
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-black text-blue-700 font-mono mt-1 block">{metrics.in_progress_count}</span>
        </ClayCard>
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Submitted</span>
          <span className="text-xl font-black text-indigo-700 font-mono mt-1 block">{metrics.submitted_count}</span>
        </ClayCard>
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Pending Eval</span>
          <span className="text-xl font-black text-amber-700 font-mono mt-1 block">{metrics.pending_evaluation_count}</span>
        </ClayCard>
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">Evaluated</span>
          <span className="text-xl font-black text-purple-700 font-mono mt-1 block">{metrics.evaluated_count}</span>
        </ClayCard>
        <ClayCard className="p-3 text-center bg-white">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Published</span>
          <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">{metrics.published_count}</span>
        </ClayCard>
      </div>

      {/* Filter Bar */}
      <ClayCard className="p-4 bg-white space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Cohort Batch Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">Filter Batch</label>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="all">All Cohort Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Exam Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">Filter Examination</label>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="all">All Examinations</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          {/* Evaluation Status Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">Evaluation Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="all">All Submitted Answer Sheets</option>
              <option value="pending_evaluation">Pending Evaluation</option>
              <option value="in_progress">In Progress (Draft)</option>
              <option value="evaluated">Evaluated (Ready to Publish)</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished Only</option>
              <option value="absent">Absent on Deadline (Unattempted)</option>
            </select>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">Search Student</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name or Student ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
            <ClayButton type="submit" variant="secondary" className="px-3 py-2 text-xs">
              Search
            </ClayButton>
          </form>
        </div>
      </ClayCard>

      {/* Submissions Table */}
      <ClayCard className="p-0 overflow-hidden bg-white border border-slate-200/80 shadow-xs">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs text-slate-800">
              Submitted Student Answer Sheets ({attempts.length})
            </span>
            {selectedStudentIds.length > 0 && (
              <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                {selectedStudentIds.length} Selected
              </span>
            )}
          </div>

          {/* Select all evaluated toggle */}
          {attempts.length > 0 && (
            <button
              onClick={toggleSelectAllEvaluated}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              {selectedStudentIds.length > 0 ? 'Deselect All' : 'Select All Evaluated'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading student answer sheets...</div>
        ) : attempts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ClipboardCheck size={36} className="mx-auto text-slate-300" />
            <p className="font-bold text-slate-700 text-sm">No exam submissions match criteria</p>
            <p className="text-xs text-slate-400">
              When students complete an examination, their answer sheets will arrive here for your evaluation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-10 text-center">Select</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Examination</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Trainer Score</th>
                  <th className="py-3 px-4">Evaluation Status</th>
                  <th className="py-3 px-4">Publication</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map(row => {
                  const isSelected = selectedStudentIds.includes(row.student_id);

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectStudent(row.student_id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.student_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{row.student_id_code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">{row.batch_name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">{row.exam_title}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {row.submitted_at
                          ? new Date(row.submitted_at).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {row.total_score !== null ? (
                          <span className="text-slate-900">
                            {row.total_score} <span className="text-slate-400 font-normal">/ {row.exam_max_marks}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.is_absent || row.result_status === 'absent_fail' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Absent (Missed Deadline)
                          </span>
                        ) : row.evaluation_status === 'published' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Evaluated & Published
                          </span>
                        ) : row.evaluation_status === 'evaluated' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Evaluated (Ready)
                          </span>
                        ) : row.evaluation_status === 'in_progress' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Draft in Progress
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Pending Evaluation
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.is_published ? (
                          <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                            <ShieldCheck size={13} /> Live for Student
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium">
                            Hidden from Student
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => router.push(`/admin/exam-evaluations/${row.id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Eye size={13} /> {row.is_absent || row.result_status === 'absent_fail' ? 'View Record' : 'Evaluate'} <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ClayCard>

      {/* Confirmation Modal for Batch Publishing */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <ClayCard className="max-w-md w-full p-6 bg-white space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Send size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Publish Examination Results</h3>
                <span className="text-xs text-slate-500">Official release to student dashboard</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Confirmation Checklist:</p>
              <p>
                You are about to publish results for{' '}
                <strong>
                  {selectedStudentIds.length > 0
                    ? `${selectedStudentIds.length} selected student(s)`
                    : 'all evaluated students in the batch'}
                </strong>.
              </p>
              <p className="text-[11px] text-amber-800">
                Once published, students will immediately be able to view their final marks, verified percentage, and detailed question-by-question solutions.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Release Notes / Audit Remarks (Optional)</label>
              <textarea
                value={auditNote}
                onChange={e => setAuditNote(e.target.value)}
                placeholder="e.g. Verified final answers after cohort discussion; bonus question 4 credited."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <ClayButton
                onClick={() => setPublishModalOpen(false)}
                variant="secondary"
                disabled={publishing}
                className="text-xs"
              >
                Cancel
              </ClayButton>
              <ClayButton
                onClick={handlePublishResults}
                variant="primary"
                disabled={publishing}
                className="text-xs font-bold flex items-center gap-1.5"
              >
                {publishing ? 'Publishing...' : 'Confirm & Release Results'}
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      )}
    </div>
  );
}
