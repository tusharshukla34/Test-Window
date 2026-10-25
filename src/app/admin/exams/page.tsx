'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  ArrowRight,
  Trash2,
  Pencil,
  Target
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { Exam, Batch, QuestionBankItem } from '@/lib/db/types';

// Module-level in-memory cache for instant 0ms restoration
let cachedExams: (Exam & { recipient_batch_names: string[]; attempt_count: number })[] | null = null;
let cachedBatches: Batch[] | null = null;
let cachedQuestions: QuestionBankItem[] | null = null;

export default function AdminExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<(Exam & { recipient_batch_names: string[]; attempt_count: number })[]>(() => cachedExams || []);
  const [batches, setBatches] = useState<Batch[]>(() => cachedBatches || []);
  const [questions, setQuestions] = useState<QuestionBankItem[]>(() => cachedQuestions || []);
  const [loading, setLoading] = useState(() => !cachedExams);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [finalizingExamId, setFinalizingExamId] = useState<string | null>(null);

  const handleDeleteExam = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove and archive "${title}"?\n\n• Active student test sessions will be closed.\n• Unattempted students will be evaluated as Fail (Absent).\n• ALL scorecards, pass/fail audit reports, and student results will remain PERMANENTLY stored in your dashboard and the student portals.`)) {
      return;
    }
    // Optimistic Update: Mark as archived/removed
    const previous = exams;
    setExams(prev => {
      const updated = showArchived
        ? prev.map(e => e.id === id ? { ...e, is_deleted: 1, status: 'archived' as const } : e)
        : prev.filter(e => e.id !== id);
      cachedExams = updated;
      return updated;
    });

    try {
      const res = await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setExams(previous);
        cachedExams = previous;
        alert('Failed to delete exam');
      } else {
        fetchData();
      }
    } catch {
      setExams(previous);
      cachedExams = previous;
      alert('Error deleting exam');
    }
  };

  const handleFinalizeDeadline = async (id: string, title: string) => {
    if (!window.confirm(`Finalize deadline for "${title}" now?\n\nThis will instantly generate Fail/Absent scorecards (0 marks) for all students in assigned batches who haven't attempted the test, notify them, and update the pass/fail audit report.`)) {
      return;
    }
    setFinalizingExamId(id);
    try {
      const res = await fetch(`/api/admin/exams/${id}/finalize-deadline`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize deadline');
      alert(`Success! Finalized deadline for "${title}".\n• Absent Students Evaluated: ${data.evaluated_absent_count}\n• In-Progress Auto-Finalized: ${data.finalized_in_progress_count}\nScorecards are now permanently published!`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error finalizing deadline');
    } finally {
      setFinalizingExamId(null);
    }
  };

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [negativeMarking, setNegativeMarking] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [examTopicFilter, setExamTopicFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // Edit Exam Criteria Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<(Exam & { recipient_batch_names: string[]; attempt_count: number }) | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(20);
  const [editPassingPercentage, setEditPassingPercentage] = useState(40);
  const [editDeadline, setEditDeadline] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Dynamic calculations for exam creation
  const selectedQuestions = useMemo(() => {
    return questions.filter(q => selectedQuestionIds.includes(q.id));
  }, [questions, selectedQuestionIds]);

  const totalExamMarks = useMemo(() => {
    return selectedQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
  }, [selectedQuestions]);

  const requiredPassScore = useMemo(() => {
    return Number(((totalExamMarks * Number(passingPercentage || 0)) / 100).toFixed(1));
  }, [totalExamMarks, passingPercentage]);

  const fetchData = async () => {
    try {
      const [resExams, resBatches, resQuestions] = await Promise.all([
        fetch(`/api/admin/exams?includeDeleted=true&_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/admin/batches?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/admin/question-bank?_t=${Date.now()}`, { cache: 'no-store' })
      ]);

      if (resExams.status === 401 || resExams.status === 403 || resBatches.status === 401 || resBatches.status === 403) {
        router.push('/login');
        return;
      }

      const examsData = await resExams.json();
      const batchesData = await resBatches.json();
      const questionsData = await resQuestions.json();

      if (Array.isArray(examsData)) {
        cachedExams = examsData;
        setExams(examsData);
      }
      if (Array.isArray(batchesData)) {
        cachedBatches = batchesData;
        setBatches(batchesData);
      }
      if (Array.isArray(questionsData)) {
        cachedQuestions = questionsData;
        setQuestions(questionsData);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBatchIds.length === 0) {
      setError('Select at least one target batch.');
      return;
    }
    if (selectedQuestionIds.length === 0) {
      setError('Select at least one question.');
      return;
    }
    setError(null);

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          duration_minutes: durationMinutes,
          passing_percentage: Number(passingPercentage) || 40,
          negative_marking: Number(negativeMarking) || 0,
          end_window: deadline ? new Date(deadline).toISOString() : null,
          batch_ids: selectedBatchIds,
          question_ids: selectedQuestionIds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create examination');

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      setDeadline('');
      setPassingPercentage(40);
      setNegativeMarking(0);
      setSelectedQuestionIds([]);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const selectAllQuestions = () => {
    setSelectedQuestionIds(questions.map(q => q.id));
  };

  // Helper preset setters for deadline
  const setPresetDeadline = (preset: 'tonight' | 'tomorrow' | '48h' | 'clear') => {
    if (preset === 'clear') {
      setDeadline('');
      return;
    }
    const d = new Date();
    if (preset === 'tonight') {
      d.setHours(23, 59, 0, 0);
    } else if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 0, 0);
    } else if (preset === '48h') {
      d.setHours(d.getHours() + 48);
    }
    // format as YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setDeadline(formatted);
  };

  const openEditModal = (exam: Exam & { recipient_batch_names: string[]; attempt_count: number }) => {
    setEditingExam(exam);
    setEditTitle(exam.title);
    setEditDuration(exam.duration_minutes);
    setEditPassingPercentage(exam.passing_percentage ?? 40);
    if (exam.end_window) {
      const d = new Date(exam.end_window);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setEditDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setEditDeadline('');
    }
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/exams/${editingExam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          duration_minutes: Number(editDuration) || 20,
          passing_percentage: Number(editPassingPercentage) || 40,
          end_window: editDeadline ? new Date(editDeadline).toISOString() : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update exam');
      setIsEditOpen(false);
      fetchData();
      alert(`Success! Updated passing cutoff to ${editPassingPercentage}% (${((editingExam.max_marks * editPassingPercentage) / 100).toFixed(1)} marks).\nStudent scorecards & audit reports have been re-evaluated!`);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error updating exam');
    } finally {
      setEditSaving(false);
    }
  };

  const setEditPresetDeadline = (preset: 'tonight' | 'tomorrow' | '48h' | 'clear') => {
    if (preset === 'clear') {
      setEditDeadline('');
      return;
    }
    const d = new Date();
    if (preset === 'tonight') {
      d.setHours(23, 59, 0, 0);
    } else if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 0, 0);
    } else if (preset === '48h') {
      d.setHours(d.getHours() + 48);
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    setEditDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const displayedExams = exams.filter(e => showArchived ? true : !e.is_deleted);
  const activeExamsCount = exams.filter(e => !e.is_deleted).length;
  const archivedExamsCount = exams.filter(e => e.is_deleted).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-indigo-600" /> Online Examination Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure timed tests with server deadlines, automatic pass/fail evaluation, and permanent scorecards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ClayButton
            variant="primary"
            onClick={() => {
              if (batches.length > 0) setSelectedBatchIds([batches[0].id]);
              selectAllQuestions();
              setIsCreateOpen(true);
            }}
            className="shadow-md"
          >
            <Plus size={16} /> Schedule Online Exam
          </ClayButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              !showArchived
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Active Exams
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${!showArchived ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {activeExamsCount}
            </span>
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              showArchived
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Conducted & Archived
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${showArchived ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {exams.length}
            </span>
          </button>
        </div>
        {archivedExamsCount > 0 && (
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {archivedExamsCount} removed exams preserved permanently
          </span>
        )}
      </div>

      {/* Exams Grid */}
      {displayedExams.length === 0 ? (
        <ClayCard className="p-12 text-center text-slate-500 space-y-3">
          <FileSpreadsheet size={40} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-800 text-base">No examinations found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click &quot;Schedule Online Exam&quot; to assign a new test with deadline and pass criteria.
          </p>
        </ClayCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedExams.map(exam => {
            const isArchived = Boolean(exam.is_deleted);
            const hasDeadline = Boolean(exam.end_window);
            const isDeadlinePassed = hasDeadline && new Date(exam.end_window!) <= new Date();

            return (
              <ClayCard
                key={exam.id}
                className={`flex flex-col justify-between transition ${
                  isArchived ? 'bg-slate-50/80 border-dashed border-slate-300' : 'hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {exam.total_questions} Questions
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isArchived ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Archived Ledger
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {exam.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {exam.description || 'Full comprehensive mock examination for enrolled students.'}
                    </p>
                  </div>

                  {/* Deadline & Pass Criteria Banner */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Clock size={12} className={isDeadlinePassed ? 'text-rose-500' : 'text-indigo-600'} />
                        Deadline:
                      </span>
                      {hasDeadline ? (
                        <span className={`font-bold font-mono ${isDeadlinePassed ? 'text-rose-700' : 'text-slate-800'}`}>
                          {new Date(exam.end_window!).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No Deadline Set</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-semibold">Pass Cutoff:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        ≥{exam.passing_percentage ?? 40}% ({((exam.max_marks * (exam.passing_percentage ?? 40)) / 100).toFixed(1)} / {exam.max_marks}m)
                      </span>
                    </div>

                    {hasDeadline && isDeadlinePassed && !isArchived && (
                      <div className="pt-1 text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                        <AlertCircle size={11} /> Deadline has elapsed — absent students evaluated as Fail
                      </div>
                    )}
                  </div>

                  {/* Timing & Scoring details */}
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-100/60 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Duration</span>
                      <span className="font-bold text-slate-800 font-mono">{exam.duration_minutes} Mins</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Negative Penalty</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {Number(exam.negative_marking || 0) > 0 ? `-${exam.negative_marking} / wrong` : 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Target Batches */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Batches</p>
                    <div className="flex flex-wrap gap-1">
                      {(exam.recipient_batch_names || []).map((bName, i) => (
                        <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {bName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="text-xs font-bold text-indigo-700">
                    {exam.attempt_count} attempts taken
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!isArchived && (
                      <button
                        onClick={() => openEditModal(exam)}
                        title="Edit Passing Cutoff & Deadline"
                        className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil size={11} /> Edit Cutoff
                      </button>
                    )}
                    {hasDeadline && !isArchived && (
                      <button
                        onClick={() => handleFinalizeDeadline(exam.id, exam.title)}
                        disabled={finalizingExamId === exam.id}
                        title="Finalize Absent Students and Generate Scorecards"
                        className="px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition disabled:opacity-50"
                      >
                        {finalizingExamId === exam.id ? 'Evaluating...' : 'Finalize Absent'}
                      </button>
                    )}
                    <ClayButton
                      variant="teal"
                      size="sm"
                      onClick={() => router.push(`/admin/exams/${exam.id}/analytics`)}
                    >
                      <BarChart3 size={14} /> Analytics & Ranks
                    </ClayButton>
                    {!isArchived && (
                      <button
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        title="Remove Exam (Preserves all scorecards permanently)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}

      {/* Create Exam Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule Online Examination"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateExam} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Thermodynamics for All AE/JE ME Exams Mock Test"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          {/* Duration & Negative Penalty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min={5}
                max={300}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Negative Penalty</label>
              <select
                value={negativeMarking}
                onChange={(e) => setNegativeMarking(Number(e.target.value))}
                className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
              >
                <option value={0}>0.0 (No penalty)</option>
                <option value={0.25}>-0.25 per wrong</option>
                <option value={0.33}>-0.33 (1/3rd)</option>
                <option value={0.5}>-0.50 (Half mark)</option>
                <option value={1}>-1.00 (Full penalty)</option>
              </select>
            </div>
          </div>

          {/* Manual Passing Percentage & Cutoff Configuration */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Target size={14} className="text-emerald-700" /> Passing Percentage & Cutoff Marks (Manual Setting)
              </label>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                Trainer Controlled
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-full sm:w-44">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Passing Cutoff (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={passingPercentage}
                    onChange={(e) => setPassingPercentage(Number(e.target.value))}
                    className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono pr-8 font-bold text-sm bg-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Quick Presets:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[33, 40, 50, 60, 75].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPassingPercentage(pct)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        Number(passingPercentage) === pct
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Calculated Required Score Preview */}
            <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-slate-500 text-[11px]">Exam Scope: <strong>{selectedQuestionIds.length} Questions</strong> ({totalExamMarks} Total Marks)</span>
                <div className="font-bold text-emerald-900 text-xs sm:text-sm mt-0.5">
                  Required Pass Score: <span className="font-mono text-emerald-700 text-sm font-extrabold">{requiredPassScore.toFixed(1)} marks</span> ({passingPercentage}%)
                </div>
              </div>
              <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-100 sm:text-right">
                Score ≥ <strong>{requiredPassScore.toFixed(1)}</strong>: <span className="text-emerald-700 font-bold">PASS</span><br />
                Score &lt; <strong>{requiredPassScore.toFixed(1)}</strong>: <span className="text-rose-600 font-bold">FAIL</span>
              </div>
            </div>
          </div>

          {/* Exam Deadline & Auto-Fail Policy */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Clock size={14} className="text-amber-700" /> Exam Deadline & Submission Window (Optional)
              </label>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                Auto-Fail on Expiry
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="clay-input flex-1 p-2 text-xs text-slate-800 font-mono bg-white"
              />
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPresetDeadline('tonight')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  Tonight 11:59 PM
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDeadline('tomorrow')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDeadline('48h')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  48 Hours
                </button>
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setPresetDeadline('clear')}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Deadline Rule:</strong> If a student in the target cohort does not attempt the exam before this deadline, the system automatically evaluates them as <strong>Fail (Absent)</strong> with 0 marks. Official scorecards will be generated permanently for both the student portal and trainer dashboard audit ledger.
            </p>
          </div>

          {/* Target Batches Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Target Cohorts / Batches
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {batches.map(b => (
                <label key={b.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(b.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBatchIds([...selectedBatchIds, b.id]);
                      else setSelectedBatchIds(selectedBatchIds.filter(id => id !== b.id));
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{b.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Select Questions from Question Bank */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Select Exam Questions ({selectedQuestionIds.length} of {questions.length} selected • {totalExamMarks} Marks Total)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllQuestions}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds([])}
                  className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Topic Filter for Questions in Exam Modal */}
            <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-slate-100/70 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-600 shrink-0">Filter Topic:</span>
              <select
                value={examTopicFilter}
                onChange={(e) => setExamTopicFilter(e.target.value)}
                className="clay-input py-1 px-2 text-xs text-slate-800 flex-1"
              >
                <option value="all">All Topics ({questions.length} questions)</option>
                {Array.from(new Set(questions.map(q => q.topic).filter(Boolean))).map(t => {
                  const count = questions.filter(q => q.topic === t).length;
                  return <option key={t} value={t}>{t} ({count})</option>;
                })}
              </select>
              {examTopicFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    const topicQuestionIds = questions.filter(q => q.topic === examTopicFilter).map(q => q.id);
                    setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...topicQuestionIds])));
                  }}
                  className="px-2.5 py-1 bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-bold rounded-lg transition cursor-pointer shrink-0"
                >
                  + Add All in Topic
                </button>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {questions
                .filter(q => examTopicFilter === 'all' || q.topic === examTopicFilter)
                .map((q, idx) => (
                <label
                  key={q.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer border transition ${
                    selectedQuestionIds.includes(q.id)
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-medium'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.includes(q.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                      else setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                    }}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-900">Q{idx + 1}.</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 uppercase font-mono">
                        {q.question_type === 'coding' ? `Coding (${q.coding_language || 'c'})` : q.question_type || 'MCQ'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1 rounded">+{q.marks}m</span>
                      <span className="text-[10px] text-slate-400">({q.topic})</span>
                    </div>
                    <p className="line-clamp-2 text-slate-800 whitespace-pre-line">{q.question_text}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              Schedule & Publish Exam
            </ClayButton>
          </div>
        </form>
      </Modal>

      {/* Edit Exam Criteria & Cutoff Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Exam Passing Cutoff & Deadline"
      >
        <form onSubmit={handleUpdateExam} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {editError}
            </div>
          )}

          {editingExam && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900 text-sm">{editingExam.title}</div>
              <div className="flex items-center gap-3 text-slate-500 text-[11px] flex-wrap">
                <span>Total Questions: <strong>{editingExam.total_questions}</strong></span>
                <span>•</span>
                <span>Maximum Marks: <strong className="text-slate-800 font-mono">{editingExam.max_marks} marks</strong></span>
                <span>•</span>
                <span>Target Batches: <strong>{(editingExam.recipient_batch_names || []).join(', ') || 'Assigned'}</strong></span>
              </div>
            </div>
          )}

          {/* Passing Percentage & Cutoff Box */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Target size={14} className="text-emerald-700" /> Adjust Passing Percentage & Cutoff Marks
              </label>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                Live Re-evaluation
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-full sm:w-44">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Passing Cutoff (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={editPassingPercentage}
                    onChange={(e) => setEditPassingPercentage(Number(e.target.value))}
                    className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono pr-8 font-bold text-sm bg-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Quick Presets:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[33, 40, 50, 60, 75].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setEditPassingPercentage(pct)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        Number(editPassingPercentage) === pct
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {editingExam && (
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-emerald-950 text-xs sm:text-sm">
                    Required Pass Score: <span className="font-mono text-emerald-700 text-sm font-extrabold">{((editingExam.max_marks * Number(editPassingPercentage || 0)) / 100).toFixed(1)} marks</span> ({editPassingPercentage}%)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Calculated out of {editingExam.max_marks} Total Marks
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-100 sm:text-right">
                  Score ≥ <strong>{((editingExam.max_marks * Number(editPassingPercentage || 0)) / 100).toFixed(1)}</strong>: <span className="text-emerald-700 font-bold">PASS</span><br />
                  Score &lt; <strong>{((editingExam.max_marks * Number(editPassingPercentage || 0)) / 100).toFixed(1)}</strong>: <span className="text-rose-600 font-bold">FAIL</span>
                </div>
              </div>
            )}
          </div>

          {/* Exam Title & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min={5}
                max={300}
                required
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value))}
                className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Exam Deadline */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Clock size={14} className="text-amber-700" /> Deadline & Auto-Fail Window
              </label>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="datetime-local"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="clay-input flex-1 p-2 text-xs text-slate-800 font-mono bg-white"
              />
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setEditPresetDeadline('tonight')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Tonight
                </button>
                <button
                  type="button"
                  onClick={() => setEditPresetDeadline('tomorrow')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setEditPresetDeadline('48h')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  48 Hours
                </button>
                {editDeadline && (
                  <button
                    type="button"
                    onClick={() => setEditPresetDeadline('clear')}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsEditOpen(false)}
              disabled={editSaving}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary" disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save & Re-evaluate'}
            </ClayButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
