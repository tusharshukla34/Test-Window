'use client';

import React, { useEffect, useState } from 'react';
import { Users, Plus, Search, UserPlus, Trash2, ArrowRight } from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { Batch, UserProfile } from '@/lib/db/types';

export default function BatchesPage() {
  const [batches, setBatches] = useState<(Batch & { student_count: number })[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<(Batch & { students: UserProfile[] }) | null>(null);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  // New batch form
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDesc, setNewBatchDesc] = useState('');

  // Add student form
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/admin/batches');
      const data = await res.json();
      setBatches(data);
      if (data.length > 0 && !selectedBatch) {
        fetchBatchDetails(data[0].id);
      }
    } catch {}
    setLoading(false);
  };

  const fetchBatchDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/batches/${id}`);
      const data = await res.json();
      setSelectedBatch(data);
    } catch {}
  };

  const fetchAllStudents = async () => {
    try {
      const res = await fetch('/api/admin/students');
      const data = await res.json();
      setAllStudents(data);
    } catch {}
  };

  useEffect(() => {
    fetchBatches();
    fetchAllStudents();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    try {
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBatchName, description: newBatchDesc })
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setNewBatchName('');
        setNewBatchDesc('');
        fetchBatches();
      }
    } catch {}
  };

  const handleAddStudentToBatch = async () => {
    if (!selectedBatch || !selectedStudentId) return;

    try {
      const res = await fetch(`/api/admin/batches/${selectedBatch.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedStudentId })
      });
      if (res.ok) {
        setIsAddStudentOpen(false);
        setSelectedStudentId('');
        fetchBatchDetails(selectedBatch.id);
        fetchBatches();
      }
    } catch {}
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedBatch) return;
    if (!confirm('Are you sure you want to remove this student from the batch?')) return;

    try {
      const res = await fetch(`/api/admin/batches/${selectedBatch.id}/students?student_id=${studentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchBatchDetails(selectedBatch.id);
        fetchBatches();
      }
    } catch {}
  };

  const filteredStudents = selectedBatch?.students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.student_id && s.student_id.toLowerCase().includes(studentSearch.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users size={24} className="text-indigo-600" /> Batch Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organize students into 9:00 AM, 1:00 PM, or 5:00 PM cohorts for targeted homework and exams.
          </p>
        </div>
        <ClayButton
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          className="shadow-md"
        >
          <Plus size={16} /> Create New Batch
        </ClayButton>
      </div>

      {/* Main Grid: Batches on left, Selected Batch Roster on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batches List */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Active Classroom Batches ({batches.length})
          </p>
          {batches.map(batch => (
            <ClayCard
              key={batch.id}
              interactive
              onClick={() => fetchBatchDetails(batch.id)}
              className={`cursor-pointer transition-all ${
                selectedBatch?.id === batch.id
                  ? 'border-2 border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/40'
                  : 'hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{batch.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{batch.description || 'No description'}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                    {batch.student_count} students
                  </span>
                </div>
              </div>
            </ClayCard>
          ))}
        </div>

        {/* Selected Batch Roster */}
        <div className="lg:col-span-2">
          {selectedBatch ? (
            <ClayCard className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900">{selectedBatch.name}</h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {selectedBatch.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{selectedBatch.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <ClayButton
                    variant="teal"
                    size="sm"
                    onClick={() => setIsAddStudentOpen(true)}
                  >
                    <UserPlus size={15} /> Add Student to Batch
                  </ClayButton>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter students in this batch..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="clay-input w-full pl-9 pr-3 py-2 text-xs"
                />
                <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                  <Search size={14} />
                </div>
              </div>

              {/* Students Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Full Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          No students in this batch yet. Click "Add Student to Batch" above.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-mono font-bold text-indigo-700">{student.student_id}</td>
                          <td className="p-3 font-medium text-slate-900">{student.name}</td>
                          <td className="p-3 text-slate-500">{student.email}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {student.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRemoveStudent(student.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                              title="Remove from batch"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ClayCard>
          ) : (
            <ClayCard className="p-12 text-center text-slate-400 text-sm">
              Select a batch on the left to view enrolled students.
            </ClayCard>
          )}
        </div>
      </div>

      {/* Create Batch Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Classroom Batch"
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Batch Name (e.g. 9:00 AM, 1:00 PM, or 5:00 PM)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 9:00 AM Batch"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Batch Description / Schedule
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Morning Core Thermodynamics and Numerical Series"
              value={newBatchDesc}
              onChange={(e) => setNewBatchDesc(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              Save Batch
            </ClayButton>
          </div>
        </form>
      </Modal>

      {/* Add Student to Batch Modal */}
      <Modal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        title={`Enroll Student into ${selectedBatch?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select a registered student to add to this cohort. Enrolled students will immediately gain access to assignments and examinations targeted at this batch.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Student
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800"
            >
              <option value="">-- Choose a student --</option>
              {allStudents
                .filter(s => !selectedBatch?.students.some(bs => bs.id === s.id))
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.student_id}) - {s.email}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsAddStudentOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton
              type="button"
              variant="teal"
              disabled={!selectedStudentId}
              onClick={handleAddStudentToBatch}
            >
              Confirm Enrollment
            </ClayButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
