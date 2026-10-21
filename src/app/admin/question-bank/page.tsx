'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  HelpCircle,
  Plus,
  Search,
  Trash2,
  Pencil,
  CheckCircle2,
  Tag,
  Sparkles,
  BookOpen,
  Filter,
  Layers,
  Code2,
  FileText,
  UploadCloud,
  Check
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { QuestionBankItem } from '@/lib/db/types';

const QUICK_TOPIC_PRESETS = [
  { subject: 'Python Programming', topic: 'Python Basics & Syntax' },
  { subject: 'Python Programming', topic: 'Data Structures (Lists, Tuples, Dicts, Sets)' },
  { subject: 'Python Programming', topic: 'Functions, Lambda & Modules' },
  { subject: 'Python Programming', topic: 'Object-Oriented Programming (OOP)' },
  { subject: 'Python Libraries', topic: 'NumPy (Arrays & Matrix Operations)' },
  { subject: 'Python Libraries', topic: 'Pandas (Series & DataFrames)' },
  { subject: 'Python Libraries', topic: 'Matplotlib & Data Visualization' },
  { subject: 'Python Programming', topic: 'Exception Handling & File I/O' },
  { subject: 'Python Programming', topic: 'Regular Expressions (Regex)' },
  { subject: 'Computer Science', topic: 'Data Structures & Algorithms' },
];

