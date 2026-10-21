'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Layers,
  RefreshCw
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';

interface AdminStats {
  total_students: number;
  active_batches: number;
  pending_assignments: number;
  completed_assignments: number;
  overdue_assignments: number;
  awaiting_evaluations: number;
  awaiting_assignment_evaluations?: number;
  awaiting_exam_evaluations?: number;
  upcoming_exams: number;
  exams_in_progress: number;
  recent_submissions: {
    id: string;
    student_name: string;
    assignment_title: string;
    batch_name: string;
    submitted_at: string;
    status: string;
    marks_awarded: number | null;
  }[];
  recent_results: {
    id: string;
    student_name: string;
    exam_title: string;
    total_score: number;
    percentage: number;
    submitted_at: string;
    is_published?: number | boolean;
    evaluation_status?: string;
  }[];
  batch_completion_rates: {
    batch_name: string;
    completion_pct: number;
    student_count: number;
  }[];
}

let cachedAdminStats: AdminStats | null = null;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(cachedAdminStats);
  const [loading, setLoading] = useState(!cachedAdminStats);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    if (!cachedAdminStats) setLoading(true);
    setError(null);
    fetch(`/api/admin/dashboard?_t=${Date.now()}`, { cache: 'no-store' })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          cachedAdminStats = null;
          router.push('/login');
          return null;
        }
        const data = await res.json();
        if (!res.ok || data?.error) {
          throw new Error(data?.error || `Failed to fetch dashboard data (HTTP ${res.status})`);
        }
        return data;
      })
      .then(data => {
        if (data) {
          setStats(data);
          cachedAdminStats = data;
        }
      })
      .catch(err => {
        console.error('Error fetching admin dashboard stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-sm">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Unable to Load Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md">{error}</p>
        <div className="mt-6 flex items-center gap-3">
          <ClayButton variant="primary" size="md" onClick={fetchDashboard} className="shadow-md">
            <RefreshCw size={16} /> Retry Now
          </ClayButton>
          <ClayButton variant="outline" size="md" onClick={() => router.push('/login')}>
            Back to Login
          </ClayButton>
        </div>
      </div>
    );
  }

  const batchCompletionRates = Array.isArray(stats?.batch_completion_rates) ? stats.batch_completion_rates : [];
  const recentSubmissions = Array.isArray(stats?.recent_submissions) ? stats.recent_submissions : [];
  const recentResults = Array.isArray(stats?.recent_results) ? stats.recent_results : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 min-w-0">
          <span className="text-[10px] sm:text-xs uppercase tracking-widest text-indigo-300 font-bold">Trainer Executive Dashboard</span>
          <h1 className="text-xl sm:text-3xl font-black mt-1 tracking-tight break-words">
            Welcome, Tushar Shukla
          </h1>
          <p className="text-indigo-200 text-xs sm:text-sm mt-1.5 max-w-xl">
            Live classroom analytics across all batches, daily homework submissions, and online examination engines.
          </p>
        </div>
        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <ClayButton
            variant="teal"
            size="sm"
            onClick={() => router.push('/admin/assignments/create')}
            className="shadow-lg"
          >
            <Plus size={16} /> New Daily Homework
          </ClayButton>
          <ClayButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/exams')}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <FileSpreadsheet size={16} /> Schedule Exam
          </ClayButton>
        </div>
      </div>

      {/* Metrics Row (Clickable Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <ClayCard
          interactive
          variant="blue"
          onClick={() => router.push('/admin/students')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Active Students</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-blue-700 flex items-center justify-center clay-icon-bubble">
              <GraduationCap size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-blue-950">{stats?.total_students || 0}</p>
          <p className="text-xs text-blue-700 mt-1 font-medium flex items-center gap-1">
            Enrolled in batches <ArrowUpRight size={13} />
          </p>
        </ClayCard>

        <ClayCard
          interactive
          variant="purple"
          onClick={() => router.push('/admin/batches')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Active Batches</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-purple-700 flex items-center justify-center clay-icon-bubble">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-purple-950">{stats?.active_batches || 0}</p>
          <p className="text-xs text-purple-700 mt-1 font-medium flex items-center gap-1">
            9 AM, 1 PM, 5 PM <ArrowUpRight size={13} />
          </p>
        </ClayCard>

        <ClayCard
          interactive
          variant="amber"
          onClick={() => {
            if ((stats?.awaiting_exam_evaluations || 0) > 0) {
              router.push('/admin/exam-evaluations');
            } else {
              router.push('/admin/submissions');
            }
          }}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Awaiting Evaluation</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-amber-700 flex items-center justify-center clay-icon-bubble">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-amber-950">{stats?.awaiting_evaluations || 0}</p>
          <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
            {stats?.awaiting_exam_evaluations ? `${stats.awaiting_exam_evaluations} Exams` : ''}
            {stats?.awaiting_exam_evaluations && stats?.awaiting_assignment_evaluations ? ' • ' : ''}
            {stats?.awaiting_assignment_evaluations ? `${stats.awaiting_assignment_evaluations} Homework` : ''}
            {!stats?.awaiting_exam_evaluations && !stats?.awaiting_assignment_evaluations ? 'Pending review' : ''}
            <ArrowUpRight size={13} />
          </p>
        </ClayCard>

        <ClayCard
          interactive
          variant="teal"
          onClick={() => router.push('/admin/exams')}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Published Exams</span>
            <div className="w-8 h-8 rounded-xl bg-white/80 text-teal-700 flex items-center justify-center clay-icon-bubble">
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-teal-950">{stats?.upcoming_exams || 0}</p>
          <p className="text-xs text-teal-700 mt-1 font-medium flex items-center gap-1">
            {stats?.exams_in_progress || 0} currently in progress <ArrowUpRight size={13} />
          </p>
        </ClayCard>
      </div>

      {/* Second Row: Batch Performance & Quick Matrix Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batch-wise Completion Rates */}
        <ClayCard className="lg:col-span-1">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-600" /> Batch Completion Rates
            </h3>
            <button
              onClick={() => router.push('/admin/batches')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              View All
            </button>
          </div>

          {batchCompletionRates.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No batch completion statistics available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {batchCompletionRates.map((b, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{b.batch_name}</span>
                    <span className="text-indigo-600 font-mono">{b.completion_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${b.completion_pct}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-400">{b.student_count} registered students</p>
                </div>
              ))}
            </div>
          )}
        </ClayCard>

        {/* Recent Homework Submissions Queue */}
        <ClayCard className="lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <BookOpen size={16} className="text-teal-600" /> Recent Student Submissions
            </h3>
            <button
              onClick={() => router.push('/admin/submissions')}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold"
            >
              Open Evaluation Queue
            </button>
          </div>

          {recentSubmissions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No submissions received yet today.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentSubmissions.map(sub => (
                <div key={sub.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 break-words">{sub.student_name}</p>
                    <p className="text-[11px] text-slate-500 break-words">{sub.assignment_title} • <span className="font-semibold text-slate-600">{sub.batch_name}</span></p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sub.status === 'evaluated'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {sub.status === 'evaluated' ? `Graded (${sub.marks_awarded})` : 'Needs Evaluation'}
                    </span>
                    <button
                      onClick={() => router.push('/admin/submissions')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ClayCard>
      </div>

      {/* Third Row: Recent Exam Results */}
      <ClayCard>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Recent Examination Results
          </h3>
          <button
            onClick={() => router.push('/admin/exams')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            All Exam Analytics
          </button>
        </div>

        {recentResults.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No completed exam attempts yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentResults.map(res => (
              <div
                key={res.id}
                onClick={() => router.push(res.is_published ? '/admin/exams' : '/admin/exam-evaluations')}
                className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-amber-300 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{res.student_name}</p>
                  <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{res.exam_title}</p>
                </div>
                <div className="text-right">
                  {res.is_published ? (
                    <>
                      <span className="text-sm font-extrabold text-emerald-700 font-mono">{res.total_score} marks</span>
                      <p className="text-[10px] text-slate-400">{res.percentage}% accuracy</p>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Pending Evaluation
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ClayCard>
    </div>
  );
}
