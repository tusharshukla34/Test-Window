'use client';

import React, { useEffect, useState } from 'react';
import { HelpCircle, Plus, Search, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { QuestionBankItem } from '@/lib/db/types';

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // New question form state
  const [subject, setSubject] = useState('Mechanical Engineering');
  const [topic, setTopic] = useState('Thermodynamics');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionText, setQuestionText] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [opt4, setOpt4] = useState('');
  const [correctOptionId, setCorrectOptionId] = useState('opt1');
  const [explanation, setExplanation] = useState('');
  const [marks, setMarks] = useState(1.0);
  const [penalty, setPenalty] = useState(0.25);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/admin/question-bank');
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setQuestions(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!opt1 || !opt2 || !opt3 || !opt4) {
      setError('Please provide all 4 answer options.');
      return;
    }

    try {
      const res = await fetch('/api/admin/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic,
          difficulty,
          question_text: questionText,
          options: [
            { id: 'opt1', text: opt1 },
            { id: 'opt2', text: opt2 },
            { id: 'opt3', text: opt3 },
            { id: 'opt4', text: opt4 },
          ],
          correct_option_id: correctOptionId,
          explanation,
          marks,
          negative_penalty: penalty
        })
      });

      if (!res.ok) throw new Error('Failed to create question');

      setIsAddOpen(false);
      setQuestionText('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
      setExplanation('');
      fetchQuestions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await fetch(`/api/admin/question-bank/${id}`, { method: 'DELETE' });
      fetchQuestions();
    } catch {}
  };

  const filtered = questions.filter(q =>
    q.question_text.toLowerCase().includes(search.toLowerCase()) ||
    q.topic.toLowerCase().includes(search.toLowerCase()) ||
    q.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <HelpCircle size={24} className="text-indigo-600" /> Question Bank Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organize objective single-choice questions with answer keys and post-exam explanations.
          </p>
        </div>
        <ClayButton
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          className="shadow-md"
        >
          <Plus size={16} /> Add New Question
        </ClayButton>
      </div>

      {/* Search */}
      <ClayCard className="p-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search questions by text or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pl-9 pr-3 py-2 text-xs"
          />
          <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
            <Search size={14} />
          </div>
        </div>
      </ClayCard>

      {/* Questions List */}
      <div className="space-y-4">
        {filtered.map((q, idx) => (
          <ClayCard key={q.id} className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Q#{idx + 1}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {q.subject} • <span className="text-indigo-600">{q.topic}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                  +{q.marks} Mark
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100">
                  -{q.negative_penalty} Penalty
                </span>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <p className="text-sm font-bold text-slate-900">
              {q.question_text}
            </p>

            {/* Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {q.options.map((opt) => {
                const isCorrect = opt.id === q.correct_option_id;
                return (
                  <div
                    key={opt.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                      isCorrect
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {opt.id.replace('opt', '')}
                    </span>
                    <span>{opt.text}</span>
                    {isCorrect && <CheckCircle2 size={14} className="text-emerald-600 ml-auto" />}
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            {q.explanation && (
              <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900">
                <strong>Review Explanation:</strong> {q.explanation}
              </div>
            )}
          </ClayCard>
        ))}
      </div>

      {/* Add Question Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Question to Bank"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateQuestion} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Topic</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Question Statement</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. The third law of thermodynamics is all about..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="clay-input w-full p-2 text-xs text-slate-800"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-slate-700">
              Answer Options & Mark Correct Answer
            </label>

            {[
              { id: 'opt1', label: 'Option 1', val: opt1, setVal: setOpt1 },
              { id: 'opt2', label: 'Option 2', val: opt2, setVal: setOpt2 },
              { id: 'opt3', label: 'Option 3', val: opt3, setVal: setOpt3 },
              { id: 'opt4', label: 'Option 4', val: opt4, setVal: setOpt4 },
            ].map(o => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctOptionId === o.id}
                  onChange={() => setCorrectOptionId(o.id)}
                  title="Mark as correct answer"
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <input
                  type="text"
                  required
                  placeholder={`${o.label} text`}
                  value={o.val}
                  onChange={(e) => o.setVal(e.target.value)}
                  className="clay-input flex-1 p-2 text-xs text-slate-800"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Explanation for Post-Exam Review
            </label>
            <textarea
              rows={2}
              placeholder="Scientific principle and formula rationale..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="clay-input w-full p-2 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              Save Question
            </ClayButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
