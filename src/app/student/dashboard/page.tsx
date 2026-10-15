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
  Check
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
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
  const [selectedBatchTab, setSelectedBatchTab] = useState<string>('all');

  useEffect(() => {
    fetch('/api/student/dashboard')
      .then(res => res.json())
      .then(d => {
        if (d && !d.error) {
          setData(d);
          cachedStudentDashboard = d;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) return null;

  const breakdowns = data.batch_breakdowns || [];
  const displayedBatches = selectedBatchTab === 'all'
    ? breakdowns
    : breakdowns.filter(b => b.batch_id === selectedBatchTab);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl shadow-teal-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-cyan-400/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-teal-300 font-bold px-2 py-0.5 rounded-full bg-teal-950/50 border border-teal-700/50">
              Student Academic Portal
            </span>
            <span className="font-mono text-xs text-cyan-200 font-bold">
              {data.student.student_id}
            </span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black tracking-tight break-words">
            Hello, {data.student.name}
          </h1>

          <p className="text-teal-200 text-xs sm:text-sm max-w-xl">
            Welcome to your classroom workspace. Review daily homework tasks, submit working, and take scheduled mock examinations.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-teal-300">Assigned Batches:</span>
            {data.batches.length === 0 ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                No cohort assigned
              </span>
            ) : (
              data.batches.map(b => (
                <span key={b.id} className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                  {b.name}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 self-start sm:self-auto shrink-0">
          <ClayButton
            variant="teal"
            size="md"
            onClick={() => router.push('/student/exams')}
            className="shadow-lg bg-cyan-400 text-slate-900 hover:bg-cyan-300 font-bold text-xs sm:text-sm"
          >
            <FileCheck2 size={16} /> Online Examinations
          </ClayButton>
        </div>
      </div>

      {/* Main Aggregate Metric Cards (All Batches Total) */}
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
          <ClayCard
            interactive
            variant="amber"
            onClick={() => router.push('/student/assignments')}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Total Pending Tasks</span>
              <div className="w-8 h-8 rounded-xl bg-white/80 text-amber-700 flex items-center justify-center clay-icon-bubble">
                <Clock size={18} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-amber-950">{data.pending_assignments}</p>
            <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
              Homework to submit <ArrowRight size={13} />
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
              Mock exams scheduled <ArrowRight size={13} />
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
            <p className="text-xs text-blue-700 mt-1 font-medium">Awaiting evaluation</p>
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
            <p className="text-xs text-purple-700 mt-1 font-medium">Graded & marks awarded</p>
          </ClayCard>
        </div>
      </div>

      {/* MULTI-BATCH BREAKDOWN SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <GraduationCap size={22} className="text-teal-600" />
              My Enrolled Batches & Cohort Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Clear status of pending homework, submitted tasks, and examinations for each specific batch.
            </p>
          </div>

          {/* Batch Selector Filter if student is in multiple batches */}
          {breakdowns.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedBatchTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedBatchTab === 'all'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Batches ({breakdowns.length})
              </button>
              {breakdowns.map(b => (
                <button
                  key={b.batch_id}
                  onClick={() => setSelectedBatchTab(b.batch_id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    selectedBatchTab === b.batch_id
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {b.batch_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {breakdowns.length === 0 ? (
          <ClayCard className="text-center py-10 space-y-2">
            <Layers className="mx-auto text-slate-300" size={36} />
            <p className="text-sm font-bold text-slate-700">No Batches Assigned</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You are currently not enrolled in any batch. Please contact your trainer or institute administrator to get enrolled.
            </p>
          </ClayCard>
        ) : (
          <div className="space-y-5">
            {displayedBatches.map(batch => {
              const underReviewCount = Math.max(0, batch.submitted_assignments - batch.evaluated_assignments);
              const completionPercent = batch.total_assignments > 0
                ? Math.round((batch.submitted_assignments / batch.total_assignments) * 100)
                : 100;

              return (
                <div
                  key={batch.batch_id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5 transition hover:shadow-md"
                >
                  {/* Batch Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                        <GraduationCap size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900">
                            {batch.batch_name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Cohort ID: {batch.batch_id.slice(0, 8)}
                          </span>
                        </div>
                        {batch.batch_description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {batch.batch_description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress Badge */}
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] font-bold text-slate-500">Submission Rate</p>
                        <p className="text-xs font-black text-teal-700">{completionPercent}% Complete</p>
                      </div>
                      <div className="w-24 sm:w-28 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${completionPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Batch Statistics Chips Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-amber-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
                        <Clock size={15} />
                      </div>
                      <p className="text-2xl font-black text-amber-950 mt-1">{batch.pending_assignments}</p>
                      <p className="text-[10px] text-amber-700 mt-0.5 font-medium">To be submitted</p>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-blue-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Submitted</span>
                        <BookOpen size={15} />
                      </div>
                      <p className="text-2xl font-black text-blue-950 mt-1">{batch.submitted_assignments}</p>
                      <p className="text-[10px] text-blue-700 mt-0.5 font-medium">
                        {underReviewCount} awaiting review
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-emerald-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Evaluated</span>
                        <CheckCircle2 size={15} />
                      </div>
                      <p className="text-2xl font-black text-emerald-950 mt-1">{batch.evaluated_assignments}</p>
                      <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">With trainer marks</p>
                    </div>

                    <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-teal-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Mock Exams</span>
                        <FileCheck2 size={15} />
                      </div>
                      <p className="text-2xl font-black text-teal-950 mt-1">{batch.upcoming_exams}</p>
                      <p className="text-[10px] text-teal-700 mt-0.5 font-medium">
                        {batch.completed_exams} taken
                      </p>
                    </div>
                  </div>

                  {/* Tasks List for this Batch */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen size={14} className="text-teal-600" /> Tasks in {batch.batch_name}
                      </h4>
                      <button
                        onClick={() => router.push('/student/assignments')}
                        className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1"
                      >
                        All Batch Tasks <ArrowRight size={12} />
                      </button>
                    </div>

                    {batch.assignments.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No homework assignments published for this cohort yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {batch.assignments.slice(0, 4).map(asg => {
                          const deadline = new Date(asg.deadline);
                          const isOverdue = asg.status === 'overdue';

                          return (
                            <div
                              key={asg.id}
                              className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                                    {asg.subject}
                                  </span>
                                  <h5 className="text-xs font-bold text-slate-900 break-words">
                                    {asg.title}
                                  </h5>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className={isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                                    Due: {deadline.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span>Max: {asg.max_score} pts</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                {asg.status === 'evaluated' && (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Evaluated ({asg.marks_awarded}/{asg.max_score} pts)
                                  </span>
                                )}
                                {asg.status === 'submitted' && (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                                    Under Review
                                  </span>
                                )}
                                {asg.status === 'overdue' && (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                                    Overdue
                                  </span>
                                )}
                                {asg.status === 'pending' && (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                                    Pending
                                  </span>
                                )}

                                <button
                                  onClick={() => router.push('/student/assignments')}
                                  className="text-xs font-bold px-3 py-1 rounded-lg bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 transition"
                                >
                                  {asg.status === 'pending' || asg.status === 'overdue' ? 'Submit' : 'View'}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {batch.assignments.length > 4 && (
                          <div className="text-center pt-1">
                            <button
                              onClick={() => router.push('/student/assignments')}
                              className="text-xs font-bold text-teal-700 hover:text-teal-900"
                            >
                              + {batch.assignments.length - 4} more tasks in this batch →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Scheduled Mock Exams in this Batch if any */}
                  {batch.exams.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <FileCheck2 size={15} className="text-teal-600" />
                        <span className="font-bold">{batch.exams.length} Examination{batch.exams.length > 1 ? 's' : ''} Scheduled</span>
                        <span className="text-slate-400">({batch.completed_exams} completed)</span>
                      </div>
                      <button
                        onClick={() => router.push('/student/exams')}
                        className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 self-start sm:self-auto"
                      >
                        Go to Exams <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                <div key={sub.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 break-words">{sub.assignment_title}</p>
                    <p className="text-[11px] text-slate-500">
                      Submitted on {new Date(sub.submitted_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="self-start sm:self-auto shrink-0">
                    {sub.status === 'evaluated' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Evaluated ({sub.marks_awarded} pts)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
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
                <div key={res.id} className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

