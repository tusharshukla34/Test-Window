'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Maximize2,
  Minimize2,
  Clock,
  User,
  AlertTriangle,
  FileText,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Flag,
  ArrowRight,
  ArrowLeft,
  Pause,
  Play
} from 'lucide-react';
import { ExamQuestionClient, AttemptResponse, ExamAttempt, Exam } from '@/lib/db/types';

export default function ExamAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionClient[]>([]);
  const [responses, setResponses] = useState<Record<string, {
    selected_option_id: string | null;
    is_marked_for_review: boolean;
    is_visited: boolean;
    time_spent_seconds: number;
  }>>({});

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');

  // Authoritative server countdown (seconds remaining)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showQuestionPaperModal, setShowQuestionPaperModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch initial exam attempt & questions
  useEffect(() => {
    fetch(`/api/student/exams/${examId}/start`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          throw new Error(data.error || 'Failed to start exam');
        }

        setAttempt(data.attempt);
        setQuestions(data.questions);

        // Prepopulate responses map
        const respMap: Record<string, {
          selected_option_id: string | null;
          is_marked_for_review: boolean;
          is_visited: boolean;
          time_spent_seconds: number;
        }> = {};

        data.questions.forEach((q: ExamQuestionClient, idx: number) => {
          respMap[q.id] = {
            selected_option_id: null,
            is_marked_for_review: false,
            is_visited: idx === 0, // mark first question as visited
            time_spent_seconds: 0
          };
        });

        if (Array.isArray(data.responses)) {
          data.responses.forEach((r: AttemptResponse) => {
            if (respMap[r.question_id]) {
              respMap[r.question_id] = {
                selected_option_id: r.selected_option_id || null,
                is_marked_for_review: Boolean(r.is_marked_for_review),
                is_visited: Boolean(r.is_visited),
                time_spent_seconds: r.time_spent_seconds || 0
              };
            }
          });
        }

        setResponses(respMap);

        // Compute remaining time from authoritative deadline
        const deadline = new Date(data.attempt.authoritative_deadline).getTime();
        const serverTime = new Date(data.server_time || Date.now()).getTime();
        const diffSecs = Math.max(0, Math.floor((deadline - serverTime) / 1000));
        setSecondsRemaining(diffSecs);

        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [examId]);

  // Fetch exam metadata
  useEffect(() => {
    fetch(`/api/student/exams/${examId}/instructions`)
      .then(res => res.json())
      .then(d => {
        if (d.exam) setExam(d.exam);
      })
      .catch(() => {});
  }, [examId]);

  // Server-authoritative timer countdown tick
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          // Time expired! Auto submit attempt atomically
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const currentQuestion = questions[currentIndex];
  const currentResp = currentQuestion ? responses[currentQuestion.id] : null;

  // Persist response to server
  const saveResponseToServer = useCallback(async (
    questionId: string,
    updated: { selected_option_id?: string | null; is_marked_for_review?: boolean; is_visited?: boolean }
  ) => {
    if (!attempt) return;
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/student/exams/${examId}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attempt.id,
          question_id: questionId,
          ...updated
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);

      if (resData.remaining_seconds !== undefined) {
        setSecondsRemaining(resData.remaining_seconds);
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('failed');
    }
  }, [attempt, examId]);

  // Select Option
  const handleSelectOption = (optId: string) => {
    if (!currentQuestion) return;
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selected_option_id: optId,
        is_visited: true
      }
    }));
  };

  // Clear Response
  const handleClearResponse = () => {
    if (!currentQuestion) return;
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selected_option_id: null
      }
    }));
    saveResponseToServer(currentQuestion.id, { selected_option_id: null });
  };

  // Save & Next
  const handleSaveAndNext = () => {
    if (!currentQuestion) return;
    const currentAnswer = responses[currentQuestion.id]?.selected_option_id || null;

    saveResponseToServer(currentQuestion.id, {
      selected_option_id: currentAnswer,
      is_marked_for_review: false,
      is_visited: true
    });

    if (currentIndex < questions.length - 1) {
      const nextQ = questions[currentIndex + 1];
      setResponses(prev => ({
        ...prev,
        [nextQ.id]: { ...prev[nextQ.id], is_visited: true }
      }));
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Mark for Review & Next
  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const currentAnswer = responses[currentQuestion.id]?.selected_option_id || null;

    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        is_marked_for_review: true,
        is_visited: true
      }
    }));

    saveResponseToServer(currentQuestion.id, {
      selected_option_id: currentAnswer,
      is_marked_for_review: true,
      is_visited: true
    });

    if (currentIndex < questions.length - 1) {
      const nextQ = questions[currentIndex + 1];
      setResponses(prev => ({
        ...prev,
        [nextQ.id]: { ...prev[nextQ.id], is_visited: true }
      }));
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Jump directly to Question
  const handleJumpToQuestion = (idx: number) => {
    const targetQ = questions[idx];
    setResponses(prev => ({
      ...prev,
      [targetQ.id]: { ...prev[targetQ.id], is_visited: true }
    }));
    saveResponseToServer(targetQ.id, { is_visited: true });
    setCurrentIndex(idx);
  };

  // Final Atomic Submit
  const handleFinalSubmit = async () => {
    if (!attempt || submittingFinal) return;
    setSubmittingFinal(true);

    try {
      const res = await fetch(`/api/student/exams/${examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: attempt.id })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Submission failed');

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      router.push(`/student/exams/${examId}/result`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error finalizing exam');
      setSubmittingFinal(false);
    }
  };

  // Calculate palette status counters
  let answeredCount = 0;
  let notAnsweredCount = 0;
  let markedCount = 0;
  let notVisitedCount = 0;
  let markedAndAnsweredCount = 0;

  questions.forEach(q => {
    const r = responses[q.id];
    const hasAnswer = Boolean(r?.selected_option_id);
    const isMarked = Boolean(r?.is_marked_for_review);
    const isVisited = Boolean(r?.is_visited);

    if (!isVisited && !hasAnswer) {
      notVisitedCount++;
    } else if (hasAnswer && isMarked) {
      markedAndAnsweredCount++;
    } else if (hasAnswer) {
      answeredCount++;
    } else if (isMarked) {
      markedCount++;
    } else {
      notAnsweredCount++;
    }
  });

  const formatTimer = (totalSeconds: number | null) => {
    if (totalSeconds === null) return '00 : 00 : 00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')} : ${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
        <div className="w-12 h-12 border-4 border-[#00bcd4] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-bold text-slate-700 text-sm">Synchronizing Examination Environment...</p>
      </div>
    );
  }

  if (error || !currentQuestion) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="text-rose-600 font-bold mb-4">{error || 'Question data not available'}</p>
        <button
          onClick={() => router.push('/student/exams')}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-white text-slate-900 select-none">
      {/* 1. TOP BAR (Matching Reference Screenshot 3) */}
      <header className="border-b border-slate-200 px-4 py-2.5 flex items-center justify-between bg-white sticky top-0 z-30 shadow-xs">
        {/* Left: Branding & Test Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00bcd4] text-white flex items-center justify-center font-black text-sm">
            TS
          </div>
          <h1 className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-md">
            {exam?.title || 'Thermodynamics for All AE/JE ME Exams Mock Test'}
          </h1>
        </div>

        {/* Right: Timer & Fullscreen Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600">Time Left</span>
            <span className="font-mono font-extrabold text-sm text-slate-900 tracking-wider">
              {formatTimer(secondsRemaining)}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit Full Screen' : 'Switch Full Screen'}</span>
          </button>

          <button
            disabled
            className="px-3 py-1 rounded-md border border-slate-200 text-xs font-bold text-slate-400 bg-slate-50 cursor-not-allowed"
            title="Pausing is disabled by trainer examination policy"
          >
            Pause
          </button>
        </div>
      </header>

      {/* 2. SECTION HEADER (Matching Reference Screenshot 3) */}
      <div className="border-b border-slate-200 px-4 py-2 bg-slate-50 flex items-center gap-4">
        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">SECTIONS |</span>
        <button className="px-4 py-1 rounded-md bg-[#007791] text-white font-bold text-xs shadow-xs">
          Test
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <span className={`w-2 h-2 rounded-full ${saveStatus === 'saving' ? 'bg-amber-500 animate-ping' : saveStatus === 'failed' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
          <span>{saveStatus === 'saving' ? 'Autosaving response...' : saveStatus === 'failed' ? 'Autosave failed (retrying)' : 'Response synced with server'}</span>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE (Question on left, Palette on right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Question Panel */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6 max-w-4xl">
            {/* Question Meta Row */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-extrabold text-slate-900">
                Question No. {currentIndex + 1}
              </h2>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 font-mono text-xs font-bold">
                  <span className="text-slate-500 text-[11px]">Marks</span>
                  <span className="px-2 py-0.5 rounded-sm bg-[#16a34a] text-white">+{currentQuestion.marks}</span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-[#dc2626] text-white">-{currentQuestion.negative_penalty}</span>
                </div>

                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={13} /> Time: 00:01
                </div>

                <select className="text-xs border border-slate-200 rounded-md p-1 bg-white">
                  <option>View in English</option>
                  <option>View in Hindi</option>
                </select>

                <button className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 p-1">
                  <Flag size={13} /> Report
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed pt-2">
              {currentQuestion.question_text}
            </div>

            {/* Options List */}
            <div className="space-y-3 pt-3">
              {currentQuestion.options.map((opt) => {
                const isSelected = currentResp?.selected_option_id === opt.id;
                return (
                  <label
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                      isSelected
                        ? 'bg-cyan-50/40 border-[#00bcd4] text-slate-900 font-bold shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question_${currentQuestion.id}`}
                      checked={isSelected}
                      onChange={() => handleSelectOption(opt.id)}
                      className="mt-0.5 w-4 h-4 text-[#00bcd4] focus:ring-[#00bcd4] cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm leading-snug">{opt.text}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Buttons (Matching Reference Screenshot 3) */}
          <div className="pt-6 mt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkForReviewAndNext}
                className="px-4 py-2 bg-[#bbdefb] hover:bg-[#90caf9] text-slate-900 font-bold text-xs rounded-md shadow-xs transition"
              >
                Mark for Review & Next
              </button>
              <button
                onClick={handleClearResponse}
                className="px-4 py-2 bg-[#bbdefb] hover:bg-[#90caf9] text-slate-900 font-bold text-xs rounded-md shadow-xs transition"
              >
                Clear Response
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAndNext}
                className="px-6 py-2 bg-[#00bcd4] hover:bg-[#00acc1] text-white font-extrabold text-xs rounded-md shadow-md transition"
              >
                Save & Next
              </button>
            </div>
          </div>
        </main>

        {/* Right: Question Palette (Matching Reference Screenshot 3) */}
        <aside className="w-full lg:w-80 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between p-4">
          <div className="space-y-4">
            {/* Candidate Info Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              <div className="w-10 h-10 rounded-full bg-[#00bcd4] text-white flex items-center justify-center font-bold">
                <User size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-slate-900 leading-tight">
                  Tushar / Candidate
                </h3>
                <span className="text-[10px] text-slate-500">Live Mock Engine</span>
              </div>
            </div>

            {/* Status Legend & Counter Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-[#16a34a] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                  {answeredCount}
                </span>
                <span className="text-[10px]">Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#9333ea] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                  {markedCount}
                </span>
                <span className="text-[10px]">Marked</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-mono text-[10px] font-bold">
                  {notVisitedCount}
                </span>
                <span className="text-[10px]">Not Visited</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#9333ea] text-white flex items-center justify-center font-mono text-[10px] font-bold relative">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a] border border-white absolute -bottom-0.5 -right-0.5"></span>
                  {markedAndAnsweredCount}
                </span>
                <span className="text-[10px] truncate">Marked & ans</span>
              </div>

              <div className="flex items-center gap-1.5 col-span-2 pt-1 border-t border-slate-100">
                <span className="w-5 h-5 rounded-md bg-[#dc2626] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                  {notAnsweredCount}
                </span>
                <span className="text-[10px]">Not Answered</span>
              </div>
            </div>

            {/* SECTION Tab Title */}
            <div className="bg-[#b3e5fc] px-3 py-1.5 rounded-md font-bold text-xs text-slate-800">
              SECTION : Test
            </div>

            {/* Question Buttons Palette Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const r = responses[q.id];
                const hasAnswer = Boolean(r?.selected_option_id);
                const isMarked = Boolean(r?.is_marked_for_review);
                const isVisited = Boolean(r?.is_visited);
                const isCurrent = currentIndex === idx;

                let btnClass = 'bg-white border-2 border-slate-300 text-slate-700'; // Not Visited
                let badge = null;

                if (!isVisited && !hasAnswer) {
                  btnClass = 'bg-white border-2 border-slate-300 text-slate-700';
                } else if (hasAnswer && isMarked) {
                  btnClass = 'bg-[#9333ea] text-white rounded-full';
                  badge = <span className="w-2 h-2 rounded-full bg-[#16a34a] border border-white absolute -bottom-0.5 -right-0.5"></span>;
                } else if (hasAnswer) {
                  btnClass = 'bg-[#16a34a] text-white rounded-md';
                } else if (isMarked) {
                  btnClass = 'bg-[#9333ea] text-white rounded-full';
                } else {
                  btnClass = 'bg-[#dc2626] text-white rounded-md';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-9 w-9 text-xs font-bold flex items-center justify-center relative transition-transform ${btnClass} ${
                      isCurrent ? 'ring-2 ring-cyan-500 scale-105 z-10' : 'hover:opacity-90'
                    }`}
                  >
                    {idx + 1}
                    {badge}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Palette Actions: Question Paper, Instructions, Submit Test */}
          <div className="space-y-2 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowQuestionPaperModal(true)}
                className="py-1.5 px-2 bg-[#bbdefb] hover:bg-[#90caf9] text-slate-900 font-bold text-xs rounded-md transition text-center"
              >
                Question Paper
              </button>
              <button
                onClick={() => setShowInstructionsModal(true)}
                className="py-1.5 px-2 bg-[#bbdefb] hover:bg-[#90caf9] text-slate-900 font-bold text-xs rounded-md transition text-center"
              >
                Instructions
              </button>
            </div>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-2.5 bg-[#00bcd4] hover:bg-[#00acc1] text-white font-black text-sm rounded-md shadow-md transition"
            >
              Submit Test
            </button>
          </div>
        </aside>
      </div>

      {/* 4. SUBMIT CONFIRMATION MODAL (Matching Reference Screenshot 4) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-[#00bcd4] px-6 py-4 text-white">
              <h3 className="font-extrabold text-base">Test Submission Summary</h3>
              <p className="text-xs text-cyan-100">Please review your responses before finalizing your examination attempt.</p>
            </div>

            {/* Modal Table matching Screenshot 4 */}
            <div className="p-6 space-y-6">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-center text-xs">
                  <thead className="bg-[#00bcd4] text-white font-extrabold">
                    <tr>
                      <th className="p-2.5 border-r border-cyan-400">Section</th>
                      <th className="p-2.5 border-r border-cyan-400">No. of questions</th>
                      <th className="p-2.5 border-r border-cyan-400">Answered</th>
                      <th className="p-2.5 border-r border-cyan-400">Not Answered</th>
                      <th className="p-2.5 border-r border-cyan-400">Marked for Review</th>
                      <th className="p-2.5">Not Visited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 border-r border-slate-200">Test</td>
                      <td className="p-3 border-r border-slate-200 font-mono">{questions.length}</td>
                      <td className="p-3 border-r border-slate-200 font-mono text-[#16a34a]">{answeredCount + markedAndAnsweredCount}</td>
                      <td className="p-3 border-r border-slate-200 font-mono text-[#dc2626]">{notAnsweredCount}</td>
                      <td className="p-3 border-r border-slate-200 font-mono text-[#9333ea]">{markedCount + markedAndAnsweredCount}</td>
                      <td className="p-3 font-mono text-slate-500">{notVisitedCount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-600 text-center">
                Are you sure you want to submit the examination? After submission, your test will be finalized and graded by the server.
              </p>

              {/* Action Buttons matching Screenshot 4 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-5 py-2 bg-[#00bcd4] hover:bg-[#00acc1] text-white font-extrabold text-xs rounded-md shadow-xs transition"
                >
                  Resume Test
                </button>

                <button
                  type="button"
                  disabled={submittingFinal}
                  onClick={handleFinalSubmit}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-md shadow-md transition"
                >
                  {submittingFinal ? 'Grading Test...' : 'Confirm Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. QUESTION PAPER MODAL */}
      {showQuestionPaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800">Complete Question Paper at a Glance</h3>
              <button
                onClick={() => setShowQuestionPaperModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="font-bold text-slate-900">
                    Q{idx + 1}. {q.question_text}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    {q.options.map((opt, oIdx) => (
                      <div key={opt.id}>({String.fromCharCode(65 + oIdx)}) {opt.text}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. INSTRUCTIONS MODAL */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800">Test Instructions</h3>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs space-y-2 text-slate-700">
              <p>• Duration: {exam?.duration_minutes} minutes.</p>
              <p>• Correct Answer: +{exam?.marks_per_question} mark.</p>
              <p>• Negative Marking: -{exam?.negative_marking} mark per incorrect answer.</p>
              <p>• Unattempted: 0 marks (no negative penalty).</p>
              <p>• Green = Answered, Red = Not Answered, Purple = Marked for Review.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
