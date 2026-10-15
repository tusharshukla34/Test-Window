'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Calendar, Clock, CheckCircle, FileText, ArrowRight, Trash2 } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Assignment } from '@/lib/db/types';

export default function AdminAssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<(Assignment & { recipient_batch_names: string[]; submission_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = () => {
    fetch('/api/admin/assignments')
      .then(res => res.json())
      .then(data => {
        setAssignments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleDeleteAssignment = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"? All student submissions will also be removed.`)) {
      return;
    }
    // Optimistic Update: Immediately remove from UI (0ms perceived latency)
    const previous = assignments;
    setAssignments(prev => prev.filter(a => a.id !== id));

    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setAssignments(previous);
        alert('Failed to delete assignment');
      }
    } catch {
      setAssignments(previous);
      alert('Error deleting assignment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-indigo-600" /> Daily Homework Assignments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create and track targeted assignments across your 9:00 AM, 1:00 PM, and 5:00 PM batches.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <ClayButton
            variant="outline"
            onClick={() => router.push('/admin/matrix')}
          >
            Open Monitoring Matrix
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={() => router.push('/admin/assignments/create')}
            className="shadow-md"
          >
            <Plus size={16} /> Create Daily Assignment
          </ClayButton>
        </div>
      </div>

      {/* Assignment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assignments.map(asg => {
          const deadline = new Date(asg.deadline);
          const isOverdue = new Date() > deadline;

          return (
            <ClayCard key={asg.id} className="flex flex-col justify-between hover:border-slate-300">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {asg.subject}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {isOverdue ? 'Deadline Passed' : 'Active'}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {asg.title}
                </h3>

                <p className="text-xs text-slate-600 line-clamp-3">
                  {asg.instructions}
                </p>

                {/* Target Batches */}
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Batches</p>
                  <div className="flex flex-wrap gap-1">
                    {asg.recipient_batch_names.map((bName, i) => (
                      <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {bName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom metadata */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                    <Clock size={13} /> Due: {deadline.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[11px] font-bold text-indigo-700 mt-0.5">
                    {asg.submission_count} submissions received
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => router.push(`/admin/submissions?assignment_id=${asg.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition"
                  >
                    Grade <ArrowRight size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteAssignment(asg.id, asg.title)}
                    title="Delete Assignment"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}
