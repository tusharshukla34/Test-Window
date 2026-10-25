'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Sparkles
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Exam } from '@/lib/db/types';

interface StudentExamSubmissionItem {
  exam: Exam;
  submission_state: 'not_started' | 'in_progress' | 'awaiting_evaluation' | 'published';
  attempt: {
    id: string;
    status: string;
    submitted_at: string | null;
    evaluation_status: string;
    is_published: boolean;
    total_score: number | null;
    percentage: number | null;
    trainer_feedback: string | null;
    published_at: string | null;
    is_absent?: number | boolean;
    result_status?: string;
  } | null;
}

let cachedStudentResults: StudentExamSubmissionItem[] | null = null;

export default function StudentResultsHubPage() {
  const router = useRouter();
  const [items, setItems] = useState<StudentExamSubmissionItem[]>(cachedStudentResults || []);
  const [loading, setLoading] = useState(!cachedStudentResults);

  useEffect(() => {
    // Restore from localStorage if module cache is empty
    if (!cachedStudentResults && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('student_results_cache');
        if (saved) {
          const parsed = JSON.parse(saved);
          cachedStudentResults = parsed;
          setItems(parsed);
          setLoading(false);
        }
      } catch {}
    }

    fetch(`/api/student/results?_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setItems(data);
          cachedStudentResults = data;
          try {
            localStorage.setItem('student_results_cache', JSON.stringify(data));
          } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
            <Sparkles size={13} /> Examination Performance Hub
          </span>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
            My Examination Results
          </h1>
          <p className="text-xs text-slate-500">
            Track submitted examinations, trainer manual review progress, and verified scorecards.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="p-12 text-center space-y-3 bg-white">
          <Award size={40} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-800 text-base">No examinations found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Examinations scheduled for your batch will appear here once assigned by Trainer Tushar Shukla.
          </p>
        </ClayCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(({ exam, submission_state, attempt }) => {
            const isPublished = Boolean(attempt?.is_published);
            const isAwaiting = submission_state === 'awaiting_evaluation';
            const isEvaluatedNotPublished = isAwaiting && attempt?.evaluation_status === 'evaluated';
            const isAbsent = Boolean(attempt?.is_absent || (attempt as any)?.result_status === 'absent_fail');
            const passPct = (exam as any)?.passing_percentage ?? 40.0;
            const isPass = !isAbsent && Number(attempt?.percentage || 0) >= passPct;

            return (
              <ClayCard
                key={exam.id}
                className="p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow bg-white border border-slate-200/80"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Engineering Assessment
                    </span>

                    {/* Status Badges */}
                    {isPublished ? (
                      isAbsent ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 shrink-0">
                          <AlertCircle size={12} className="text-rose-600" /> Failed (Absent)
                        </span>
                      ) : isPass ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={12} className="text-emerald-600" /> PASSED
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 shrink-0">
                          <AlertCircle size={12} className="text-rose-600" /> FAILED
                        </span>
                      )
                    ) : isEvaluatedNotPublished ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 shrink-0">
                        <Clock size={12} /> Evaluated
                      </span>
                    ) : isAwaiting ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                        <Clock size={12} /> Awaiting Review
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 shrink-0">
                        Pending
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900 leading-snug break-words">
                    {exam.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-500 pt-1">
                    <span>{exam.total_questions} Questions</span>
                    <span>•</span>
                    <span>Max {exam.max_marks} Pts</span>
                    <span>•</span>
                    <span>{exam.duration_minutes} Mins</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-600">Pass Mark: {passPct}%</span>
                  </div>
                </div>

                {/* Score or Status Banner */}
                {isPublished && attempt && isAbsent ? (
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                        Evaluation Result
                      </span>
                      <span className="text-sm font-black text-rose-950 font-mono">
                        0 / {exam.max_marks} (0%)
                      </span>
                      <span className="text-[10px] text-rose-600 block">Did not attempt before deadline</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        ABSENT (FAIL)
                      </span>
                    </div>
                  </div>
                ) : isPublished && attempt && attempt.total_score !== null ? (
                  <div className={`rounded-xl p-3 flex items-center justify-between border ${
                    isPass ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                  }`}>
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                        isPass ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        Verified Score ({isPass ? 'PASSED' : 'FAILED'})
                      </span>
                      <span className={`text-lg font-black font-mono ${
                        isPass ? 'text-emerald-950' : 'text-rose-950'
                      }`}>
                        {attempt.total_score} / {exam.max_marks}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                        isPass ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        Percentage
                      </span>
                      <span className={`text-lg font-black ${
                        isPass ? 'text-emerald-950' : 'text-rose-950'
                      }`}>
                        {attempt.percentage}%
                      </span>
                    </div>
                  </div>
                ) : isAwaiting ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" /> Submitted Successfully
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Trainer Tushar Shukla will review your answer sheet and publish the results when ready.
                    </p>
                  </div>
                ) : null}

                {/* Card Action */}
                <div className="pt-2">
                  {isPublished ? (
                    <ClayButton
                      onClick={() => router.push(`/student/exams/${exam.id}/result`)}
                      variant="primary"
                      className="w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
                    >
                      View Verified Scorecard & Review <ChevronRight size={14} />
                    </ClayButton>
                  ) : isAwaiting ? (
                    <ClayButton
                      onClick={() => router.push(`/student/exams/${exam.id}/result`)}
                      variant="secondary"
                      className="w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
                    >
                      View Submission Receipt <ChevronRight size={14} />
                    </ClayButton>
                  ) : (
                    <ClayButton
                      onClick={() => router.push(`/student/exams/${exam.id}/instructions`)}
                      variant="secondary"
                      className="w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
                    >
                      Go to Examination <ChevronRight size={14} />
                    </ClayButton>
                  )}
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
