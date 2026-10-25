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
  RefreshCw,
  Award,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Search,
  Pencil,
  Target
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';

interface ExamPassFailStudent {
  student_id: string;
  name: string;
  student_id_code: string;
  batch_name: string;
  total_score: number | null;
  max_marks: number;
  percentage: number | null;
  is_absent: boolean;
  result_status: 'pass' | 'fail' | 'absent_fail' | 'pending';
  status: string;
}

interface ExamPassFailReport {
  exam_id: string;
  title: string;
  is_deleted: boolean;
  status: string;
  duration_minutes: number;
  max_marks: number;
  passing_percentage: number;
  deadline: string | null;
  created_at: string;
  batch_names: string[];
  total_eligible: number;
  total_attempted: number;
  passed_count: number;
  failed_count: number;
  absent_count: number;
  pass_rate: number;
  students: ExamPassFailStudent[];
}

interface ExamPassFailSummary {
  total_exams_conducted: number;
  total_passed_students: number;
  total_failed_students: number;
  total_absent_students: number;
  overall_pass_rate: number;
  reports: ExamPassFailReport[];
}

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
  exam_pass_fail_summary?: ExamPassFailSummary;
}

let cachedAdminStats: AdminStats | null = null;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(cachedAdminStats);
  const [loading, setLoading] = useState(!cachedAdminStats);
  const [error, setError] = useState<string | null>(null);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Quick Edit Passing Percentage Modal State
  const [editPassModalOpen, setEditPassModalOpen] = useState(false);
  const [editPassExamId, setEditPassExamId] = useState<string | null>(null);
  const [editPassExamTitle, setEditPassExamTitle] = useState('');
  const [editPassPercentage, setEditPassPercentage] = useState(40);
  const [editPassMaxMarks, setEditPassMaxMarks] = useState(20);
  const [editPassSaving, setEditPassSaving] = useState(false);

  const openPassEditModal = (examId: string, title: string, currentPct: number, maxMarks: number) => {
    setEditPassExamId(examId);
    setEditPassExamTitle(title);
    setEditPassPercentage(currentPct || 40);
    setEditPassMaxMarks(maxMarks || 20);
    setEditPassModalOpen(true);
  };

  const handleSavePassPercentage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPassExamId) return;
    setEditPassSaving(true);
    try {
      const res = await fetch(`/api/admin/exams/${editPassExamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passing_percentage: Number(editPassPercentage) || 40 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update passing percentage');
      setEditPassModalOpen(false);
      cachedAdminStats = null;
      fetchDashboard();
      alert(`Success! Updated passing cutoff for "${editPassExamTitle}" to ${editPassPercentage}% (${((editPassMaxMarks * editPassPercentage) / 100).toFixed(1)} marks).\nAudit report has been updated!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating passing percentage');
    } finally {
      setEditPassSaving(false);
    }
  };

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

      {/* Fourth Row: All Examinations Conducted — Pass & Fail Audit Ledger */}
      {(() => {
        const passFailSummary = stats?.exam_pass_fail_summary;
        const allReports = passFailSummary?.reports || [];
        const filteredReports = allReports.filter(rep => {
          if (reportFilter === 'active' && rep.is_deleted) return false;
          if (reportFilter === 'archived' && !rep.is_deleted) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = rep.title.toLowerCase().includes(q);
            const matchBatch = (rep.batch_names || []).some(b => b.toLowerCase().includes(q));
            const matchStudent = (rep.students || []).some(s =>
              s.name.toLowerCase().includes(q) || (s.student_id_code && s.student_id_code.toLowerCase().includes(q))
            );
            return matchTitle || matchBatch || matchStudent;
          }
          return true;
        });

        return (
          <ClayCard className="space-y-5 border-indigo-100 bg-white shadow-sm">
            {/* Header & Subtitle */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                    <Award size={18} />
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    All Examinations Conducted — Pass & Fail Audit Report
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanent historical audit of all tests. Scorecards and pass/fail records are permanently stored even if an exam is removed or archived.
                </p>
              </div>

              <ClayButton
                variant="primary"
                size="sm"
                onClick={() => router.push('/admin/exams')}
                className="self-start md:self-auto shrink-0 shadow-sm"
              >
                <Plus size={14} /> Schedule New Exam
              </ClayButton>
            </div>

            {/* Overall KPI Statistics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                  Exams Conducted
                </span>
                <span className="text-2xl font-black text-indigo-950 font-mono mt-0.5 block">
                  {passFailSummary?.total_exams_conducted || 0}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold">Active & Archived Records</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Total Students Passed
                </span>
                <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">
                  {passFailSummary?.total_passed_students || 0}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">Achieved Required Pass Mark</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                  Total Students Failed
                </span>
                <span className="text-2xl font-black text-rose-950 font-mono mt-0.5 block">
                  {passFailSummary?.total_failed_students || 0}
                </span>
                <span className="text-[10px] text-rose-600 font-semibold">
                  Includes {passFailSummary?.total_absent_students || 0} Absent / Unattempted
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Class Pass Rate
                </span>
                <span className="text-2xl font-black text-amber-950 font-mono mt-0.5 block">
                  {passFailSummary?.overall_pass_rate || 0}%
                </span>
                <div className="w-full bg-amber-200/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, passFailSummary?.overall_pass_rate || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setReportFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    reportFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Exams ({allReports.length})
                </button>
                <button
                  onClick={() => setReportFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    reportFilter === 'active'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Active ({allReports.filter(r => !r.is_deleted).length})
                </button>
                <button
                  onClick={() => setReportFilter('archived')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    reportFilter === 'archived'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Archived / Removed ({allReports.filter(r => r.is_deleted).length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by exam, batch, or student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="clay-input w-full pl-8 pr-3 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Exam Reports List */}
            {filteredReports.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No conducted examination records found matching your filter.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map(rep => {
                  const isExpanded = expandedExamId === rep.exam_id;
                  const isArchived = Boolean(rep.is_deleted);
                  const hasDeadline = Boolean(rep.deadline);
                  const isDeadlinePassed = hasDeadline && new Date(rep.deadline!) <= new Date();

                  return (
                    <div
                      key={rep.exam_id}
                      className={`rounded-2xl border transition overflow-hidden ${
                        isArchived
                          ? 'border-dashed border-slate-300 bg-slate-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Main Summary Header */}
                      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-slate-900 text-sm sm:text-base break-words">
                              {rep.title}
                            </h4>
                            {isArchived ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                Archived Record
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active Test
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                              Pass Mark: ≥{rep.passing_percentage}% ({((rep.max_marks * rep.passing_percentage) / 100).toFixed(1)}m)
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span>Batches: <strong className="text-slate-700 font-semibold">{rep.batch_names.join(', ')}</strong></span>
                            <span>•</span>
                            <span>Duration: <strong className="text-slate-700 font-mono">{rep.duration_minutes}m</strong></span>
                            <span>•</span>
                            <span>Max Marks: <strong className="text-slate-700 font-mono">{rep.max_marks}</strong></span>
                            {hasDeadline && (
                              <>
                                <span>•</span>
                                <span className={isDeadlinePassed ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                                  Deadline: {new Date(rep.deadline!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  {isDeadlinePassed ? ' (Elapsed)' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Metric Badges */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap lg:flex-nowrap shrink-0">
                          <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-center min-w-[70px]">
                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Enrolled</span>
                            <span className="text-sm font-black text-slate-800 font-mono">{rep.total_eligible}</span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center min-w-[70px]">
                            <span className="text-[9px] font-bold uppercase text-emerald-700 block">Passed</span>
                            <span className="text-sm font-black text-emerald-800 font-mono">{rep.passed_count}</span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-center min-w-[70px]">
                            <span className="text-[9px] font-bold uppercase text-rose-700 block">Failed</span>
                            <span className="text-sm font-black text-rose-800 font-mono">
                              {rep.failed_count}
                            </span>
                            {rep.absent_count > 0 && (
                              <span className="text-[8px] text-rose-600 font-semibold block">
                                ({rep.absent_count} absent)
                              </span>
                            )}
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-center min-w-[70px]">
                            <span className="text-[9px] font-bold uppercase text-indigo-700 block">Pass Rate</span>
                            <span className="text-sm font-black text-indigo-800 font-mono">{rep.pass_rate}%</span>
                          </div>

                          <div className="flex items-center gap-1.5 pl-2">
                            <button
                              onClick={() => router.push(`/admin/exams/${rep.exam_id}/analytics`)}
                              className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Open Full Analytics & Ranks"
                            >
                              <ExternalLink size={16} />
                            </button>
                            <button
                              onClick={() => setExpandedExamId(isExpanded ? null : rep.exam_id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                isExpanded
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {isExpanded ? (
                                <>Hide Roster <ChevronUp size={14} /></>
                              ) : (
                                <>View Students ({rep.students.length}) <ChevronDown size={14} /></>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Student Pass/Fail Table */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 animate-in fade-in space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-indigo-600" /> Student Examination Audit Ledger ({rep.students.length} Total Cohort Students)
                            </h5>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 font-medium">
                                Required Pass Score: <strong className="text-emerald-700 font-mono font-bold">{((rep.max_marks * rep.passing_percentage) / 100).toFixed(1)} marks ({rep.passing_percentage}%)</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => openPassEditModal(rep.exam_id, rep.title, rep.passing_percentage, rep.max_marks)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1 cursor-pointer"
                                title="Change passing percentage for this exam"
                              >
                                <Pencil size={10} /> Edit Cutoff %
                              </button>
                            </div>
                          </div>

                          {rep.students.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-xs">
                              No students are currently enrolled in the assigned batches.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                                    <th className="py-2.5 px-3">Student Name</th>
                                    <th className="py-2.5 px-3">Student ID</th>
                                    <th className="py-2.5 px-3">Cohort / Batch</th>
                                    <th className="py-2.5 px-3 text-right">Score</th>
                                    <th className="py-2.5 px-3 text-right">Percentage</th>
                                    <th className="py-2.5 px-3 text-center">Audit Result</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {rep.students.map(stu => {
                                    return (
                                      <tr key={stu.student_id} className="hover:bg-slate-50 transition">
                                        <td className="py-2.5 px-3 font-bold text-slate-900">
                                          {stu.name}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                          {stu.student_id_code || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {stu.batch_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                                          {stu.total_score !== null ? (
                                            <span className={stu.result_status === 'pass' ? 'text-emerald-700' : 'text-rose-700'}>
                                              {stu.total_score} / {rep.max_marks}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                                          {stu.percentage !== null ? (
                                            <span className={stu.result_status === 'pass' ? 'text-emerald-700' : 'text-rose-700'}>
                                              {stu.percentage}%
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 flex justify-center">
                                          {stu.result_status === 'pass' ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                              <CheckCircle2 size={11} /> PASSED
                                            </span>
                                          ) : stu.result_status === 'absent_fail' || stu.is_absent ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1" title="Did not attempt test before deadline">
                                              <AlertCircle size={11} /> FAILED (ABSENT)
                                            </span>
                                          ) : stu.result_status === 'fail' ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                              <XCircle size={11} /> FAILED
                                            </span>
                                          ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1">
                                              <Clock size={11} /> Not Started
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ClayCard>
        );
      })()}

      {/* Quick Edit Passing Percentage Modal */}
      <Modal
        isOpen={editPassModalOpen}
        onClose={() => setEditPassModalOpen(false)}
        title="Adjust Examination Passing Cutoff"
      >
        <form onSubmit={handleSavePassPercentage} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="font-bold text-slate-900 text-sm">{editPassExamTitle}</div>
            <div className="text-slate-500 text-[11px]">
              Total Maximum Marks: <strong className="text-slate-800 font-mono">{editPassMaxMarks} marks</strong>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Target size={14} className="text-emerald-700" /> Passing Percentage & Cutoff Marks
              </label>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                Immediate Re-evaluation
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-full sm:w-44">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Cutoff Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={editPassPercentage}
                    onChange={(e) => setEditPassPercentage(Number(e.target.value))}
                    className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono pr-8 font-bold text-sm bg-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Quick Presets:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[33, 40, 50, 60, 75].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setEditPassPercentage(pct)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        Number(editPassPercentage) === pct
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-emerald-950 text-xs sm:text-sm">
                  Required Pass Score: <span className="font-mono text-emerald-700 text-sm font-extrabold">{((editPassMaxMarks * Number(editPassPercentage || 0)) / 100).toFixed(1)} marks</span> ({editPassPercentage}%)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Calculated from {editPassMaxMarks} maximum marks
                </div>
              </div>
              <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-100 sm:text-right">
                Score ≥ <strong>{((editPassMaxMarks * Number(editPassPercentage || 0)) / 100).toFixed(1)}</strong>: <span className="text-emerald-700 font-bold">PASS</span><br />
                Score &lt; <strong>{((editPassMaxMarks * Number(editPassPercentage || 0)) / 100).toFixed(1)}</strong>: <span className="text-rose-600 font-bold">FAIL</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setEditPassModalOpen(false)}
              disabled={editPassSaving}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary" disabled={editPassSaving}>
              {editPassSaving ? 'Saving...' : 'Update & Re-evaluate Roster'}
            </ClayButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
