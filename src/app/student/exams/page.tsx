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

export default function StudentExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<(Exam & { attempt?: ExamAttempt | null; is_eligible: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/exams')
      .then(res => res.json())
      .then(data => {
        setExams(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet size={24} className="text-teal-600" /> Online Examinations
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Standardized AE/JE mock examinations with server-authoritative timers and negative marking.
        </p>
      </div>

      {/* Grid of Exams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {exams.map(exam => {
          const attempt = exam.attempt;
          const isCompleted = attempt?.status === 'completed';
          const isInProgress = attempt?.status === 'in_progress';

          return (
            <ClayCard key={exam.id} className="flex flex-col justify-between hover:border-slate-300">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-100">
                    {exam.total_questions} Questions
                  </span>

                  {isCompleted ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Completed ({attempt.total_score} / {exam.max_marks} pts)
                    </span>
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
                    <span className="font-bold text-emerald-700 font-mono">+{exam.marks_per_question} / -{exam.negative_marking}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                {isCompleted ? (
                  <>
                    <div className="font-mono text-xs font-bold text-emerald-700">
                      Score: {attempt.total_score} pts ({attempt.accuracy}% acc)
                    </div>
                    <ClayButton
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/student/exams/${exam.id}/result`)}
                    >
                      <Trophy size={14} className="text-amber-500" /> View Result
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
