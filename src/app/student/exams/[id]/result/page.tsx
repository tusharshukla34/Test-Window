'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  ArrowLeft,
  Award,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  FileCheck2,
  FileText,
  Code2,
  Download
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Exam, ExamAttempt, ExamQuestionClient } from '@/lib/db/types';

interface ResultData {
  exam: Partial<Exam>;
  attempt: Partial<ExamAttempt>;
  is_published: boolean;
  status_message: string;
  questions_review?: (ExamQuestionClient & {
    selected_option_id: string | null;
    descriptive_answer?: string | null;
    submitted_file_url?: string | null;
    submitted_file_name?: string | null;
    is_correct: boolean | null;
    correct_option_id?: string;
    explanation?: string;
    manual_marks?: number | null;
    teacher_remarks?: string | null;
  })[];
}

export default function StudentExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/student/exams/${examId}/result`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [examId]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { exam, attempt, is_published, status_message, questions_review } = data;

  // -------------------------------------------------------------
  // STATE A: RESULT NOT YET PUBLISHED (TRAINER EVALUATION PENDING)
  // Strictly neutral confirmation card without score leak
  // -------------------------------------------------------------
  if (!is_published) {
    const isEvaluated = attempt.evaluation_status === 'evaluated';
    const isInProgress = attempt.evaluation_status === 'in_progress';

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in py-6">
        {/* Navigation */}
        <button
          onClick={() => router.push('/student/exams')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to My Examinations
        </button>

        {/* Neutral Submission Confirmation Card */}
        <ClayCard className="p-4 sm:p-8 text-center space-y-5 sm:space-y-6 bg-white border border-slate-200/80 shadow-md">
          {/* Status Icon */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 size={32} className="sm:w-9 sm:h-9" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
              isEvaluated
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : isInProgress
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {status_message || 'Submitted — Awaiting Trainer Evaluation'}
            </span>

            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              Your examination has been submitted successfully.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Your trainer will evaluate your answers and publish the results when they are ready.
            </p>
          </div>

          {/* Submission Details Summary */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 sm:p-5 text-left divide-y divide-slate-200/60 text-xs">
            <div className="pb-2.5 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-semibold text-slate-500">Examination</span>
              <span className="font-bold text-slate-900 sm:text-right break-words">{exam.title}</span>
            </div>
            <div className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-semibold text-slate-500">Submission Timestamp</span>
              <span className="font-bold text-slate-900 font-mono">
                {attempt.submitted_at
                  ? new Date(attempt.submitted_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'Recorded on Server'}
              </span>
            </div>
            <div className="py-2.5 sm:py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-500">Total Questions</span>
              <span className="font-bold text-slate-900">{exam.total_questions} Questions</span>
            </div>
            <div className="pt-2.5 sm:pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-semibold text-slate-500">Evaluation Mode</span>
              <span className="font-bold text-indigo-700 flex items-center gap-1">
                <ShieldCheck size={14} /> Trainer Manual Evaluation & Release
              </span>
            </div>
          </div>

          {/* Informational Guidance Box */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 text-left flex items-start gap-3">
            <Clock size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Evaluation in Progress by Trainer Tushar Shukla</p>
              <p className="text-indigo-800 leading-relaxed text-[11px]">
                Trainer Tushar Shukla manually inspects answer sheets and verifies question marks before publishing. You will receive an in-app notification when results for your batch are released.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <ClayButton
              onClick={() => router.push('/student/dashboard')}
              variant="primary"
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold"
            >
              Return to Student Dashboard
            </ClayButton>
            <ClayButton
              onClick={() => router.push('/student/results')}
              variant="secondary"
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold"
            >
              View My Results Hub
            </ClayButton>
          </div>
        </ClayCard>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE B: RESULT OFFICIALLY PUBLISHED BY TRAINER
  // Display official verified score card, teacher remarks & answers
  // -------------------------------------------------------------
  const isAbsent = Boolean(attempt.is_absent || (attempt as any).result_status === 'absent_fail');
  const passPct = (exam as any).passing_percentage ?? 40.0;
  const isPass = !isAbsent && Number(attempt.percentage || 0) >= passPct;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in py-2 sm:py-4">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <button
          onClick={() => router.push('/student/results')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to Results Hub
        </button>
        {isAbsent ? (
          <span className="text-xs font-bold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5 self-start sm:self-auto">
            <AlertCircle size={14} className="text-rose-600 shrink-0" /> Failed — Absent on Deadline
          </span>
        ) : isPass ? (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> RESULT: PASSED (≥{passPct}%)
          </span>
        ) : (
          <span className="text-xs font-bold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5 self-start sm:self-auto">
            <AlertCircle size={14} className="text-rose-600 shrink-0" /> RESULT: FAILED (&lt;{passPct}%)
          </span>
        )}
      </div>

      {/* Hero Score Card */}
      <div className={`relative overflow-hidden rounded-3xl text-white p-6 sm:p-8 shadow-2xl border ${
        isAbsent
          ? 'bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/60 border-rose-900/60'
          : isPass
          ? 'bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/60 border-slate-800'
          : 'bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/50 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6 relative z-10">
          <div className="text-center sm:text-left space-y-2">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className={`text-xs uppercase tracking-widest font-extrabold flex items-center gap-1.5 ${
                isAbsent ? 'text-rose-400' : isPass ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                <Sparkles size={14} /> Official Examination Result
              </span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                isAbsent
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : isPass
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {isAbsent ? 'FAIL (ABSENT)' : isPass ? 'PASS' : 'FAIL'} • Passing Mark: {passPct}%
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight break-words">
              {exam.title}
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              {isAbsent
                ? 'Recorded on deadline expiration as Absent (Unattempted)'
                : `Evaluated & Published on ${
                    attempt.published_at
                      ? new Date(attempt.published_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })
                      : 'Recently'
                  }`}
            </p>
          </div>

          <div className="bg-slate-800/90 rounded-2xl p-4 sm:p-5 border border-slate-700 text-center min-w-[150px] sm:min-w-[170px] shadow-lg">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              {isAbsent ? 'Audit Score' : 'Verified Score'}
            </span>
            <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight block my-0.5 ${
              isAbsent ? 'text-rose-400' : isPass ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {attempt.total_score ?? 0}
            </span>
            <span className="text-xs text-slate-300 font-bold block">/ {exam.max_marks} Points</span>
          </div>
        </div>

        {/* Absent Notification Notice */}
        {isAbsent && (
          <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-800 text-xs text-rose-200 flex items-start gap-2.5 bg-rose-950/40 rounded-xl p-3.5 relative z-10 border border-rose-900/60">
            <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-white block font-bold">Unattempted Examination — Marked as Fail (Absent)</strong>
              <p className="text-rose-200/90 leading-relaxed text-[11px]">
                You did not attempt this online examination before the deadline set by Trainer Tushar Shukla. In accordance with examination regulations, your submission has been permanently recorded as <strong>FAIL (ABSENT)</strong> with 0 marks. This score card is stored permanently in your academic records.
              </p>
            </div>
          </div>
        )}

        {/* Trainer Feedback Banner if provided */}
        {!isAbsent && attempt.trainer_feedback && (
          <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-800 text-xs text-slate-200 flex items-start gap-2 bg-slate-800/50 rounded-xl p-3 relative z-10">
            <FileText size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold text-white block">Trainer Remarks:</span>
              <p className="text-slate-300 italic break-words">{attempt.trainer_feedback}</p>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <ClayCard className="p-3 sm:p-4 text-center bg-white border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Percentage</span>
          <p className={`text-xl sm:text-2xl font-black mt-1 ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>
            {attempt.percentage !== null && attempt.percentage !== undefined
              ? attempt.percentage
              : (exam.max_marks && exam.max_marks > 0 && typeof attempt.total_score === 'number' ? Number(((attempt.total_score / exam.max_marks) * 100).toFixed(1)) : 0)}%
          </p>
        </ClayCard>

        <ClayCard className="p-3 sm:p-4 text-center bg-white border border-slate-200">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Correct</span>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{attempt.total_correct ?? 0}</p>
        </ClayCard>

        <ClayCard className="p-3 sm:p-4 text-center bg-white border border-slate-200">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Incorrect</span>
          <p className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{attempt.total_incorrect ?? 0}</p>
        </ClayCard>

        <ClayCard className="p-3 sm:p-4 text-center bg-white border border-slate-200">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Unattempted / Partial</span>
          <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{attempt.total_unattempted ?? 0}</p>
        </ClayCard>

        <ClayCard className="p-3 sm:p-4 text-center col-span-2 sm:col-span-1 bg-white border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time Spent</span>
          <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1 font-mono">
            {Math.floor((attempt.time_spent_seconds || 0) / 60)}m {(attempt.time_spent_seconds || 0) % 60}s
          </p>
        </ClayCard>
      </div>

      {/* Question-by-Question Review with Explanations */}
      {questions_review && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Award size={20} className="text-teal-600" /> Question-wise Review & Explanations
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Verified by Trainer Tushar Shukla
            </span>
          </div>

          <div className="space-y-4">
            {questions_review.map((q, idx) => {
              const type = q.question_type || 'mcq';
              const isMcq = type === 'mcq';
              const isCorrect = q.is_correct === true;
              const isUnattempted = isMcq
                ? !q.selected_option_id
                : type === 'file_upload'
                ? !q.submitted_file_url
                : !(q.descriptive_answer && q.descriptive_answer.trim().length > 0 && q.descriptive_answer.trim() !== (q.code_template || '').trim());

              return (
                <ClayCard key={q.id} className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-700">
                        Question No. {idx + 1}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        type === 'coding' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        type === 'written' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        type === 'file_upload' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {type === 'coding' ? `Coding (${q.coding_language || 'c'})` : type === 'written' ? 'Written' : type === 'file_upload' ? 'File Upload' : 'MCQ'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {q.manual_marks !== undefined && q.manual_marks !== null && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                          Awarded Marks: {q.manual_marks} / {q.marks}
                        </span>
                      )}
                      {q.manual_marks !== undefined && q.manual_marks !== null ? (
                        Number(q.manual_marks) >= Number(q.marks) ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Correct (+{q.manual_marks})
                          </span>
                        ) : Number(q.manual_marks) <= 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <AlertCircle size={12} /> Incorrect (0 pts)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Sparkles size={12} /> Partial Marks / Unattempted (+{q.manual_marks})
                          </span>
                        )
                      ) : isUnattempted ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Unattempted (0 pts)
                        </span>
                      ) : isMcq ? (
                        isCorrect ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Correct (+{q.marks})
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1">
                            <AlertCircle size={12} /> Incorrect {Number(q.negative_penalty || 0) > 0 ? `(-${q.negative_penalty})` : '(0 pts)'}
                          </span>
                        )
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                          <Sparkles size={12} /> Evaluated
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-900 break-words whitespace-pre-wrap leading-relaxed">
                    {q.question_text}
                  </div>

                  {/* Coding Answer */}
                  {type === 'coding' && (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-mono text-slate-100 overflow-x-auto shadow-inner">
                      <div className="flex items-center justify-between text-[11px] text-cyan-400 border-b border-slate-800 pb-2 mb-2 font-sans font-bold">
                        <span className="flex items-center gap-1.5">
                          <Code2 size={14} /> Your Submitted Code ({q.coding_language?.toUpperCase() || 'PYTHON'})
                        </span>
                        <span>{q.descriptive_answer ? `${q.descriptive_answer.split('\n').length} lines` : '0 lines'}</span>
                      </div>
                      {q.descriptive_answer ? (
                        <pre className="whitespace-pre overflow-x-auto leading-relaxed">{q.descriptive_answer}</pre>
                      ) : (
                        <span className="text-slate-500 italic font-sans">No code solution was submitted.</span>
                      )}
                    </div>
                  )}

                  {/* Written Answer */}
                  {type === 'written' && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 text-xs font-sans text-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-purple-900 border-b border-purple-100 pb-1.5">
                        <span>Your Written Answer Response</span>
                        <span>{q.descriptive_answer ? `${q.descriptive_answer.trim().split(/\s+/).filter(Boolean).length} words` : '0 words'}</span>
                      </div>
                      {q.descriptive_answer ? (
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-800 font-medium">{q.descriptive_answer}</p>
                      ) : (
                        <span className="text-slate-400 italic">No written response was submitted.</span>
                      )}
                    </div>
                  )}

                  {/* File Upload Answer */}
                  {type === 'file_upload' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-2">
                      <span className="text-[11px] font-bold text-amber-900 block">Your Uploaded Practical Attachment</span>
                      {q.submitted_file_url ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200 gap-3">
                          <div className="flex items-center gap-2 text-slate-800 font-bold truncate">
                            <FileText size={16} className="text-amber-600 shrink-0" />
                            <span className="truncate">{q.submitted_file_name || 'uploaded_attachment'}</span>
                          </div>
                          <a
                            href={q.submitted_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={q.submitted_file_name || 'attachment'}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition shrink-0 shadow-xs"
                          >
                            <Download size={13} /> Download File
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No file attachment was submitted.</span>
                      )}
                    </div>
                  )}

                  {/* Options (MCQ) */}
                  {isMcq && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map(opt => {
                        const isChosen = opt.id === q.selected_option_id;
                        const isRight = opt.id === q.correct_option_id;

                        let optClass = 'bg-white border-slate-200 text-slate-700';
                        if (isRight) {
                          optClass = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold';
                        } else if (isChosen && !isRight) {
                          optClass = 'bg-rose-50 border-rose-300 text-rose-950 font-bold';
                        }

                        return (
                          <div key={opt.id} className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${optClass}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isRight ? 'bg-emerald-600 text-white' : isChosen ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {opt.id.replace('opt', '')}
                            </span>
                            <span className="flex-1 break-words">{opt.text}</span>
                            {isRight && <span className="text-[10px] font-bold text-emerald-700">(Correct Answer)</span>}
                            {isChosen && !isRight && <span className="text-[10px] font-bold text-rose-700">(Your Answer)</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Teacher Remark for Question */}
                  {q.teacher_remarks && (
                    <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950">
                      <strong>Trainer Feedback:</strong> {q.teacher_remarks}
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 leading-relaxed mt-2 whitespace-pre-wrap">
                      <strong className="text-slate-900">Scientific Explanation / Solution:</strong> {q.explanation}
                    </div>
                  )}
                </ClayCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
