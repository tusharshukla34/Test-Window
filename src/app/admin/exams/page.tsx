'use client';

import React, { useEffect, useState } from 'react';
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
  Trash2
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { Exam, Batch, QuestionBankItem } from '@/lib/db/types';

export default function AdminExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<(Exam & { recipient_batch_names: string[]; attempt_count: number })[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleDeleteExam = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? All attempts and student responses for this exam will also be removed.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExams(prev => prev.filter(e => e.id !== id));
      } else {
        alert('Failed to delete exam');
      }
    } catch {
      alert('Error deleting exam');
    }
  };

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [negativeMarking, setNegativeMarking] = useState(0.25);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resExams, resBatches, resQuestions] = await Promise.all([
        fetch('/api/admin/exams'),
        fetch('/api/admin/batches'),
        fetch('/api/admin/question-bank')
      ]);

      const examsData = await resExams.json();
      const batchesData = await resBatches.json();
      const questionsData = await resQuestions.json();

      setExams(examsData);
      setBatches(batchesData);
      setQuestions(questionsData);
    } catch {}
    setLoading(false);
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
          negative_marking: negativeMarking,
          batch_ids: selectedBatchIds,
          question_ids: selectedQuestionIds
        })
      });

      if (!res.ok) throw new Error('Failed to create examination');

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      setSelectedQuestionIds([]);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const selectAllQuestions = () => {
    setSelectedQuestionIds(questions.map(q => q.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-indigo-600" /> Online Examination Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure timed tests with server-authoritative timers, negative marking, and real-time analytics.
          </p>
        </div>
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

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {exams.map(exam => (
          <ClayCard key={exam.id} className="flex flex-col justify-between hover:border-slate-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {exam.total_questions} Questions
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {exam.status}
                </span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                {exam.title}
              </h3>

              <p className="text-xs text-slate-500 line-clamp-2">
                {exam.description || 'Full comprehensive mock examination for AE/JE aspirants.'}
              </p>

              {/* Timing & Scoring details */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Duration</span>
                  <span className="font-bold text-slate-800 font-mono">{exam.duration_minutes} Mins</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Marking Scheme</span>
                  <span className="font-bold text-emerald-700 font-mono">+{exam.marks_per_question} / -{exam.negative_marking}</span>
                </div>
              </div>

              {/* Target Batches */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Batches</p>
                <div className="flex flex-wrap gap-1">
                  {exam.recipient_batch_names.map((bName, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {bName}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-xs font-bold text-indigo-700">
                {exam.attempt_count} attempts taken
              </span>

              <div className="flex items-center gap-2">
                <ClayButton
                  variant="teal"
                  size="sm"
                  onClick={() => router.push(`/admin/exams/${exam.id}/analytics`)}
                >
                  <BarChart3 size={14} /> Analytics & Ranks
                </ClayButton>
                <button
                  onClick={() => handleDeleteExam(exam.id, exam.title)}
                  title="Delete Exam"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </ClayCard>
        ))}
      </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Negative Marking Penalty</label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={2}
                required
                value={negativeMarking}
                onChange={(e) => setNegativeMarking(Number(e.target.value))}
                className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
              />
            </div>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Select Exam Questions ({selectedQuestionIds.length} of {questions.length} selected)
              </label>
              <button
                type="button"
                onClick={selectAllQuestions}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
              >
                Select All Questions
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {questions.map((q, idx) => (
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
                  <div className="flex-1">
                    <span className="font-bold text-slate-900">Q{idx + 1}. </span>
                    <span>{q.question_text}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Topic: {q.topic}</span>
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
    </div>
  );
}
