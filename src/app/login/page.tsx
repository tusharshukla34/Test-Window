'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, GraduationCap, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';

export default function LoginPage() {
  const router = useRouter();
  const [roleTab, setRoleTab] = useState<'admin' | 'student'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (role: 'admin' | 'student') => {
    setRoleTab(role);
    setError(null);
    setIdentifier('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          expectedRole: roleTab
        })
      });

      let data: Record<string, any> = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Connection interrupted. Please refresh the page and try again.');
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Authentication failed (HTTP ${res.status}). Please try again.`);
      }

      router.push(data.redirectTo || (roleTab === 'admin' ? '/admin/dashboard' : '/student/dashboard'));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background soft pastel ambient blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="w-full max-w-md">
        {/* Portal Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-xs mb-3">
            <Sparkles size={14} className="text-indigo-600" />
            <span className="text-xs font-semibold text-slate-700">Tushar Shukla Academic Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Classroom & Exam System
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Batch homework, live online examinations, and performance tracking
          </p>
        </div>

        {/* Claymorphic Login Card */}
        <ClayCard className="p-6 sm:p-8 backdrop-blur-md bg-white/90 border border-white/80 shadow-2xl">
          {/* Role Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                roleTab === 'admin'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={16} /> Trainer Admin
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('student')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                roleTab === 'student'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap size={16} /> Student Portal
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {roleTab === 'admin' ? 'Trainer ID or Registered Email' : 'Student ID or Registered Email'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={roleTab === 'admin' ? 'Tushar1234 or your email' : 'STU-2026-001'}
                  required
                  className="clay-input w-full pl-9 pr-3 py-2.5 text-sm text-slate-800"
                />
                <div className="absolute left-3 top-3 text-slate-400 pointer-events-none">
                  <Mail size={16} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="clay-input w-full pl-9 pr-3 py-2.5 text-sm text-slate-800"
                />
                <div className="absolute left-3 top-3 text-slate-400 pointer-events-none">
                  <Lock size={16} />
                </div>
              </div>
            </div>

            <ClayButton
              type="submit"
              disabled={loading}
              variant={roleTab === 'admin' ? 'primary' : 'teal'}
              size="lg"
              className="w-full mt-2"
            >
              {loading ? 'Authenticating...' : `Sign In as ${roleTab === 'admin' ? 'Trainer' : 'Student'}`}
              {!loading && <ArrowRight size={16} />}
            </ClayButton>
          </form>
        </ClayCard>
      </div>
    </div>
  );
}
