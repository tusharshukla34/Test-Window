'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trophy,
  Play
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Exam, ExamAttempt } from '@/lib/db/types';

let cachedStudentExams: (Exam & { attempt?: ExamAttempt | null; is_eligible: boolean })[] | null = null;

export default function StudentExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<(Exam & { attempt?: ExamAttempt | null; is_eligible: boolean })[]>(cachedStudentExams || []);
  const [loading, setLoading] = useState(!cachedStudentExams);

  useEffect(() => {
    if (!cachedStudentExams && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('student_exams_cache');
        if (saved) {
          const parsed = JSON.parse(saved);
          cachedStudentExams = parsed;
          setExams(parsed);
          setLoading(false);
        }
      } catch {}
    }

    fetch('/api/student/exams')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setExams(data);
          cachedStudentExams = data;
          try {
            localStorage.setItem('student_exams_cache', JSON.stringify(data));
          } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet size={24} className="text-teal-600 shrink-0" /> Online Examinations
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Curated online examinations and assessments with server-authoritative timers.
        </p>
      </div>

      {/* Grid of Exams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {exams.map(exam => {
          const attempt = exam.attempt;
          const isCompleted = attempt?.status === 'completed';
          const isInProgress = attempt?.status === 'in_progress';
          const isPublished = Boolean(attempt?.is_published);

          return (
            <ClayCard key={exam.id} className="flex flex-col justify-between hover:border-slate-300">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-100">
                    {exam.total_questions} Questions
                  </span>

                  {isCompleted ? (
                    isPublished ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Published ({attempt.total_score} / {exam.max_marks} pts)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                        Submitted — Under Evaluation
                      </span>
                    )
                  ) : isInProgress ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                      In Progress
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                      Available
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {exam.title}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-2">
                  {exam.description || 'AE/JE Mechanical and Thermodynamics comprehensive practice test.'}
                </p>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Test Duration</span>
                    <span className="font-bold text-slate-800 font-mono">{exam.duration_minutes} Minutes</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Marking Scheme</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      +{exam.marks_per_question} {Number(exam.negative_marking || 0) > 0 ? `/ -${exam.negative_marking}` : '(No Penalty)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                {isCompleted ? (
                  <>
                    <div className="font-mono text-xs font-bold text-slate-700">
                      {isPublished
                        ? `Score: ${attempt.total_score} pts (${attempt.accuracy ?? 0}% acc)`
                        : 'Awaiting Trainer Evaluation'}
                    </div>
                    <ClayButton
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/student/exams/${exam.id}/result`)}
                      className="w-full sm:w-auto"
                    >
                      <Trophy size={14} className="text-amber-500" /> {isPublished ? 'View Result' : 'View Status'}
                    </ClayButton>
                  </>
                ) : isInProgress ? (
                  <>
                    <span className="text-xs font-bold text-amber-600">
                      Attempt active
                    </span>
                    <ClayButton
                      variant="primary"
                      size="sm"
                      onClick={() => router.push(`/student/exams/${exam.id}/attempt`)}
                      className="w-full sm:w-auto"
                    >
                      <Play size={14} /> Resume Test
                    </ClayButton>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-500">Ready to take</span>
                    <ClayButton
                      variant="teal"
                      size="sm"
                      onClick={() => router.push(`/student/exams/${exam.id}/instructions`)}
                      className="w-full sm:w-auto"
                    >
                      Instructions & Begin <ArrowRight size={14} />
                    </ClayButton>
                  </>
                )}
              </div>
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}
