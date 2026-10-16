'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Download,
  Send,
  MessageSquare,
  Lock,
  Award,
  Eye
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import FormattedInstructions from '@/components/ui/FormattedInstructions';
import { Assignment, AssignmentSubmission } from '@/lib/db/types';

let cachedStudentAssignments: (Assignment & { submission?: AssignmentSubmission | null; batch_names?: string[] })[] | null = null;

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<(Assignment & { submission?: AssignmentSubmission | null; batch_names?: string[] })[]>(cachedStudentAssignments || []);
  const [selectedAsg, setSelectedAsg] = useState<(Assignment & { submission?: AssignmentSubmission | null; batch_names?: string[] }) | null>(null);
  const [loading, setLoading] = useState(!cachedStudentAssignments);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

  // Submission Form State
  const [textResponse, setTextResponse] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{ title: string; maxScore: number } | null>(null);

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`/api/student/assignments?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAssignments(data);
        cachedStudentAssignments = data;
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleOpenSubmission = (asg: Assignment & { submission?: AssignmentSubmission | null }) => {
    setSelectedAsg(asg);
    setTextResponse(asg.submission?.text_response || '');
    setSelectedFile(null);
    setSubmitSuccess(false);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsg) return;

    if (selectedAsg.submission?.status === 'evaluated') {
      setError('This assignment has already been evaluated and graded by Trainer Shukla. Resubmission is closed.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let fileUrl = selectedAsg.submission?.file_url || null;
      let fileName = selectedAsg.submission?.file_name || null;
      let fileSize = selectedAsg.submission?.file_size || null;
      let fileMime = selectedAsg.submission?.file_mime || null;

      // Upload file if new file chosen
      if (selectedFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'File upload failed');
        }

        fileUrl = uploadData.file_url;
        fileName = uploadData.file_name;
        fileSize = uploadData.file_size;
        fileMime = uploadData.file_mime;
        setUploading(false);
      }

      const submitRes = await fetch(`/api/student/assignments/${selectedAsg.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_response: textResponse,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_mime: fileMime
        })
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData.error || 'Submission failed');
      }

      const submittedTitle = selectedAsg.title;
      const submittedMaxScore = selectedAsg.max_score;
      const submittedAsgId = selectedAsg.id;

      // 1. Immediately close the assignment submission window
      setSelectedAsg(null);
      setTextResponse('');
      setSelectedFile(null);
      setSubmitSuccess(false);

      // 2. Open the dedicated small success confirmation pop-up
      setSuccessModalData({
        title: submittedTitle,
        maxScore: submittedMaxScore
      });

      // 3. Optimistic update in assignments list
      if (submitData.submission) {
        setAssignments(prev => {
          const updated = prev.map(a => {
            if (a.id === submittedAsgId) {
              return {
                ...a,
                submission: submitData.submission
              };
            }
            return a;
          });
          cachedStudentAssignments = updated;
          return updated;
        });
      }

      fetchAssignments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting homework');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const allBatchNames = Array.from(new Set(assignments.flatMap(a => a.batch_names || []))).filter(Boolean);
  const filteredAssignments = selectedBatchFilter === 'all'
    ? assignments
    : assignments.filter(a => a.batch_names?.includes(selectedBatchFilter));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-teal-600 shrink-0" /> Daily Homework Assignments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete daily tasks assigned to your batch, upload working files, and view trainer feedback.
          </p>
        </div>

        {/* Batch Filter Buttons if enrolled in multiple batches */}
        {allBatchNames.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedBatchFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedBatchFilter === 'all'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Cohorts ({assignments.length})
            </button>
            {allBatchNames.map(bName => (
              <button
                key={bName}
                onClick={() => setSelectedBatchFilter(bName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedBatchFilter === bName
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {bName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Assignments */}
      {filteredAssignments.length === 0 ? (
        <ClayCard className="text-center py-12">
          <BookOpen className="mx-auto text-slate-300 mb-2" size={36} />
          <p className="text-sm font-bold text-slate-700">No Assignments Available</p>
          <p className="text-xs text-slate-500 mt-1">There are no homework tasks assigned for this batch at this time.</p>
        </ClayCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssignments.map(asg => {
            const deadline = new Date(asg.deadline);
            const isOverdue = new Date() > deadline && !asg.submission;
            const sub = asg.submission;

            let statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Pending
              </span>
            );

            if (sub) {
              if (sub.status === 'evaluated') {
                statusBadge = (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Evaluated ({sub.marks_awarded}/{asg.max_score} pts)
                  </span>
                );
              } else if (sub.is_late) {
                statusBadge = (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Late Submitted
                  </span>
                );
              } else {
                statusBadge = (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    Under Review
                  </span>
                );
              }
            } else if (isOverdue) {
              statusBadge = (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  Overdue
                </span>
              );
            }

            return (
              <ClayCard key={asg.id} className="flex flex-col justify-between hover:border-slate-300">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {asg.subject}
                      </span>
                      {asg.batch_names && asg.batch_names.length > 0 && asg.batch_names.map((bName, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                          {bName}
                        </span>
                      ))}
                    </div>
                    {statusBadge}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 leading-snug break-words">
                  {asg.title}
                </h3>

                <div className="pt-0.5">
                  <FormattedInstructions compact content={asg.instructions} />
                </div>

                {/* Evaluated Marks & Trainer Feedback Callout */}
                {sub && sub.status === 'evaluated' && sub.feedback && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <MessageSquare size={14} className="shrink-0" /> Trainer Feedback:
                    </p>
                    <p className="text-[11px] text-emerald-800 break-words">{sub.feedback}</p>
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div>
                  <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                    <Clock size={13} className="shrink-0" /> Due: {deadline.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Max Score: {asg.max_score} pts</div>
                </div>

                <ClayButton
                  variant={sub?.status === 'evaluated' ? 'outline' : 'teal'}
                  size="sm"
                  onClick={() => handleOpenSubmission(asg)}
                  className="w-full sm:w-auto"
                >
                  {sub?.status === 'evaluated' ? (
                    <span className="flex items-center gap-1.5">
                      <Eye size={13} className="text-teal-700" /> View Graded Work
                    </span>
                  ) : sub ? (
                    <span className="flex items-center gap-1.5">
                      <FileText size={13} /> View / Edit Submission
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Upload size={13} /> Submit Work
                    </span>
                  )}
                </ClayButton>
              </div>
            </ClayCard>
          );
        })}
        </div>
      )}

      {/* Submission Modal */}
      <Modal
        isOpen={Boolean(selectedAsg)}
        onClose={() => setSelectedAsg(null)}
        title={
          selectedAsg?.submission?.status === 'evaluated'
            ? `Graded Task: ${selectedAsg?.title || ''}`
            : (selectedAsg?.title || 'Assignment Task')
        }
        maxWidth="max-w-2xl"
      >
        {selectedAsg && (() => {
          const isEvaluated = selectedAsg.submission?.status === 'evaluated';

          return (
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} /> Homework submitted successfully! Your submission is now in Trainer Shukla&apos;s evaluation queue.
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Evaluated Callout Banner */}
              {isEvaluated && selectedAsg.submission && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-inner">
                        <Award size={20} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-emerald-950 text-xs">Evaluated by Trainer Shukla</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-800">
                            Finalized
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                          This task has been graded. Submissions are permanently locked.
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black px-3.5 py-1 rounded-full bg-emerald-600 text-white shadow-xs inline-block">
                        Score: {selectedAsg.submission.marks_awarded} / {selectedAsg.max_score} pts
                      </span>
                    </div>
                  </div>

                  {selectedAsg.submission.feedback && (
                    <div className="text-xs bg-white/95 rounded-xl p-3 border border-emerald-200/80 shadow-2xs">
                      <p className="font-bold text-emerald-900 text-[11px] mb-1 flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-emerald-700" /> Trainer Feedback:
                      </p>
                      <p className="text-slate-700 leading-relaxed break-words">{selectedAsg.submission.feedback}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Complete Instructions & Question Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Instructions & Problem Statements</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {isEvaluated ? 'Reference Questions' : 'Review tasks before submitting'}
                  </span>
                </label>
                <FormattedInstructions content={selectedAsg.instructions} />
              </div>

              {/* Text Response */}
              {(selectedAsg.submission_type === 'text_response' || selectedAsg.submission_type === 'both') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{isEvaluated ? 'Your Submitted Response' : 'Written Response / Explanation'}</span>
                    {isEvaluated && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                        <Lock size={11} /> Locked (Evaluated)
                      </span>
                    )}
                  </label>
                  {isEvaluated ? (
                    selectedAsg.submission?.text_response ? (
                      <div className="p-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                        {selectedAsg.submission.text_response}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No written response was submitted.
                      </div>
                    )
                  ) : (
                    <textarea
                      rows={4}
                      placeholder="Type your answer, derivations, numerical calculations, or comments here..."
                      value={textResponse}
                      onChange={(e) => setTextResponse(e.target.value)}
                      className="clay-input w-full p-2.5 text-xs text-slate-800"
                    />
                  )}
                </div>
              )}

              {/* File Deliverable */}
              {(selectedAsg.submission_type === 'file_upload' || selectedAsg.submission_type === 'both') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{isEvaluated ? 'Your Submitted Deliverable File' : 'Upload Deliverable File'}</span>
                    {isEvaluated && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                        <Lock size={11} /> Locked (Evaluated)
                      </span>
                    )}
                  </label>

                  {isEvaluated ? (
                    selectedAsg.submission?.file_url ? (
                      <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={18} className="text-teal-700 shrink-0" />
                          <div className="truncate">
                            <p className="font-bold text-teal-950 truncate">{selectedAsg.submission.file_name || 'Deliverable File'}</p>
                            {selectedAsg.submission.file_size ? (
                              <p className="text-[10px] text-teal-700">{(selectedAsg.submission.file_size / (1024 * 1024)).toFixed(2)} MB</p>
                            ) : null}
                          </div>
                        </div>
                        <a
                          href={selectedAsg.submission.file_url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0 transition"
                        >
                          <Download size={13} /> Download File
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No deliverable file was submitted.
                      </div>
                    )
                  ) : (
                    <>
                      <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center hover:bg-slate-100/60 transition cursor-pointer relative">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                          <Upload size={22} className="text-teal-600" />
                          <p className="text-xs font-bold text-slate-800">
                            {selectedFile ? selectedFile.name : 'Click to select or drag and drop your file here'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Allowed formats: {selectedAsg.allowed_formats.join(', ')} (Max {selectedAsg.max_file_size_mb} MB)
                          </p>
                        </div>
                      </div>

                      {/* Existing uploaded file info */}
                      {selectedAsg.submission?.file_url && !selectedFile && (
                        <div className="mt-2 p-2.5 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-teal-700" />
                            <span className="font-semibold text-teal-900">{selectedAsg.submission.file_name}</span>
                          </div>
                          <a
                            href={selectedAsg.submission.file_url}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1"
                          >
                            <Download size={13} /> Download
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {isEvaluated ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock size={14} className="text-slate-400 shrink-0" />
                    <span>This assignment has been evaluated. Re-submissions are closed.</span>
                  </div>
                  <ClayButton
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedAsg(null)}
                    className="w-full sm:w-auto"
                  >
                    Close
                  </ClayButton>
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <ClayButton
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedAsg(null)}
                  >
                    Close
                  </ClayButton>
                  <ClayButton
                    type="submit"
                    variant="teal"
                    disabled={submitting || uploading}
                  >
                    <Send size={15} /> {submitting || uploading ? 'Submitting...' : selectedAsg.submission ? 'Update Submission' : 'Confirm Submission'}
                  </ClayButton>
                </div>
              )}
            </form>
          );
        })()}
      </Modal>

      {/* Small Success Confirmation Pop-up Modal */}
      <Modal
        isOpen={Boolean(successModalData)}
        onClose={() => setSuccessModalData(null)}
        title="Submission Received"
        maxWidth="max-w-md"
      >
        <div className="text-center py-4 px-2 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
            <CheckCircle2 size={36} className="stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Homework Submitted Successfully!
            </h3>
            {successModalData && (
              <p className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-full inline-block">
                {successModalData.title}
              </p>
            )}
            <p className="text-xs text-slate-500 max-w-sm mx-auto pt-1 leading-relaxed">
              Your solution has been submitted and is now in <strong className="text-slate-700">Trainer Shukla&apos;s</strong> evaluation queue.
            </p>
          </div>

          <div className="pt-2">
            <ClayButton
              variant="teal"
              size="md"
              onClick={() => setSuccessModalData(null)}
              className="w-full justify-center shadow-md font-bold text-xs"
            >
              OK, Got It!
            </ClayButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
