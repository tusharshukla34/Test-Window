'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  Download,
  ArrowLeft,
  Trophy,
  Users,
  Clock,
  Target,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Exam, ExamAttempt } from '@/lib/db/types';

interface ExamAnalyticsData {
  exam: Exam;
  attempts: (ExamAttempt & { student_name: string; student_id_code: string; batch_name: string })[];
  stats: {
    total_students_eligible: number;
    total_attempted: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    average_time_seconds: number;
  };
  question_stats: {
    question_id: string;
    order: number;
    topic: string;
    correct_pct: number;
    attempted_count: number;
  }[];
}

export default function ExamAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;
  const [data, setData] = useState<ExamAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/exams/${examId}/analytics`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [examId]);

  const handleExportCSV = () => {
    window.location.href = `/api/admin/exams/${examId}/analytics?format=csv`;
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { exam, attempts, stats, question_stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white text-slate-600 hover:text-slate-900 shadow-xs border border-slate-200 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Examination Performance Analytics
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {exam.title}
            </h1>
          </div>
        </div>

        <ClayButton
          variant="teal"
          onClick={handleExportCSV}
          className="shadow-sm"
        >
          <Download size={16} /> Export Rank List to CSV
        </ClayButton>
      </div>

      {/* Analytics Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <ClayCard className="p-3.5 text-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Eligible Students</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total_students_eligible}</p>
        </ClayCard>
        <ClayCard className="p-3.5 text-center">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Attempts Completed</span>
          <p className="text-2xl font-black text-indigo-700 mt-1">{stats.total_attempted}</p>
        </ClayCard>
        <ClayCard className="p-3.5 text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Average Score</span>
          <p className="text-2xl font-black text-teal-800 mt-1">{stats.average_score} <span className="text-xs text-slate-400">/ {exam.max_marks}</span></p>
        </ClayCard>
        <ClayCard className="p-3.5 text-center">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Highest Score</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.highest_score} <span className="text-xs text-slate-400">/ {exam.max_marks}</span></p>
        </ClayCard>
        <ClayCard className="p-3.5 text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Avg Time Spent</span>
          <p className="text-2xl font-black text-amber-800 mt-1">{Math.floor(stats.average_time_seconds / 60)}m {stats.average_time_seconds % 60}s</p>
        </ClayCard>
      </div>

      {/* Main Split: Rank List & Question Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rank List Table (2 cols) */}
        <ClayCard className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" /> Authorized Rank List
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              Ranked by Score then Time Taken
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 text-center">Rank</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3 text-center">Final Score</th>
                  <th className="p-3 text-center">Accuracy</th>
                  <th className="p-3 text-right">Time Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No student has completed this examination yet.
                    </td>
                  </tr>
                ) : (
                  attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 text-center font-bold">
                        {att.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs">
                            🥇
                          </span>
                        ) : att.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-extrabold text-xs">
                            🥈
                          </span>
                        ) : att.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 font-extrabold text-xs">
                            🥉
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600 font-bold">#{att.rank}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{att.student_name}</div>
                        <div className="text-[11px] font-mono text-indigo-600">{att.student_id_code}</div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {att.batch_name}
                      </td>
                      <td className="p-3 text-center font-mono font-extrabold text-emerald-700 text-sm">
                        {att.total_score !== null ? `${att.total_score} / ${exam.max_marks}` : 'In Progress'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-100">
                          {att.accuracy !== null ? `${att.accuracy}%` : '-'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-500 font-mono text-[11px]">
                        {Math.floor(att.time_spent_seconds / 60)}m {att.time_spent_seconds % 60}s
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ClayCard>

        {/* Question Correctness Rate (1 col) */}
        <ClayCard className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-600" /> Question Correctness
            </h3>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {question_stats.map((qs) => (
              <div key={qs.question_id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Q{qs.order}. {qs.topic}</span>
                  <span className={`font-mono font-extrabold text-xs ${
                    qs.correct_pct >= 70 ? 'text-emerald-600' : qs.correct_pct >= 40 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {qs.correct_pct}% Correct
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      qs.correct_pct >= 70 ? 'bg-emerald-500' : qs.correct_pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${qs.correct_pct}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-400">
                  {qs.attempted_count} students answered this question
                </p>
              </div>
            ))}
          </div>
        </ClayCard>
      </div>
    </div>
  );
}
