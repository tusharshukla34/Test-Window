'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  Lightbulb,
  FileQuestion,
  Layers,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  History,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { FeedbackRecord } from '@/lib/db/types';

interface StudentFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export default function StudentFeedbackModal({
  isOpen,
  onClose,
  studentName
}: StudentFeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [category, setCategory] = useState<'bug' | 'dashboard' | 'assignment' | 'exam' | 'suggestion' | 'other'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Past feedbacks
  const [pastFeedbacks, setPastFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // System diagnostic info (auto-captured for debugging)
  const [diagnostics, setDiagnostics] = useState<{ browser: string; os: string; url: string }>({
    browser: '',
    os: '',
    url: ''
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      let browser = 'Browser';
      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edge')) browser = 'Edge';

      let os = 'OS';
      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Mac')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone')) os = 'iOS';

      setDiagnostics({
        browser,
        os,
        url: window.location.pathname
      });
    }
  }, []);

  const fetchPastFeedbacks = () => {
    setLoadingHistory(true);
    fetch('/api/student/feedback')
      .then(res => res.json())
      .then(d => {
        if (d && Array.isArray(d.feedbacks)) {
          setPastFeedbacks(d.feedbacks);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      fetchPastFeedbacks();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError('Please provide a short summary title (at least 3 characters).');
      return;
    }
    if (description.trim().length < 5) {
      setError('Please describe the error or feedback in detail so we can replicate and fix it.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const deviceInfo = `${diagnostics.os} • ${diagnostics.browser} • ${window.innerWidth}x${window.innerHeight}`;
      const pageUrl = window.location.href;

      const res = await fetch('/api/student/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          description: description.trim(),
          device_info: deviceInfo,
          page_url: pageUrl
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSuccessMsg(data.message || 'Report sent successfully to Trainer Tushar!');
      setTitle('');
      setDescription('');
      fetchPastFeedbacks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit report. Please check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { id: 'bug', label: 'Dashboard Bug', icon: Bug, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'exam', label: 'Exam / Test Issue', icon: FileQuestion, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'assignment', label: 'Assignment Issue', icon: Layers, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'suggestion', label: 'Feature Suggestion', icon: Lightbulb, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/70 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Bug size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Student Bug Report & Feedback</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">Direct reporting line to Trainer Tushar Shukla</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 px-6 pt-2">
          <button
            onClick={() => { setActiveTab('submit'); setSuccessMsg(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
              activeTab === 'submit'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send size={13} />
            <span>New Report</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History size={13} />
            <span>My Submitted Reports ({pastFeedbacks.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'submit' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Status Banners */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">{successMsg}</p>
                    <p className="font-normal text-emerald-700 mt-0.5">Trainer Tushar has received a real-time notification with your diagnostics.</p>
                  </div>
                </div>
              )}

              {/* Category Selection Chips */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>What kind of issue are you experiencing?</span>
                  <span className="text-[10px] text-slate-400 font-normal">Select one</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id as typeof category)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/80 text-teal-900 shadow-xs ring-1 ring-teal-500/30'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <Icon size={16} className={isSelected ? 'text-teal-600' : 'text-slate-400'} />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Issue Summary / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Score not updating on refresh, or timer froze"
                  maxLength={100}
                  required
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs"
                />
              </div>

              {/* Detailed Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Description & Steps <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-slate-400">{description.length}/1000</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  required
                  disabled={submitting}
                  placeholder="Tell us what you were doing when the issue happened, what you clicked, or any error message that popped up..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs resize-none"
                />
              </div>

              {/* Auto Diagnostics Capsule */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 font-semibold text-slate-600 truncate">
                  <Smartphone size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">Auto-attached: {diagnostics.os} • {diagnostics.browser}</span>
                </div>
                <span className="inline-flex items-center gap-1 font-bold text-teal-700 shrink-0">
                  <ShieldCheck size={13} /> Verified
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Send to Trainer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-teal-600" />
                  <p className="text-xs text-slate-500 font-semibold">Loading your reports...</p>
                </div>
              ) : pastFeedbacks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Bug size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-600">No previous reports found</p>
                  <p className="text-[11px] mt-1 text-slate-400">Any bug or feedback you submit will appear here with live resolution status.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pastFeedbacks.map(item => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
                          {item.category}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          item.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status === 'resolved' ? 'Resolved' : item.status === 'in_progress' ? 'In Progress' : 'Delivered to Trainer'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 break-words">{item.title}</h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{item.description}</p>
                      {item.admin_note && (
                        <div className="p-2 rounded-xl bg-teal-50 border border-teal-200/70 text-[11px] text-teal-900 font-medium">
                          <strong>Trainer Note:</strong> {item.admin_note}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Submitted: {new Date(item.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
