'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  BookOpen,
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  Award
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';

interface StudentDashboardData {
  student: {
    id: string;
    student_id: string;
    name: string;
    email: string;
  };
  batches: { id: string; name: string }[];
  pending_assignments: number;
  completed_assignments: number;
  overdue_assignments: number;
  awaiting_evaluation: number;
  upcoming_exams: number;
  completed_exams: number;
  recent_submissions: {
    id: string;
    assignment_title: string;
    submitted_at: string;
    status: string;
    marks_awarded: number | null;
  }[];
  recent_exam_results: {
    id: string;
    exam_title: string;
    total_score: number;
    max_marks: number;
    percentage: number;
    accuracy: number;
    rank: number;
  }[];
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/dashboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-teal-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-cyan-400/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-teal-300 font-bold px-2 py-0.5 rounded-full bg-teal-950/50 border border-teal-700/50">
              Student Academic Portal
            </span>
            <span className="font-mono text-xs text-cyan-200 font-bold">
              {data.student.student_id}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Hello, {data.student.name}
          </h1>

          <p className="text-teal-200 text-xs sm:text-sm max-w-xl">
            Welcome to your classroom workspace. Review daily homework tasks, submit working, and take scheduled mock examinations.
          </p>

          <div className="pt-2 flex flex-wrap gap-1.5">
            {data.batches.map(b => (
              <span key={b.id} className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                Cohort: {b.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <ClayButton
            variant="teal"
            size="md"
            onClick={() => router.push('/student/exams')}
            className="shadow-lg bg-cyan-400 text-slate-900 hover:bg-cyan-300 font-bold"
          >
            <FileCheck2 size={16} /> Online Examinations
          </ClayButton>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <ClayCard
          interactive
          variant="amber"
          onClick={() => router.push('/student/assignments')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Tasks</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-amber-700 flex items-center justify-center clay-icon-bubble">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-amber-950">{data.pending_assignments}</p>
          <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
            Daily homework to submit <ArrowRight size={13} />
          </p>
        </ClayCard>

        <ClayCard
          interactive
          variant="teal"
          onClick={() => router.push('/student/exams')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Available Exams</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-teal-700 flex items-center justify-center clay-icon-bubble">
              <FileCheck2 size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-teal-950">{data.upcoming_exams}</p>
          <p className="text-xs text-teal-700 mt-1 font-medium flex items-center gap-1">
            Scheduled for your batch <ArrowRight size={13} />
          </p>
        </ClayCard>

        <ClayCard
          interactive
          variant="blue"
          onClick={() => router.push('/student/assignments')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Under Review</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-blue-700 flex items-center justify-center clay-icon-bubble">
              <BookOpen size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-blue-950">{data.awaiting_evaluation}</p>
          <p className="text-xs text-blue-700 mt-1 font-medium">Awaiting trainer evaluation</p>
        </ClayCard>

        <ClayCard
          interactive
          variant="purple"
          onClick={() => router.push('/student/assignments')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Completed Tasks</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-purple-700 flex items-center justify-center clay-icon-bubble">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-purple-950">{data.completed_assignments}</p>
          <p className="text-xs text-purple-700 mt-1 font-medium">Graded & feedback released</p>
        </ClayCard>
      </div>

      {/* Two Column Section: Homework Submissions & Exam Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Homework Submissions */}
        <ClayCard className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen size={18} className="text-teal-600" /> Recent Daily Homework Submissions
            </h3>
            <button
              onClick={() => router.push('/student/assignments')}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold"
            >
              View All
            </button>
          </div>

          {data.recent_submissions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No homework submitted yet. Check your assigned tasks.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent_submissions.map(sub => (
                <div key={sub.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{sub.assignment_title}</p>
                    <p className="text-[11px] text-slate-500">
                      Submitted on {new Date(sub.submitted_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    {sub.status === 'evaluated' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Evaluated ({sub.marks_awarded} pts)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Under Review
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ClayCard>

        {/* Released Exam Results */}
        <ClayCard className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" /> My Examination Results
            </h3>
            <button
              onClick={() => router.push('/student/exams')}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold"
            >
              Exams Portal
            </button>
          </div>

          {data.recent_exam_results.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No completed examination results available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.recent_exam_results.map(res => (
                <div key={res.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{res.exam_title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Accuracy: <strong className="text-teal-700">{res.accuracy}%</strong> • Batch Rank: <strong className="text-amber-600">#{res.rank || 1}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {res.total_score} / {res.max_marks}
                    </span>
                    <p className="text-[10px] text-slate-400 font-semibold">{res.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ClayCard>
      </div>
    </div>
  );
}
