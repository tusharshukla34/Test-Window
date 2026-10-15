'use client';

import React, { useEffect, useState } from 'react';
import {
  TableProperties,
  Download,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Batch, Assignment, MatrixStudentRow } from '@/lib/db/types';

export default function AssignmentMatrixPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [matrixData, setMatrixData] = useState<{
    assignments: Assignment[];
    rows: MatrixStudentRow[];
    summary: { total_expected: number; submitted: number; evaluated: number; pending: number; overdue: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedBatch ? `/api/admin/matrix?batch_id=${selectedBatch}` : '/api/admin/matrix';
      const [resMatrix, resBatches] = await Promise.all([
        fetch(url),
        fetch('/api/admin/batches')
      ]);

      if (resMatrix.ok) {
        const mData = await resMatrix.json();
        if (mData && !mData.error && mData.summary && Array.isArray(mData.assignments)) {
          setMatrixData(mData);
        } else if (mData?.error) {
          setError(mData.error);
        }
      } else {
        setError('Failed to load matrix data from server.');
      }

      if (resBatches.ok) {
        const bData = await resBatches.json();
        if (Array.isArray(bData)) {
          setBatches(bData);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [selectedBatch]);

  const handleExportCSV = () => {
    const url = selectedBatch ? `/api/admin/matrix?format=csv&batch_id=${selectedBatch}` : '/api/admin/matrix?format=csv';
    window.location.href = url;
  };

  const getStatusBadge = (cell: { status: string; marks?: number | null; max_score?: number }) => {
    switch (cell.status) {
      case 'Not Assigned':
        return <span className="text-[10px] text-slate-300 italic">—</span>;
      case 'Evaluated':
        return (
          <span className="inline-flex flex-col items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
            <span>Evaluated</span>
            <span className="font-mono text-[9px] text-emerald-600">{cell.marks}/{cell.max_score}</span>
          </span>
        );
      case 'Submitted':
        return (
          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-bold text-[10px]">
            Submitted
          </span>
        );
      case 'Late':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
            Late Submitted
          </span>
        );
      case 'Pending':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 font-semibold text-[10px]">
            Pending
          </span>
        );
      case 'Overdue':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
            Overdue
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-500">{cell.status}</span>;
    }
  };

  if (loading && !matrixData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Loading classroom matrix data...</p>
      </div>
    );
  }

  if (error && !matrixData) {
    return (
      <ClayCard className="p-8 text-center max-w-lg mx-auto my-12 space-y-4">
        <AlertCircle size={36} className="text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Failed to Load Monitoring Matrix</h3>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          onClick={fetchMatrix}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
        >
          <RefreshCw size={14} /> Try Again
        </button>
      </ClayCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TableProperties size={24} className="text-indigo-600" /> Assignment Monitoring Matrix
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time classroom grid tracking submission and grading health per student and assignment.
          </p>
        </div>
        <ClayButton
          variant="teal"
          onClick={handleExportCSV}
          className="shadow-sm"
          disabled={!matrixData || matrixData.rows.length === 0}
        >
          <Download size={16} /> Export Matrix to CSV
        </ClayButton>
      </div>

      {/* Summary Cards */}
      {matrixData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <ClayCard className="p-3 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{matrixData.summary.total_expected}</p>
          </ClayCard>
          <ClayCard className="p-3 text-center">
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Submitted</span>
            <p className="text-2xl font-extrabold text-teal-700 mt-0.5">{matrixData.summary.submitted}</p>
          </ClayCard>
          <ClayCard className="p-3 text-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Evaluated</span>
            <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">{matrixData.summary.evaluated}</p>
          </ClayCard>
          <ClayCard className="p-3 text-center">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Pending</span>
            <p className="text-2xl font-extrabold text-blue-700 mt-0.5">{matrixData.summary.pending}</p>
          </ClayCard>
          <ClayCard className="p-3 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Overdue</span>
            <p className="text-2xl font-extrabold text-rose-700 mt-0.5">{matrixData.summary.overdue}</p>
          </ClayCard>
        </div>
      )}

      {/* Batch Filter Bar */}
      <ClayCard className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filter Cohort:</span>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="clay-input p-2 text-xs text-slate-800"
          >
            <option value="">All Batches (Full View)</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Showing {matrixData?.rows?.length || 0} students across {matrixData?.assignments?.length || 0} assignments
        </div>
      </ClayCard>

      {/* Spreadsheet Matrix Table */}
      <ClayCard className="p-0 overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="p-3.5 sticky left-0 bg-slate-100 z-30 min-w-[200px] border-r border-slate-200">
                  Student Name & ID
                </th>
                <th className="p-3.5 min-w-[120px] border-r border-slate-200">
                  Batch
                </th>
                {matrixData?.assignments?.map(asg => (
                  <th key={asg.id} className="p-3.5 min-w-[170px] text-center border-r border-slate-200">
                    <div className="font-extrabold text-slate-900 truncate" title={asg.title}>{asg.title}</div>
                    <div className="text-[9px] font-normal text-slate-500 font-mono">Max {asg.max_score} pts</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!matrixData?.rows || matrixData.rows.length === 0) ? (
                <tr>
                  <td
                    colSpan={(matrixData?.assignments?.length || 0) + 2}
                    className="p-12 text-center text-slate-400 text-xs"
                  >
                    No students or assignments found in this cohort view.
                  </td>
                </tr>
              ) : (
                matrixData.rows.map((row, idx) => (
                  <tr key={row.student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    {/* Sticky Student Column */}
                    <td className="p-3.5 sticky left-0 bg-white font-semibold text-slate-900 border-r border-slate-200 shadow-xs z-10">
                      <div>{row.student.name}</div>
                      <div className="text-[10px] font-mono text-indigo-600 font-bold">{row.student.student_id}</div>
                    </td>
                    <td className="p-3.5 text-slate-600 text-[11px] border-r border-slate-200">
                      {row.batch_names.join(', ')}
                    </td>
                    {matrixData.assignments.map(asg => {
                      const cell = row.assignments?.[asg.id] || { status: 'Not Assigned' };
                      return (
                        <td key={asg.id} className="p-3.5 text-center border-r border-slate-100">
                          {getStatusBadge(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
