'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Save,
  Send,
  ShieldCheck,
  Clock,
  History,
  FileText,
  Sparkles,
  HelpCircle,
  CheckSquare,
  Award,
  Code2,
  Download,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Exam, ExamAttempt, UserProfile, Batch, QuestionOption } from '@/lib/db/types';

interface EvaluationQuestionItem {
  id: string;
  question_order: number;
  subject: string;
  topic: string;
  question_type?: 'mcq' | 'coding' | 'written' | 'file_upload';
  coding_language?: 'c' | 'cpp' | 'java' | 'python' | 'javascript';
  code_template?: string | null;
  allowed_file_types?: string | null;
  max_file_size_mb?: number | null;
  question_text: string;
  question_image_url?: string | null;
  options: QuestionOption[];
  correct_option_id?: string;
  explanation?: string | null;
  marks: number;
  negative_penalty: number;
  selected_option_id: string | null;
  descriptive_answer?: string | null;
  submitted_file_url?: string | null;
  submitted_file_name?: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  suggested_score: number | null;
  is_correct: boolean | null;
  manual_marks: number;
  teacher_remarks: string | null;
}

export default function AdminAttemptEvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestionItem[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<any[]>([]);
  const [showProctoringLog, setShowProctoringLog] = useState(false);

  // Form State
  const [manualMarks, setManualMarks] = useState<Record<string, number>>({});
  const [teacherRemarks, setTeacherRemarks] = useState<Record<string, string>>({});
  const [trainerFeedback, setTrainerFeedback] = useState<string>('');
  const [auditReason, setAuditReason] = useState<string>('');

  // Republish modal
  const [republishModalOpen, setRepublishModalOpen] = useState(false);

  const fetchAttempt = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/exams/evaluations/${attemptId}`);
      const data = await res.json();

      if (data) {
        setAttempt(data.attempt);
        setStudent(data.student);
        setBatch(data.batch);
        setExam(data.exam);
        setQuestions(data.questions || []);
        setEvaluationHistory(data.evaluation_history || []);
        setTrainerFeedback(data.attempt?.trainer_feedback || '');

        // Initialize form values from current question data
        const initialMarks: Record<string, number> = {};
        const initialRemarks: Record<string, string> = {};

        (data.questions || []).forEach((q: EvaluationQuestionItem) => {
          initialMarks[q.id] = q.manual_marks !== undefined ? q.manual_marks : (q.suggested_score ?? 0);
          initialRemarks[q.id] = q.teacher_remarks || '';
        });

        setManualMarks(initialMarks);
        setTeacherRemarks(initialRemarks);
      }
    } catch (err) {
      console.error('Failed to load attempt evaluation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempt();
  }, [attemptId]);

  // Compute live total score
  const computedTotalScore = Object.values(manualMarks).reduce((acc, m) => acc + (Number(m) || 0), 0);
  const formattedScore = Math.max(0, Number(computedTotalScore.toFixed(2)));

  // Save as Draft or Mark Evaluated
  const handleSaveEvaluation = async (status: 'in_progress' | 'evaluated') => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/exams/evaluations/${attemptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          manual_marks: manualMarks,
          teacher_remarks: teacherRemarks,
          trainer_feedback: trainerFeedback,
          audit_reason: auditReason || `Trainer saved evaluation as ${status}`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save evaluation');

      alert(`Evaluation successfully saved as "${status === 'evaluated' ? 'Evaluated (Ready for Publishing)' : 'Draft (In Progress)'}"!`);
      setAuditReason('');
      fetchAttempt();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error saving evaluation');
    } finally {
      setSaving(false);
    }
  };

  // Publish Directly from Answer Sheet
  const handleDirectPublish = async () => {
    if (!exam || !attempt) return;
    const confirmPublish = window.confirm(
      `Are you sure you want to officially publish results for ${student?.name}?\n\nScore: ${formattedScore} / ${exam.max_marks}\n\nThe student will immediately be able to view their verified marks and solutions.`
    );
    if (!confirmPublish) return;

    setSaving(true);
    try {
      // Step 1: Save evaluation as evaluated
      await fetch(`/api/admin/exams/evaluations/${attemptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'evaluated',
          manual_marks: manualMarks,
          teacher_remarks: teacherRemarks,
          trainer_feedback: trainerFeedback,
          audit_reason: 'Pre-publish evaluation confirmation'
        })
      });

      // Step 2: Publish
      const publishRes = await fetch('/api/admin/exams/evaluations/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: exam.id,
          batch_id: attempt.batch_id,
          student_ids: [attempt.student_id],
          audit_note: 'Direct release from student answer sheet'
        })
      });

      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishData.error || 'Failed to publish');

      alert('Result successfully published to the student!');
      fetchAttempt();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error publishing result');
    } finally {
      setSaving(false);
    }
  };

  // Republish with Audit Reason
  const handleRepublish = async () => {
    if (!auditReason.trim()) {
      alert('Please provide an audit reason explaining why the marks or remarks were revised.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/exams/evaluations/${attemptId}/republish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_reason: auditReason,
          manual_marks: manualMarks,
          teacher_remarks: teacherRemarks,
          trainer_feedback: trainerFeedback
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to republish');

      alert('Revised evaluation successfully republished with recorded audit entry!');
      setRepublishModalOpen(false);
      setAuditReason('');
      fetchAttempt();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error republishing');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !attempt || !student || !exam) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isPublished = Boolean(attempt.is_published);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in py-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/exam-evaluations')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Evaluation Queue
        </button>

        <div className="flex items-center gap-2">
          {isPublished ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" /> Result Officially Published
            </span>
          ) : attempt.evaluation_status === 'evaluated' ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
              <CheckSquare size={14} /> Evaluation Completed (Unpublished)
            </span>
          ) : attempt.evaluation_status === 'in_progress' ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <Clock size={14} /> Draft in Progress
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <AlertCircle size={14} /> Pending Evaluation
            </span>
          )}
        </div>
      </div>

      {/* Candidate & Exam Metadata Banner */}
      <ClayCard className="p-6 bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
              Student Answer Sheet Verification
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {student.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="font-mono font-bold text-slate-700">{student.student_id}</span>
              <span>•</span>
              <span className="font-semibold text-indigo-700">{batch?.name || 'Assigned Cohort'}</span>
              <span>•</span>
              <span>
                Submitted on{' '}
                {attempt.submitted_at
                  ? new Date(attempt.submitted_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'N/A'}
              </span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowProctoringLog(!showProctoringLog)}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] border cursor-pointer transition ${
                  (attempt?.fullscreen_exit_count || 0) > 0
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <ShieldAlert size={12} />
                <span>
                  {(attempt?.fullscreen_exit_count || 0) > 0
                    ? `${attempt?.fullscreen_exit_count} Fullscreen Exit${(attempt?.fullscreen_exit_count || 0) > 1 ? 's' : ''}`
                    : 'Fullscreen Protected (0 Exits)'}
                </span>
                {showProctoringLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {/* Live Calculated Score Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center min-w-[170px] shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Evaluated Marks
            </span>
            <div className="text-3xl font-black text-indigo-600 font-mono mt-0.5">
              {formattedScore}{' '}
              <span className="text-sm text-slate-400 font-normal">/ {exam.max_marks}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
              {((formattedScore / exam.max_marks) * 100).toFixed(1)}% Marks
            </span>
          </div>
        </div>

        {/* Expandable Proctoring Audit Timeline */}
        {showProctoringLog && (
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs space-y-2 border border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} /> Fullscreen & Focus Integrity Audit Timeline
              </span>
              <span>{Array.isArray(attempt?.proctoring_event_log) ? attempt?.proctoring_event_log.length : 0} Events Recorded</span>
            </div>
            {Array.isArray(attempt?.proctoring_event_log) && attempt.proctoring_event_log.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
                {attempt.proctoring_event_log.map((evt: any, eIdx: number) => (
                  <div key={eIdx} className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        evt.type === 'fullscreen_exit' ? 'bg-rose-900 text-rose-200' :
                        evt.type === 'tab_hidden' ? 'bg-amber-900 text-amber-200' :
                        'bg-emerald-900 text-emerald-200'
                      }`}>
                        {evt.type}
                      </span>
                      <span className="text-slate-300 font-sans">{evt.details || 'Event logged'}</span>
                    </div>
                    <span className="text-slate-500 shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">No proctoring violation events were recorded. The candidate remained in uninterrupted fullscreen mode throughout.</p>
            )}
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500">
            <strong>Marking Scheme:</strong> +{exam.marks_per_question} correct, {Number(exam.negative_marking || 0) > 0 ? `-${exam.negative_marking} incorrect` : 'no negative penalty'}, 0 unattempted.
          </div>

          <div className="flex items-center gap-2">
            <ClayButton
              onClick={() => handleSaveEvaluation('in_progress')}
              disabled={saving}
              variant="secondary"
              className="text-xs font-bold py-2 px-3.5 flex items-center gap-1.5"
            >
              <Save size={14} /> Save Draft
            </ClayButton>

            <ClayButton
              onClick={() => handleSaveEvaluation('evaluated')}
              disabled={saving}
              variant="secondary"
              className="text-xs font-bold py-2 px-3.5 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 flex items-center gap-1.5"
            >
              <CheckSquare size={14} /> Mark as Evaluated
            </ClayButton>

            {!isPublished ? (
              <ClayButton
                onClick={handleDirectPublish}
                disabled={saving}
                variant="primary"
                className="text-xs font-bold py-2 px-4 shadow-sm flex items-center gap-1.5"
              >
                <Send size={14} /> Publish Result
              </ClayButton>
            ) : (
              <ClayButton
                onClick={() => setRepublishModalOpen(true)}
                disabled={saving}
                variant="primary"
                className="text-xs font-bold py-2 px-4 bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <ShieldCheck size={14} /> Update & Republish
              </ClayButton>
            )}
          </div>
        </div>
      </ClayCard>

      {/* Overall Trainer Feedback Section */}
      <ClayCard className="p-5 bg-white border border-slate-200 space-y-2">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <FileText size={15} className="text-indigo-600" /> Overall Trainer Remarks / Academic Feedback
        </label>
        <textarea
          value={trainerFeedback}
          onChange={e => setTrainerFeedback(e.target.value)}
          placeholder="Enter detailed trainer feedback for this student's attempt (e.g. Excellent implementation of dynamic programming; review edge cases for empty inputs)."
          className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:bg-white bg-slate-50 leading-relaxed"
          rows={3}
        />
      </ClayCard>

      {/* Question-by-Question Evaluation List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Award size={18} className="text-indigo-600" /> Question-by-Question Answer Review & Manual Marking
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {questions.length} Total Questions
          </span>
        </div>

        {questions.map((q, idx) => {
          const type = q.question_type || 'mcq';
          const isMcq = type === 'mcq';
          const isCorrect = q.is_correct === true;
          const isUnattempted = isMcq
            ? !q.selected_option_id
            : type === 'file_upload'
            ? !q.submitted_file_url
            : !(q.descriptive_answer && q.descriptive_answer.trim().length > 0 && q.descriptive_answer.trim() !== (q.code_template || '').trim());

          const currentMarks = manualMarks[q.id] ?? (q.suggested_score ?? 0);
          const currentRemarks = teacherRemarks[q.id] ?? '';

          return (
            <ClayCard key={q.id} className="p-5 bg-white border border-slate-200/90 space-y-4 shadow-xs">
              {/* Question Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                    Question No. {idx + 1}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    type === 'coding' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    type === 'written' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                    type === 'file_upload' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {type === 'coding' ? `Coding (${q.coding_language || 'c'})` : type === 'written' ? 'Written' : type === 'file_upload' ? 'File Upload' : 'MCQ'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {q.topic} ({q.subject})
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isUnattempted ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      Unattempted (0 pts)
                    </span>
                  ) : isMcq ? (
                    isCorrect ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Correct Choice (+{q.marks})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1">
                        <XCircle size={12} /> Incorrect Choice {Number(q.negative_penalty || 0) > 0 ? `(-${q.negative_penalty})` : '(0 pts)'}
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                      <Sparkles size={12} /> Response Submitted
                    </span>
                  )}

                  <span className="text-[11px] font-mono text-slate-400">
                    Max: +{q.marks}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-sm font-bold text-slate-900 leading-relaxed break-words whitespace-pre-wrap">
                {q.question_text}
              </div>

              {/* Question Body: Type Specific Candidate Submission */}
              {type === 'coding' && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-mono text-slate-100 overflow-x-auto shadow-inner">
                    <div className="flex items-center justify-between text-[11px] text-cyan-400 border-b border-slate-800 pb-2 mb-2 font-sans font-bold">
                      <span className="flex items-center gap-1.5">
                        <Code2 size={14} /> Candidate Code Submission ({q.coding_language?.toUpperCase() || 'PYTHON'})
                      </span>
                      <span>
                        {q.descriptive_answer ? `${q.descriptive_answer.split('\n').length} lines` : '0 lines'}
                      </span>
                    </div>
                    {q.descriptive_answer ? (
                      <pre className="whitespace-pre overflow-x-auto leading-relaxed">{q.descriptive_answer}</pre>
                    ) : (
                      <span className="text-slate-500 italic font-sans">No code solution was submitted for this question.</span>
                    )}
                  </div>
                </div>
              )}

              {type === 'written' && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 text-xs font-sans text-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-900 border-b border-purple-100 pb-1.5">
                    <span>Candidate Written Answer Response</span>
                    <span>
                      {q.descriptive_answer ? `${q.descriptive_answer.trim().split(/\s+/).filter(Boolean).length} words` : '0 words'}
                    </span>
                  </div>
                  {q.descriptive_answer ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-800 font-medium">
                      {q.descriptive_answer}
                    </p>
                  ) : (
                    <span className="text-slate-400 italic">No written response was submitted for this question.</span>
                  )}
                </div>
              )}

              {type === 'file_upload' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-2">
                  <span className="text-[11px] font-bold text-amber-900 block">Candidate Practical File Attachment</span>
                  {q.submitted_file_url ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200 gap-3">
                      <div className="flex items-center gap-2 text-slate-800 font-bold truncate">
                        <FileText size={16} className="text-amber-600 shrink-0" />
                        <span className="truncate">{q.submitted_file_name || 'candidate_submission_file'}</span>
                      </div>
                      <a
                        href={q.submitted_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={q.submitted_file_name || 'submission'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition shrink-0 shadow-xs"
                      >
                        <Download size={13} /> Download & Verify File
                      </a>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No file attachment was submitted by candidate.</span>
                  )}
                </div>
              )}

              {isMcq && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map(opt => {
                    const isChosen = opt.id === q.selected_option_id;
                    const isRight = opt.id === q.correct_option_id;

                    let optClass = 'bg-slate-50 border-slate-200 text-slate-700';
                    if (isRight) {
                      optClass = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold';
                    } else if (isChosen && !isRight) {
                      optClass = 'bg-rose-50 border-rose-300 text-rose-950 font-bold';
                    }

                    return (
                      <div key={opt.id} className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${optClass}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isRight ? 'bg-emerald-600 text-white' : isChosen ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {opt.id.replace('opt', '')}
                        </span>
                        <span className="flex-1 break-words">{opt.text}</span>
                        {isRight && <span className="text-[10px] font-bold text-emerald-700">(Correct Answer)</span>}
                        {isChosen && !isRight && <span className="text-[10px] font-bold text-rose-700">(Student Selection)</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual Grading Inputs Bar */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                {/* Manual Marks Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Marks Awarded (Max: {q.marks})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setManualMarks(prev => ({ ...prev, [q.id]: q.marks }))}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        title="Award Full Marks"
                      >
                        +{q.marks}
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualMarks(prev => ({ ...prev, [q.id]: 0 }))}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 hover:bg-slate-300"
                        title="Award 0 Marks"
                      >
                        0
                      </button>
                      {q.negative_penalty > 0 && (
                        <button
                          type="button"
                          onClick={() => setManualMarks(prev => ({ ...prev, [q.id]: -q.negative_penalty }))}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 hover:bg-rose-200"
                          title="Apply Negative Penalty"
                        >
                          -{q.negative_penalty}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.25"
                    value={currentMarks}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setManualMarks(prev => ({
                        ...prev,
                        [q.id]: isNaN(val) ? 0 : val
                      }));
                    }}
                    className="w-full text-xs font-mono font-bold p-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                {/* Question Remarks Input */}
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Question Remarks / Trainer Guidance (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full credit given; clear understanding of isentropic expansion."
                    value={currentRemarks}
                    onChange={e => {
                      setTeacherRemarks(prev => ({
                        ...prev,
                        [q.id]: e.target.value
                      }));
                    }}
                    className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              {/* Scientific Explanation Reference */}
              {q.explanation && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">Official Solution Note:</strong> {q.explanation}
                </div>
              )}
            </ClayCard>
          );
        })}
      </div>

      {/* Audit History Log */}
      {evaluationHistory.length > 0 && (
        <ClayCard className="p-5 bg-white border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <History size={14} className="text-slate-500" /> Evaluation Modification & Publishing Audit Trail
          </h3>
          <div className="space-y-2 divide-y divide-slate-100 text-xs">
            {evaluationHistory.map((h, i) => (
              <div key={i} className="pt-2 flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900">{h.action}</span>
                  <span className="text-slate-500 text-[11px]"> by {h.actor_name || 'Trainer'}</span>
                  {h.notes && <p className="text-slate-600 text-[11px] mt-0.5">{h.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[11px] text-slate-500 block">
                    {new Date(h.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {h.new_score !== undefined && (
                    <span className="text-[10px] font-bold text-indigo-700">
                      Score: {h.new_score}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ClayCard>
      )}

      {/* Republish Modal */}
      {republishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <ClayCard className="max-w-md w-full p-6 bg-white space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Update & Republish Result</h3>
                <span className="text-xs text-slate-500">Audit-tracked evaluation revision</span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              You are updating published marks for <strong>{student.name}</strong> to{' '}
              <strong>{formattedScore} / {exam.max_marks}</strong>.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">
                Audit Reason for Revision (Required)
              </label>
              <textarea
                value={auditReason}
                onChange={e => setAuditReason(e.target.value)}
                placeholder="e.g. Corrected manual calculation for Question 3 after student review."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                rows={3}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <ClayButton
                onClick={() => setRepublishModalOpen(false)}
                variant="secondary"
                disabled={saving}
                className="text-xs"
              >
                Cancel
              </ClayButton>
              <ClayButton
                onClick={handleRepublish}
                variant="primary"
                disabled={saving || !auditReason.trim()}
                className="text-xs font-bold"
              >
                {saving ? 'Republishing...' : 'Confirm Revision & Republish'}
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      )}
    </div>
  );
}
