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
  Award,
  Layers,
  ChevronRight,
  Calendar,
  Check,
  RefreshCw
} from 'lucide-react';
import { ClayCard, ClayCard3D, ClayButton } from '@/components/ui/ClayComponents';
import StudentHero3D from '@/components/student/StudentHero3D';
import Student3DPerformanceCard from '@/components/student/Student3DPerformanceCard';
import Ambient3DBackground from '@/components/ui/Ambient3DBackground';
import { StudentBatchBreakdown } from '@/lib/db/types';

interface StudentDashboardData {
  student: {
    id: string;
    student_id: string;
    name: string;
    email: string;
  };
  batches: { id: string; name: string; description?: string | null }[];
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
  batch_breakdowns?: StudentBatchBreakdown[];
}

// In-memory module cache for instant 0ms page reload
let cachedStudentDashboard: StudentDashboardData | null = null;

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(cachedStudentDashboard);
  const [loading, setLoading] = useState(!cachedStudentDashboard);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    fetch(`/api/student/dashboard?_t=${Date.now()}`, { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          let errMsg = `Server returned status ${res.status}`;
          try {
            const parsed = JSON.parse(text);
            errMsg = parsed.error || errMsg;
          } catch {}
          throw new Error(errMsg);
        }
        return res.json();
      })
      .then(d => {
        if (d && !d.error && d.student) {
          setData(d);
          cachedStudentDashboard = d;
          setError(null);
          try {
            localStorage.setItem('student_dashboard_cache', JSON.stringify(d));
          } catch {}
        }
      })
      .catch(err => {
        console.warn('[STUDENT DASHBOARD FETCH]:', err);
        setError(err instanceof Error ? err.message : 'Unable to connect to dashboard server');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (cachedStudentDashboard) {
      setData(cachedStudentDashboard);
      setLoading(false);
    } else {
      try {
        const saved = localStorage.getItem('student_dashboard_cache');
        if (saved) {
          const parsed = JSON.parse(saved);
          cachedStudentDashboard = parsed;
          setData(parsed);
          setLoading(false);
        }
      } catch {}
    }

    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading student workspace...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-xs">
          <AlertCircle size={28} />
        </div>
        <h3 className="text-base font-extrabold text-slate-900 mb-1">
          Unable to Load Classroom Workspace
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
          {error || 'We had trouble connecting to your classroom workspace. Please check your connection and tap retry.'}
        </p>
        <ClayButton
          variant="teal"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchDashboard();
          }}
          className="flex items-center gap-2 font-bold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Retry Loading
        </ClayButton>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      {/* 3D Ambient Background Aura */}
      <Ambient3DBackground />

      {/* Welcome Hero Banner with 3D Gyro Hologram & Parallax Tilt */}
      <StudentHero3D
        studentName={data.student?.name || 'Student'}
        studentId={data.student?.student_id || 'STU'}
        batches={data.batches}
      />

      {/* Gamified 3D Momentum & Performance Hub */}
      <Student3DPerformanceCard
        completedAssignments={data.completed_assignments}
        pendingAssignments={data.pending_assignments}
        completedExams={data.completed_exams}
        upcomingExams={data.upcoming_exams}
        recentExamAccuracy={data.recent_exam_results?.[0]?.accuracy}
      />

      {/* Main Aggregate Metric Cards (All Batches Total) - With 3D Perspective Tilt & Light Sheen */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} className="text-teal-600" /> Overall Summary Across All Batches
          </h2>
          <span className="text-[11px] text-slate-600 font-medium">
            {data.batches.length} {data.batches.length === 1 ? 'Batch Enrolled' : 'Batches Enrolled'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <ClayCard3D
            variant="amber"
            glareVariant="amber"
            maxTilt={14}
            animatedFloat={true}
            onClick={() => router.push('/student/assignments')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Total Pending Tasks</span>
              <div className="w-9 h-9 rounded-2xl bg-white/90 text-amber-700 flex items-center justify-center clay-icon-bubble shadow-xs" style={{ transform: 'translateZ(18px)' }}>
                <Clock size={19} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-amber-950 tracking-tight" style={{ transform: 'translateZ(24px)' }}>
              {data.pending_assignments}
            </p>
            <p className="text-xs text-amber-700 mt-1 font-semibold flex items-center gap-1" style={{ transform: 'translateZ(16px)' }}>
              Homework to submit <ArrowRight size={13} />
            </p>
          </ClayCard3D>

          <ClayCard3D
            variant="teal"
            glareVariant="cyan"
            maxTilt={14}
            animatedFloat={true}
            onClick={() => router.push('/student/exams')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Available Exams</span>
              <div className="w-9 h-9 rounded-2xl bg-white/90 text-teal-700 flex items-center justify-center clay-icon-bubble shadow-xs" style={{ transform: 'translateZ(18px)' }}>
                <FileCheck2 size={19} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-teal-950 tracking-tight" style={{ transform: 'translateZ(24px)' }}>
              {data.upcoming_exams}
            </p>
            <p className="text-xs text-teal-700 mt-1 font-semibold flex items-center gap-1" style={{ transform: 'translateZ(16px)' }}>
              Mock exams scheduled <ArrowRight size={13} />
            </p>
          </ClayCard3D>

          <ClayCard3D
            variant="blue"
            glareVariant="holographic"
            maxTilt={14}
            animatedFloat={true}
            onClick={() => router.push('/student/assignments')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Under Review</span>
              <div className="w-9 h-9 rounded-2xl bg-white/90 text-blue-700 flex items-center justify-center clay-icon-bubble shadow-xs" style={{ transform: 'translateZ(18px)' }}>
                <BookOpen size={19} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-blue-950 tracking-tight" style={{ transform: 'translateZ(24px)' }}>
              {data.awaiting_evaluation}
            </p>
            <p className="text-xs text-blue-700 mt-1 font-semibold" style={{ transform: 'translateZ(16px)' }}>
              Awaiting evaluation
            </p>
          </ClayCard3D>

          <ClayCard3D
            variant="purple"
            glareVariant="purple"
            maxTilt={14}
            animatedFloat={true}
            onClick={() => router.push('/student/assignments')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Completed Tasks</span>
              <div className="w-9 h-9 rounded-2xl bg-white/90 text-purple-700 flex items-center justify-center clay-icon-bubble shadow-xs" style={{ transform: 'translateZ(18px)' }}>
                <CheckCircle2 size={19} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-purple-950 tracking-tight" style={{ transform: 'translateZ(24px)' }}>
              {data.completed_assignments}
            </p>
            <p className="text-xs text-purple-700 mt-1 font-semibold" style={{ transform: 'translateZ(16px)' }}>
              Graded & marks awarded
            </p>
          </ClayCard3D>
        </div>
      </div>

      {/* Two Column Section: Homework Submissions & Exam Results with 3D Perspectives */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Homework Submissions */}
        <ClayCard3D variant="white" maxTilt={6} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen size={18} className="text-teal-600" /> Recent Daily Homework Submissions
            </h3>
            <button
              onClick={() => router.push('/student/assignments')}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {data.recent_submissions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No homework submitted yet. Check your assigned tasks.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.recent_submissions.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => router.push('/student/assignments')}
                  className="p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-100 hover:border-teal-300 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 break-words group-hover:text-teal-700 transition">
                      {sub.assignment_title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Submitted on {new Date(sub.submitted_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="self-start sm:self-auto shrink-0">
                    {sub.status === 'evaluated' ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                        Evaluated ({sub.marks_awarded} pts)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        Under Review
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ClayCard3D>

        {/* Released Exam Results */}
        <ClayCard3D variant="white" maxTilt={6} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" /> My Examination Results
            </h3>
            <button
              onClick={() => router.push('/student/exams')}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer"
            >
              Exams Portal
            </button>
          </div>

          {data.recent_exam_results.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No completed examination results available yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.recent_exam_results.map(res => (
                <div
                  key={res.id}
                  onClick={() => router.push(`/student/exams/${res.id}/result`)}
                  className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-100 hover:border-amber-300 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 break-words">{res.exam_title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Accuracy: <strong className="text-teal-700">{res.accuracy}%</strong> • Batch Rank: <strong className="text-amber-600">#{res.rank || 1}</strong>
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {res.total_score} / {res.max_marks}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold">{res.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ClayCard3D>
      </div>
    </div>
  );
}

