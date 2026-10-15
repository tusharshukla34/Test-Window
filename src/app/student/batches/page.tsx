'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  BookOpen,
  FileCheck2,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { StudentBatchBreakdown } from '@/lib/db/types';

interface BatchesPageData {
  student: {
    id: string;
    student_id: string;
    name: string;
  };
  batches: { id: string; name: string; description?: string | null }[];
  batch_breakdowns: StudentBatchBreakdown[];
}

let cachedBatchesData: BatchesPageData | null = null;

export default function StudentBatchesPage() {
  const router = useRouter();
  const [data, setData] = useState<BatchesPageData | null>(cachedBatchesData);
  const [loading, setLoading] = useState(!cachedBatchesData);
  const [selectedBatchTab, setSelectedBatchTab] = useState<string>('all');

  useEffect(() => {
    fetch('/api/student/batches')
      .then(res => res.json())
      .then(d => {
        if (d && !d.error) {
          setData(d);
          cachedBatchesData = d;
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

  const breakdowns = data?.batch_breakdowns || [];
  const displayedBatches = selectedBatchTab === 'all'
    ? breakdowns
    : breakdowns.filter(b => b.batch_id === selectedBatchTab);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-teal-700 font-bold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200">
              Cohorts & Batches
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {breakdowns.length} {breakdowns.length === 1 ? 'Batch Enrolled' : 'Batches Enrolled'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers size={24} className="text-teal-600" />
            My Enrolled Batches
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Clear status of pending homework, submitted tasks, and examinations for each specific batch.
          </p>
        </div>

        {/* Batch Tab Switcher */}
        {breakdowns.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none self-start sm:self-auto shrink-0">
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

      {/* Zero State if student is not assigned to any batches */}
      {breakdowns.length === 0 ? (
        <ClayCard className="py-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
            <GraduationCap size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Batches Assigned Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Your trainer has not enrolled you into any cohort batch yet. Once enrolled, your homework, test schedules, and cohort analytics will appear here.
          </p>
          <div className="pt-2">
            <ClayButton
              variant="teal"
              size="sm"
              onClick={() => router.push('/student/dashboard')}
            >
              Back to Dashboard
            </ClayButton>
          </div>
        </ClayCard>
      ) : (
        /* Batches List */
        <div className="space-y-6">
          {displayedBatches.map(batch => {
            const totalTasks = batch.total_assignments;
            const completedOrEvaluated = batch.submitted_assignments + batch.evaluated_assignments;
            const completionPercent = totalTasks > 0
              ? Math.round((completedOrEvaluated / totalTasks) * 100)
              : 100;

            return (
              <div
                key={batch.batch_id}
                className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-5 transition hover:border-teal-200"
              >
                {/* Cohort Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100/80 shadow-xs">
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                          {batch.batch_name}
                        </h3>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          Cohort ID: {batch.batch_id}
                        </span>
                      </div>
                      {batch.batch_description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {batch.batch_description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Batch Progress Bar */}
                  <div className="sm:text-right shrink-0 min-w-[150px]">
                    <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-bold text-slate-700 mb-1">
                      <span className="text-slate-400 font-medium text-[11px]">Submission Rate</span>
                      <span className="text-teal-700">{completionPercent}% Complete</span>
                    </div>
                    <div className="w-full sm:w-36 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${completionPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* 4 Mini Stat Badges for this Batch */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <p className="text-[10px] text-blue-700 mt-0.5 font-medium">Awaiting review</p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Evaluated</span>
                      <Sparkles size={15} />
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
                      {batch.assignments.map(asg => {
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
  );
}