// In-memory module cache for instant 0ms restoration
let cachedQuestions: QuestionBankItem[] | null = null;

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>(() => cachedQuestions || []);
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(() => !cachedQuestions);

  // New question form state - Default to Python
  const [subject, setSubject] = useState('Python Programming');
  const [topic, setTopic] = useState('Python Basics & Syntax');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionType, setQuestionType] = useState<'mcq' | 'coding'>('mcq');
  const [codingLanguage, setCodingLanguage] = useState<'c' | 'cpp' | 'java' | 'python' | 'javascript'>('python');
  const [codeTemplate, setCodeTemplate] = useState('');

  const [questionText, setQuestionText] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [opt4, setOpt4] = useState('');
  const [correctOptionId, setCorrectOptionId] = useState('opt1');
  const [explanation, setExplanation] = useState('');
  const [marks, setMarks] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`/api/admin/question-bank?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        cachedQuestions = data;
        setQuestions(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Compute unique subjects and topics dynamically from question bank
  const uniqueSubjects = useMemo(() => {
    const set = new Set(questions.map(q => q.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [questions]);

  const uniqueTopics = useMemo(() => {
    const set = new Set(questions.map(q => q.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [questions]);

  // Topic statistics for filter pills
  const topicStats = useMemo(() => {
    const map = new Map<string, { topic: string; subject: string; count: number }>();
    for (const q of questions) {
      if (selectedSubject !== 'all' && q.subject !== selectedSubject) continue;
      if (!map.has(q.topic)) {
        map.set(q.topic, { topic: q.topic, subject: q.subject, count: 0 });
      }
      map.get(q.topic)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [questions, selectedSubject]);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (questionType === 'mcq' && (!opt1 || !opt2 || !opt3 || !opt4)) {
      setError('Please provide all 4 answer options for MCQ questions.');
      return;
    }

    try {
      const res = await fetch('/api/admin/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty,
          question_type: questionType,
          coding_language: questionType === 'coding' ? codingLanguage : undefined,
          code_template: questionType === 'coding' ? codeTemplate : undefined,
          question_text: questionText,
          options: questionType === 'mcq' ? [
            { id: 'opt1', text: opt1 },
            { id: 'opt2', text: opt2 },
            { id: 'opt3', text: opt3 },
            { id: 'opt4', text: opt4 },
          ] : [],
          correct_option_id: questionType === 'mcq' ? correctOptionId : undefined,
          explanation,
          marks,
          negative_penalty: 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create question');

      if (data.question) {
        setQuestions(prev => [data.question, ...prev]);
      }

      setIsAddOpen(false);
      setQuestionText('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
      setCodeTemplate('');
      setExplanation('');
      fetchQuestions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating question');
    }
  };

  // Edit Question Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editDifficulty, setEditDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [editQuestionType, setEditQuestionType] = useState<'mcq' | 'coding'>('mcq');
  const [editCodingLanguage, setEditCodingLanguage] = useState<'c' | 'cpp' | 'java' | 'python' | 'javascript'>('python');
  const [editCodeTemplate, setEditCodeTemplate] = useState('');
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOpt1, setEditOpt1] = useState('');
  const [editOpt2, setEditOpt2] = useState('');
  const [editOpt3, setEditOpt3] = useState('');
  const [editOpt4, setEditOpt4] = useState('');
  const [editCorrectOptionId, setEditCorrectOptionId] = useState('opt1');
  const [editExplanation, setEditExplanation] = useState('');
  const [editMarks, setEditMarks] = useState(1.0);
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const openEditModal = (q: QuestionBankItem) => {
    setEditingQuestion(q);
    setEditSubject(q.subject || 'Python');
    setEditTopic(q.topic || 'General');
    setEditDifficulty(q.difficulty || 'medium');
    setEditQuestionType((q.question_type as any) === 'coding' ? 'coding' : 'mcq');
    setEditCodingLanguage((q.coding_language as any) || 'python');
    setEditCodeTemplate(q.code_template || '');
    setEditQuestionText(q.question_text || '');
    setEditExplanation(q.explanation || '');
    setEditMarks(q.marks || 1.0);

    const opts = q.options || [];
    setEditOpt1(opts.find(o => o.id === 'opt1')?.text || opts[0]?.text || '');
    setEditOpt2(opts.find(o => o.id === 'opt2')?.text || opts[1]?.text || '');
    setEditOpt3(opts.find(o => o.id === 'opt3')?.text || opts[2]?.text || '');
    setEditOpt4(opts.find(o => o.id === 'opt4')?.text || opts[3]?.text || '');
    setEditCorrectOptionId(q.correct_option_id || 'opt1');
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    setEditError(null);

    if (editQuestionType === 'mcq' && (!editOpt1 || !editOpt2 || !editOpt3 || !editOpt4)) {
      setEditError('Please provide all 4 answer options for MCQ questions.');
      return;
    }

    try {
      setIsUpdating(true);
      const res = await fetch(`/api/admin/question-bank/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editSubject.trim(),
          topic: editTopic.trim(),
          difficulty: editDifficulty,
          question_type: editQuestionType,
          coding_language: editQuestionType === 'coding' ? editCodingLanguage : undefined,
          code_template: editQuestionType === 'coding' ? editCodeTemplate : undefined,
          question_text: editQuestionText,
          options: editQuestionType === 'mcq' ? [
            { id: 'opt1', text: editOpt1 },
            { id: 'opt2', text: editOpt2 },
            { id: 'opt3', text: editOpt3 },
            { id: 'opt4', text: editOpt4 },
          ] : [],
          correct_option_id: editQuestionType === 'mcq' ? editCorrectOptionId : undefined,
          explanation: editExplanation,
          marks: editMarks,
          negative_penalty: 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update question');

      if (data.question) {
        setQuestions(prev => prev.map(item => item.id === editingQuestion.id ? data.question : item));
      }

      setIsEditOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error updating question');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const previous = questions;
    setQuestions(prev => prev.filter(q => q.id !== id));

    try {
      const res = await fetch(`/api/admin/question-bank/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setQuestions(previous);
        alert('Failed to delete question');
      } else {
        fetchQuestions();
      }
    } catch {
      setQuestions(previous);
      alert('Error connecting to server. Please try again.');
    }
  };

  // Filtered questions based on Search, Selected Topic, Selected Subject, and Selected Type
  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (selectedSubject !== 'all' && q.subject !== selectedSubject) return false;
      if (selectedTopic !== 'all' && q.topic !== selectedTopic) return false;
      if (selectedType !== 'all' && (q.question_type || 'mcq') !== selectedType) return false;

      if (!search.trim()) return true;
      const qLower = search.toLowerCase();
      return (
        q.question_text.toLowerCase().includes(qLower) ||
        q.topic.toLowerCase().includes(qLower) ||
        q.subject.toLowerCase().includes(qLower) ||
        (q.coding_language && q.coding_language.toLowerCase().includes(qLower))
      );
    });
  }, [questions, search, selectedSubject, selectedTopic, selectedType]);

  const hasActiveFilters = selectedTopic !== 'all' || selectedSubject !== 'all' || selectedType !== 'all' || search.trim() !== '';

  const resetFilters = () => {
    setSelectedTopic('all');
    setSelectedSubject('all');
    setSelectedType('all');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <HelpCircle size={24} className="text-indigo-600" /> Question Bank Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organize questions topic-wise (Python, Libraries, Data Structures) with answer keys and evaluation criteria.
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

      {/* Search & Topic Filters Bar */}
      <ClayCard className="p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search questions by keyword, topic, subject, or language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="clay-input w-full pl-9 pr-3 py-2 text-xs text-slate-800"
            />
            <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
              <Search size={14} />
            </div>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedTopic('all');
              }}
              className="clay-input py-2 px-3 text-xs text-slate-800 min-w-[150px]"
            >
              <option value="all">All Subjects</option>
              {uniqueSubjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Question Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="clay-input py-2 px-3 text-xs text-slate-800 min-w-[130px]"
            >
              <option value="all">All Formats</option>
              <option value="mcq">MCQ Only</option>
              <option value="coding">Coding Only</option>
            </select>
          </div>
        </div>

        {/* Topic Filter Pills Bar */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={13} className="text-indigo-600" />
              Filter by Topic:
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Scrollable Topic Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedTopic('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedTopic === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All Topics</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedTopic === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {questions.length}
              </span>
            </button>

            {topicStats.map(t => {
              const isActive = selectedTopic === t.topic;
              return (
                <button
                  type="button"
                  key={t.topic}
                  onClick={() => setSelectedTopic(isActive ? 'all' : t.topic)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{t.topic}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </ClayCard>

      {/* Filter Status summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          {loading && questions.length === 0 ? (
            <span className="flex items-center gap-2 text-indigo-600 font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
              Loading Question Bank from cloud...
            </span>
          ) : (
            <>
              Showing <strong className="text-slate-800">{filtered.length}</strong> of {questions.length} questions
              {selectedTopic !== 'all' && (
                <span> in topic <strong className="text-indigo-600">"{selectedTopic}"</strong></span>
              )}
            </>
          )}
        </span>
        {selectedTopic !== 'all' && (
          <button
            onClick={() => {
              setTopic(selectedTopic);
              const foundQ = questions.find(q => q.topic === selectedTopic);
              if (foundQ) setSubject(foundQ.subject);
              setIsAddOpen(true);
            }}
            className="text-indigo-600 hover:text-indigo-800 font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} /> Add question to "{selectedTopic}"
          </button>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {loading && questions.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <ClayCard key={i} className="p-6 space-y-3 animate-pulse border border-slate-200/70 bg-white shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 bg-slate-200 rounded-md w-12"></div>
                    <div className="h-4 bg-slate-200 rounded w-44"></div>
                    <div className="h-4 bg-slate-100 rounded w-24"></div>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-md w-16"></div>
                </div>
                <div className="h-4 bg-slate-200 rounded w-5/6 mt-2"></div>
                <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                <div className="h-20 bg-slate-900/10 rounded-xl mt-3 flex items-center justify-center text-xs text-slate-400 font-mono">
                  Loading question details...
                </div>
              </ClayCard>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <ClayCard className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">No questions found</p>
              <p className="text-xs text-slate-500 mt-1">
                {hasActiveFilters
                  ? 'No questions match the current topic or search filters.'
                  : 'Your question bank is empty. Click "+ Add New Question" to create your first question.'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <ClayButton
                variant="primary"
                size="sm"
                onClick={() => {
                  if (selectedTopic !== 'all') {
                    setTopic(selectedTopic);
                    const match = questions.find(q => q.topic === selectedTopic);
                    if (match) setSubject(match.subject);
                  }
                  setIsAddOpen(true);
                }}
              >
                <Plus size={14} /> Add Question
              </ClayButton>
            </div>
          </ClayCard>
        ) : (
          filtered.map((q, idx) => {
            const type = q.question_type || 'mcq';
            return (
              <ClayCard key={q.id} className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      Q#{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {q.subject} • <span className="text-indigo-600 font-bold">{q.topic}</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      type === 'coding'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : type === 'written'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : type === 'file_upload'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {type === 'coding' ? `Coding (${q.coding_language || 'python'})` : type === 'written' ? 'Written' : type === 'file_upload' ? 'File Upload' : 'MCQ'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                      +{q.marks} Mark
                    </span>
                    <button
                      onClick={() => openEditModal(q)}
                      className="text-slate-400 hover:text-indigo-600 p-1 rounded-md transition cursor-pointer"
                      title="Edit Question"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-bold text-slate-900 break-words">
                  {q.question_text}
                </p>

                {/* Question Format Specific Body */}
                {type === 'coding' && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono space-y-1.5 border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-cyan-400 border-b border-slate-800 pb-1">
                      <span>Language: {q.coding_language?.toUpperCase() || 'PYTHON'}</span>
                      <span className="text-slate-400">Manual Evaluation Required</span>
                    </div>
                    <pre className="text-[11px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {q.code_template || '// No starter code template provided'}
                    </pre>
                  </div>
                )}

                {type === 'written' && (
                  <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-purple-900 space-y-1">
                    <div className="font-semibold text-purple-800 text-[11px]">Descriptive / Essay Question</div>
                    <p className="text-[11px] text-purple-700">
                      Students will write detailed explanations into the text area. Evaluated manually by trainer.
                    </p>
                  </div>
                )}

                {type === 'file_upload' && (
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-xs text-amber-900 space-y-1">
                    <div className="font-semibold text-amber-800 text-[11px]">Practical File / Assignment Submission</div>
                    <p className="text-[11px] text-amber-700">
                      Allowed file types: <span className="font-mono font-medium">{q.allowed_file_types || '.ipynb, .py, .pdf, .zip'}</span> (Max: {q.max_file_size_mb || 10} MB)
                    </p>
                  </div>
                )}

                {/* MCQ Options List */}
                {type === 'mcq' && q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt) => {
                      const isCorrect = opt.id === q.correct_option_id;
                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 transition ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-slate-50/50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {opt.id.replace('opt', '')}
                          </span>
                          <span className="break-words min-w-0 flex-1">{opt.text}</span>
                          {isCorrect && <CheckCircle2 size={14} className="text-emerald-600 shrink-0 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900">
                    <strong>Review Explanation:</strong> {q.explanation}
                  </div>
                )}
              </ClayCard>
            );
          })
        )}
      </div>

      {/* Add Question Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Question to Topic / Bank"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateQuestion} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {/* Quick Topic Presets for Fast Addition */}
          <div className="p-3 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-600" />
                Quick Topic Presets (Click to Auto-fill):
              </span>
              <span className="text-[10px] text-indigo-500">or type custom topic below</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TOPIC_PRESETS.map((p) => {
                const isSelected = topic === p.topic && subject === p.subject;
                return (
                  <button
                    type="button"
                    key={p.topic}
                    onClick={() => {
                      setSubject(p.subject);
                      setTopic(p.topic);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-white'
                    }`}
                  >
                    {isSelected && <Check size={11} />}
                    {p.topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Type Selection (Only MCQ and Coding) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Question Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'mcq' as const, label: 'MCQ (Multiple Choice)' },
                { type: 'coding' as const, label: 'Practical Coding' },
              ].map(t => (
                <button
                  type="button"
                  key={t.type}
                  onClick={() => setQuestionType(t.type)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    questionType === t.type
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject, Topic, Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                list="subjects-datalist"
                required
                placeholder="e.g. Python Programming"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              />
              <datalist id="subjects-datalist">
                {uniqueSubjects.map(s => <option key={s} value={s} />)}
                <option value="Python Programming" />
                <option value="Python Libraries" />
                <option value="Computer Science" />
                <option value="Data Science & Machine Learning" />
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Topic</label>
              <input
                type="text"
                list="topics-datalist"
                required
                placeholder="e.g. Pandas (DataFrames & Series)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              />
              <datalist id="topics-datalist">
                {uniqueTopics.map(t => <option key={t} value={t} />)}
                {QUICK_TOPIC_PRESETS.map(p => <option key={p.topic} value={p.topic} />)}
              </datalist>
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

          {/* Question Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Question Statement</label>
            <textarea
              rows={3}
              required
              placeholder="Enter the question problem, prompt, or task..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          {/* Coding Specific Configuration */}
          {questionType === 'coding' && (
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900">Coding Language</label>
                <select
                  value={codingLanguage}
                  onChange={(e) => setCodingLanguage(e.target.value as any)}
                  className="clay-input py-1 px-2.5 text-xs text-slate-800"
                >
                  <option value="python">Python</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">
                  Starter Code Template (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder={`# Starter template code for student:\ndef solution():\n    # write code here\n    pass`}
                  value={codeTemplate}
                  onChange={(e) => setCodeTemplate(e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-slate-900 text-slate-200 rounded-lg border border-slate-700 focus:outline-none"
                />
              </div>
            </div>
          )}



          {/* MCQ Options Configuration */}
          {questionType === 'mcq' && (
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-semibold text-slate-700">Answer Options & Correct Key</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'opt1', val: opt1, set: setOpt1, label: 'Option 1' },
                  { id: 'opt2', val: opt2, set: setOpt2, label: 'Option 2' },
                  { id: 'opt3', val: opt3, set: setOpt3, label: 'Option 3' },
                  { id: 'opt4', val: opt4, set: setOpt4, label: 'Option 4' },
                ].map(opt => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOptionId === opt.id}
                      onChange={() => setCorrectOptionId(opt.id)}
                      className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      required={questionType === 'mcq'}
                      placeholder={opt.label}
                      value={opt.val}
                      onChange={(e) => opt.set(e.target.value)}
                      className={`clay-input flex-1 p-2 text-xs text-slate-800 ${
                        correctOptionId === opt.id ? 'border-emerald-400 bg-emerald-50/30' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Click the radio button next to the option to designate the correct answer key.
              </p>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Review Explanation (Shown post-examination)
            </label>
            <textarea
              rows={2}
              placeholder="Provide pedagogical rationale or solution notes..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          {/* Marks Configuration (No Negative Marking) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Score (+Marks per Question)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              value={marks}
              onChange={(e) => setMarks(parseFloat(e.target.value) || 1.0)}
              className="clay-input w-full p-2 text-xs text-slate-800"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              No negative marking applied. Incorrect or skipped questions receive 0 penalty.
            </p>
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
              Save to Topic
            </ClayButton>
          </div>
        </form>
      </Modal>

      {/* Edit Question Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingQuestion(null);
        }}
        title="Edit Question"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleUpdateQuestion} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {editError}
            </div>
          )}

          {/* Question Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Question Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'mcq', label: 'MCQ (Multiple Choice)' },
                { type: 'coding', label: 'Practical Coding' },
              ].map(t => (
                <button
                  type="button"
                  key={t.type}
                  onClick={() => setEditQuestionType(t.type as any)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    editQuestionType === t.type
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject, Topic, Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                list="edit-subjects-datalist"
                required
                placeholder="e.g. Python"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              />
              <datalist id="edit-subjects-datalist">
                {uniqueSubjects.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Topic</label>
              <input
                type="text"
                list="edit-topics-datalist"
                required
                placeholder="e.g. Core Python Questions"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              />
              <datalist id="edit-topics-datalist">
                {uniqueTopics.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
              <select
                value={editDifficulty}
                onChange={(e) => setEditDifficulty(e.target.value as any)}
                className="clay-input w-full p-2 text-xs text-slate-800"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Question Statement</label>
            <textarea
              rows={4}
              required
              placeholder="Enter the question problem, prompt, or task..."
              value={editQuestionText}
              onChange={(e) => setEditQuestionText(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          {/* Coding Specific Configuration */}
          {editQuestionType === 'coding' && (
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900">Coding Language</label>
                <select
                  value={editCodingLanguage}
                  onChange={(e) => setEditCodingLanguage(e.target.value as any)}
                  className="clay-input py-1 px-2.5 text-xs text-slate-800"
                >
                  <option value="python">Python</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">
                  Starter Code Template (Code Box)
                </label>
                <textarea
                  rows={5}
                  placeholder="# Starter template code for student:"
                  value={editCodeTemplate}
                  onChange={(e) => setEditCodeTemplate(e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-slate-900 text-slate-200 rounded-lg border border-slate-700 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* MCQ Options Configuration */}
          {editQuestionType === 'mcq' && (
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-semibold text-slate-700">Answer Options & Correct Key</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'opt1', val: editOpt1, set: setEditOpt1, label: 'Option 1' },
                  { id: 'opt2', val: editOpt2, set: setEditOpt2, label: 'Option 2' },
                  { id: 'opt3', val: editOpt3, set: setEditOpt3, label: 'Option 3' },
                  { id: 'opt4', val: editOpt4, set: setEditOpt4, label: 'Option 4' },
                ].map(opt => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="editCorrectOption"
                      checked={editCorrectOptionId === opt.id}
                      onChange={() => setEditCorrectOptionId(opt.id)}
                      className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      required={editQuestionType === 'mcq'}
                      placeholder={opt.label}
                      value={opt.val}
                      onChange={(e) => opt.set(e.target.value)}
                      className={`clay-input flex-1 p-2 text-xs text-slate-800 ${
                        editCorrectOptionId === opt.id ? 'border-emerald-400 bg-emerald-50/30' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Review Explanation (Shown post-examination)
            </label>
            <textarea
              rows={2}
              placeholder="Provide pedagogical rationale or solution notes..."
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          {/* Marks Configuration */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Score (+Marks per Question)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              value={editMarks}
              onChange={(e) => setEditMarks(parseFloat(e.target.value) || 1.0)}
              className="clay-input w-full p-2 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditOpen(false);
                setEditingQuestion(null);
              }}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary" disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </ClayButton>
          </div>
        </form>
      </Modal>

    </div>
  );
}
