'use client';

import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Mail,
  UserCheck,
  Trash2
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { UserProfile, Batch } from '@/lib/db/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<(UserProfile & { batches: string[] })[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Student Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [phone, setPhone] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset Password Form
  const [newPassword, setNewPassword] = useState('Password@123');
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resStu, resBatches] = await Promise.all([
        fetch('/api/admin/students'),
        fetch('/api/admin/batches')
      ]);
      const stuData = await resStu.json();
      const batchData = await resBatches.json();
      setStudents(stuData);
      setBatches(batchData);
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          student_id: studentId,
          password,
          phone,
          batch_ids: selectedBatchIds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create student');

      setIsAddOpen(false);
      setName('');
      setEmail('');
      setStudentId('');
      setPhone('');
      setSelectedBatchIds([]);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating student');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setResetMsg(null);

    try {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setResetMsg('Password updated successfully!');
      setTimeout(() => {
        setIsResetOpen(false);
        setResetMsg(null);
      }, 1500);
    } catch (err: unknown) {
      setResetMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleToggleStatus = async (student: UserProfile) => {
    const newStatus = student.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`Are you sure you want to mark ${student.name} as ${newStatus}?`)) return;

    try {
      await fetch(`/api/admin/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch {}
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/students/${studentToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setStudentToDelete(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete student');
      }
    } catch {
      alert('Error connecting to server. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.student_id && s.student_id.toLowerCase().includes(search.toLowerCase())) ||
    s.batches.some(b => b.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap size={24} className="text-indigo-600" /> Student Account Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administer authenticated student accounts, batch allocations, and secure credentials.
          </p>
        </div>
        <ClayButton
          variant="primary"
          onClick={() => {
            const nextCode = `STU-2026-00${students.length + 1}`;
            setStudentId(nextCode);
            setIsAddOpen(true);
          }}
          className="shadow-md"
        >
          <Plus size={16} /> Enroll New Student
        </ClayButton>
      </div>

      {/* Roster Card */}
      <ClayCard className="space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search students by name, unique student ID, or batch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pl-9 pr-3 py-2 text-xs"
          />
          <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
            <Search size={14} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3">Student ID</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Email Contact</th>
                <th className="p-3">Batch Memberships</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No matching students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3 font-mono font-bold text-indigo-700">{student.student_id}</td>
                    <td className="p-3 font-semibold text-slate-900">{student.name}</td>
                    <td className="p-3 text-slate-500">{student.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {student.batches.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">No batch</span>
                        ) : (
                          student.batches.map((bName, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {bName}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        student.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsResetOpen(true);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                          title="Reset Password"
                        >
                          <KeyRound size={13} className="inline mr-1" /> Reset
                        </button>
                        <button
                          onClick={() => handleToggleStatus(student)}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition ${
                            student.status === 'active'
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {student.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setStudentToDelete(student)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition inline-flex items-center gap-1"
                          title="Permanently Delete Student Account"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>

      {/* Enroll Student Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Enroll New Student Account"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vikram Singh"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unique Student ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. STU-2026-006"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="vikram@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Temporary Password
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assign to Initial Batch(es)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {batches.map(b => (
                <label key={b.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(b.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBatchIds([...selectedBatchIds, b.id]);
                      } else {
                        setSelectedBatchIds(selectedBatchIds.filter(id => id !== b.id));
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{b.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              Enroll Student
            </ClayButton>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Reset Password for ${selectedStudent?.name}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-500">
            Set a new secure password for student <strong>{selectedStudent?.name}</strong> ({selectedStudent?.student_id}).
          </p>

          {resetMsg && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
              {resetMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <input
              type="text"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="clay-input w-full p-2.5 text-xs text-slate-800 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => setIsResetOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              Update Password
            </ClayButton>
          </div>
        </form>
      </Modal>

      {/* Delete Student Confirmation Modal */}
      <Modal
        isOpen={Boolean(studentToDelete)}
        onClose={() => !isDeleting && setStudentToDelete(null)}
        title="Permanently Delete Student Account"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <p className="font-semibold text-rose-900 mb-1 text-sm">
              Permanently delete student <span className="underline font-bold">"{studentToDelete?.name}"</span>?
            </p>
            <div className="mt-2.5 space-y-1 font-mono text-[11px] bg-white/80 p-2.5 rounded-lg border border-rose-200/70">
              <p><span className="text-slate-500 font-sans">Student ID:</span> <span className="font-bold text-indigo-700">{studentToDelete?.student_id}</span></p>
              <p><span className="text-slate-500 font-sans">Email:</span> <span className="font-bold text-slate-800">{studentToDelete?.email}</span></p>
            </div>
            <p className="text-rose-700 leading-relaxed mt-2.5">
              This action will completely remove this student record, unenroll them from all batches, and delete their exam attempts and assignment submissions. <strong>This action cannot be undone.</strong>
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setStudentToDelete(null)}
            >
              Cancel
            </ClayButton>
            <ClayButton
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={handleDeleteStudent}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Permanently Delete'}
            </ClayButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
