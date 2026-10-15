'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  User,
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  AlertTriangle,
  Play
} from 'lucide-react';
import { Exam, ExamAttempt } from '@/lib/db/types';

export default function ExamInstructionsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [step, setStep] = useState<1 | 2>(1);
  const [data, setData] = useState<{
    exam: Exam;
    candidate: { id: string; name: string; student_id: string };
    attempt?: ExamAttempt | null;
  } | null>(null);

  const [language, setLanguage] = useState('English');
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/student/exams/${examId}/instructions`)
      .then(res => res.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Error loading exam instructions'));
  }, [examId]);

  const handleStartExam = async () => {
    if (!declarationChecked) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch(`/api/student/exams/${examId}/start`, {
        method: 'POST'
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to start examination');

      router.push(`/student/exams/${examId}/attempt`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error starting examination');
      setStarting(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
          {error}
        </div>
        <button
          onClick={() => router.push('/student/exams')}
          className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
        >
          Return to Examinations
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#00bcd4] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { exam, candidate, attempt } = data;

  if (attempt?.status === 'completed') {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <p className="font-bold text-base">You have already completed this examination.</p>
          <p className="text-xs mt-1">Final Score: {attempt.total_score} / {exam.max_marks} points ({attempt.percentage}%)</p>
        </div>
        <button
          onClick={() => router.push(`/student/exams/${examId}/result`)}
          className="px-5 py-2.5 bg-[#00bcd4] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#00acc1]"
        >
          View Graded Results & Review
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between overflow-x-hidden">
      {/* Top Test Header */}
      <header className="border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between bg-white shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#00bcd4] text-white flex items-center justify-center font-extrabold text-xs sm:text-sm shadow-xs shrink-0">
            TS
          </div>
          <h2 className="text-xs sm:text-base font-bold text-slate-800 tracking-tight truncate">
            {exam.title}
          </h2>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Left Instruction Panel */}
        <div className="flex-1 space-y-6">
          {step === 1 ? (
            /* Screen 1: General Instructions */
            <div className="space-y-6 text-slate-800 leading-relaxed text-xs sm:text-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 border-b pb-2">
                General Instructions:
              </h2>

              <ol className="list-decimal pl-5 space-y-4 text-slate-700">
                <li>
                  The clock will be set at the server. The countdown timer at the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You need not terminate the examination or submit your paper.
                </li>

                <li>
                  The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
                  <div className="mt-3 space-y-2.5 pl-2 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-white border-2 border-slate-300 flex items-center justify-center shadow-xs"></div>
                      <span>You have not visited the question yet.</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-[#dc2626] text-white flex items-center justify-center text-xs font-bold shadow-xs"></div>
                      <span>You have not answered the question.</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-[#16a34a] text-white flex items-center justify-center text-xs font-bold shadow-xs"></div>
                      <span>You have answered the question.</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#9333ea] text-white flex items-center justify-center text-xs font-bold shadow-xs"></div>
                      <span>You have NOT answered the question, but have marked the question for review.</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#9333ea] text-white flex items-center justify-center relative shadow-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] border border-white absolute -bottom-0.5 -right-0.5"></span>
                      </div>
                      <span>You have answered the question, but marked it for review.</span>
                    </div>
                  </div>
                </li>
              </ol>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-normal">
                The <strong>Mark For Review</strong> status for a question simply indicates that you would like to look at that question again. If a question is answered, but marked for review, then the answer will be considered for evaluation unless the status is modified by the candidate.
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">Navigating to a Question :</h3>
                <p className="text-slate-600">To answer a question, do the following:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Note that using this option does NOT save your answer to the current question.</li>
                  <li>Click on <strong>Save & Next</strong> to save your answer for the current question and then go to the next question.</li>
                  <li>Click on <strong>Mark for Review & Next</strong> to save your answer for the current question and also mark it for review, and then go to the next question.</li>
                </ul>
              </div>

              <p className="text-rose-600 font-semibold text-xs">
                You can view all the questions by clicking on the <strong>Question Paper</strong> button. This feature is provided, so that if you want you can just see the entire question paper at a glance.
              </p>
            </div>
          ) : (
            /* Screen 2: Test Specific Instructions & Declaration */
            <div className="space-y-6 text-slate-800 leading-relaxed text-xs sm:text-sm">
              <div className="text-center pb-4 border-b border-slate-200">
                <h1 className="text-lg sm:text-xl font-black text-slate-900">
                  {exam.title}
                </h1>
                <div className="flex justify-center gap-8 text-xs font-bold text-slate-600 mt-2">
                  <span>Duration: {exam.duration_minutes} Mins</span>
                  <span>Maximum Marks: {exam.max_marks}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-900">Read the following instructions carefully.</h3>
                <ol className="list-decimal pl-5 space-y-2 text-slate-700">
                  <li>The test having {exam.total_questions} total questions.</li>
                  <li>Each question has 4 options out of which only one is correct.</li>
                  <li>You have to finish the test in {exam.duration_minutes} minutes.</li>
                  <li>You will be awarded {exam.marks_per_question} mark for each correct answer and {exam.negative_marking} marks will be deducted for each wrong answer.</li>
                  <li>There is no negative marking for the questions that you have not attempted.</li>
                  <li>You can write this test only once. Make sure that you complete the test before you submit the test and/or close the browser.</li>
                </ol>
              </div>

              {/* Language Selection */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-700">Choose your default language:</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="p-1.5 rounded-md border border-slate-300 text-xs bg-white"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                </div>
                <p className="text-[11px] text-rose-600">
                  Please note all questions will appear in your default language. This language can be changed for a particular question later on.
                </p>
              </div>

              {/* Declaration Checkbox */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Declaration:</h4>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationChecked}
                    onChange={(e) => setDeclarationChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#00bcd4] focus:ring-[#00bcd4] cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    I have understood and agree to all the instructions.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Candidate Profile Panel */}
        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 flex flex-row md:flex-col items-center justify-start gap-4 md:gap-0 pt-4 bg-slate-50 md:bg-transparent p-3.5 md:p-0 rounded-xl md:rounded-none">
          <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-[#00bcd4] text-white flex items-center justify-center shadow-md shrink-0">
            <User size={32} className="md:w-12 md:h-12" />
          </div>
          <div className="text-left md:text-center min-w-0">
            <h3 className="font-extrabold text-sm md:text-base text-slate-900 md:mt-3 truncate">
              {candidate.name}
            </h3>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              {candidate.student_id}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <footer className="border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 flex items-center justify-between gap-3">
        {step === 1 ? (
          <>
            <button
              onClick={() => router.push('/student/exams')}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-2"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => setStep(2)}
              className="px-5 sm:px-6 py-2 bg-[#90caf9] hover:bg-[#64b5f6] text-slate-900 font-bold text-xs rounded-lg shadow-xs transition"
            >
              Next
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setStep(1)}
              className="px-4 sm:px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition"
            >
              Previous
            </button>
            <button
              disabled={!declarationChecked || starting}
              onClick={handleStartExam}
              className={`px-5 sm:px-8 py-2.5 rounded-lg font-extrabold text-xs text-white shadow-md transition ${
                declarationChecked && !starting
                  ? 'bg-[#00bcd4] hover:bg-[#00acc1] active:bg-[#0097a7] cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {starting ? 'Preparing...' : 'I am ready to begin'}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
