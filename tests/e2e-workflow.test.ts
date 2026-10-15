import { describe, it, expect, beforeAll } from 'vitest';
import { dbService } from '../src/lib/db/database';
import { hashPassword, verifyPassword } from '../src/lib/auth';

describe('Complete 12-Step Trainer & Student End-to-End Lifecycle Workflow', () => {
  let createdStudentId: string;
  let createdBatchId: string;
  let createdAssignmentId: string;
  let createdExamId: string;
  let studentSubmissionId: string;
  let studentAttemptId: string;

  const testRunId = Math.floor(1000 + Math.random() * 9000).toString();
  const studentIdCode = `STU-2026-${testRunId}`;
  const studentEmail = `ananya.${testRunId}@example.com`;

  // Step 1: Admin creates a student
  it('Step 1: Admin creates a student account', async () => {
    const passwordHash = await hashPassword('StudentSecret@123');
    const newStudent = dbService.createStudent({
      name: 'Ananya Deshmukh',
      email: studentEmail,
      student_id: studentIdCode,
      password_hash: passwordHash,
      phone: '+91 9876543210',
      batch_ids: []
    });

    expect(newStudent).toBeDefined();
    expect(newStudent.name).toBe('Ananya Deshmukh');
    expect(newStudent.student_id).toBe(studentIdCode);
    expect(newStudent.role).toBe('student');
    expect(newStudent.status).toBe('active');
    createdStudentId = newStudent.id;
  });

  // Step 2: Admin places the student in a batch
  it('Step 2: Admin places the student in a batch', async () => {
    const batch = dbService.createBatch({
      name: 'Advanced 11:00 AM Batch',
      description: 'Special AE/JE Advanced Problems Cohort'
    });
    expect(batch).toBeDefined();
    createdBatchId = batch.id;

    // Enroll Ananya into the batch
    dbService.addStudentToBatch(createdBatchId, createdStudentId);

    const enrolledBatches = dbService.getStudentBatches(createdStudentId);
    expect(enrolledBatches.some(b => b.id === createdBatchId)).toBe(true);
  });

  // Step 3: Admin assigns homework to that batch
  it('Step 3: Admin assigns daily homework to that batch', async () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const assignment = dbService.createAssignment({
      title: 'Advanced Rankine Cycle Superheat Calculations',
      subject: 'Applied Thermodynamics',
      instructions: 'Calculate the boiler heat input, turbine work output, and thermal efficiency for the reheat cycle.',
      submission_type: 'both',
      allowed_formats: ['pdf', 'png'],
      max_file_size_mb: 15,
      max_score: 50,
      rubric: 'Derivation: 20 pts, Numerical Accuracy: 20 pts, Diagram: 10 pts',
      allow_late_submissions: true,
      deadline,
      created_by: 'usr-admin-tushar',
      batch_ids: [createdBatchId]
    });

    expect(assignment).toBeDefined();
    expect(assignment.title).toBe('Advanced Rankine Cycle Superheat Calculations');
    createdAssignmentId = assignment.id;

    // Verify Ananya sees this assignment in her cohort
    const studentTasks = dbService.getAssignmentsForStudent(createdStudentId);
    expect(studentTasks.some(t => t.id === createdAssignmentId)).toBe(true);
  });

  // Step 4: Student logs in and submits homework
  it('Step 4: Student submits homework', async () => {
    const submission = dbService.submitAssignment({
      assignment_id: createdAssignmentId,
      student_id: createdStudentId,
      batch_id: createdBatchId,
      text_response: 'Rankine cycle thermal efficiency calculated as 42.8% with superheat temperature 550°C.',
      file_name: 'Ananya_Rankine_Working.pdf',
      file_url: '/api/files/download/mock-sample.pdf',
      file_size: 1542000,
      file_mime: 'application/pdf'
    });

    expect(submission).toBeDefined();
    expect(submission.status).toBe('submitted');
    expect(submission.version).toBe(1);
    studentSubmissionId = submission.id;

    // Verify monitoring matrix reflects "Submitted" status
    const matrix = dbService.getAssignmentMatrix(createdBatchId);
    const ananyaRow = matrix.rows.find(r => r.student.id === createdStudentId);
    expect(ananyaRow).toBeDefined();
    expect(ananyaRow?.assignments[createdAssignmentId].status).toBe('Submitted');
  });

  // Step 5: Admin evaluates and releases feedback
  it('Step 5: Admin evaluates submission and releases feedback', async () => {
    const evaluated = dbService.evaluateSubmission(studentSubmissionId, {
      marks_awarded: 48,
      feedback: 'Excellent derivations and clear enthalpy-entropy (h-s) diagrams. Minor rounding in pump work.',
      release_draft: true,
      evaluated_by: 'usr-admin-tushar'
    });

    expect(evaluated.status).toBe('evaluated');
    expect(evaluated.marks_awarded).toBe(48);
    expect(evaluated.feedback_released).toBe(1);

    // Verify matrix reflects "Evaluated" with 48/50
    const matrix = dbService.getAssignmentMatrix(createdBatchId);
    const ananyaRow = matrix.rows.find(r => r.student.id === createdStudentId);
    expect(ananyaRow?.assignments[createdAssignmentId].status).toBe('Evaluated');
    expect(ananyaRow?.assignments[createdAssignmentId].marks).toBe(48);
  });

  // Step 6: Admin creates an exam and assigns it to the batch
  it('Step 6: Admin creates an exam and assigns it to the cohort', async () => {
    const allQuestions = dbService.getAllQuestions();
    const examQuestions = allQuestions.slice(0, 5).map(q => q.id);

    const exam = dbService.createExam({
      title: 'Cohort Thermal Power AE/JE Speed Test',
      description: 'Timed speed examination for Advanced 11 AM cohort.',
      instructions: 'Standard instructions: +1 for correct, -0.25 for incorrect.',
      duration_minutes: 15,
      negative_marking: 0.25,
      allow_pausing: false,
      batch_ids: [createdBatchId],
      question_ids: examQuestions,
      created_by: 'usr-admin-tushar'
    });

    expect(exam).toBeDefined();
    expect(exam.total_questions).toBe(5);
    expect(exam.max_marks).toBe(5.0);
    createdExamId = exam.id;

    // Verify Ananya sees this exam
    const studentExams = dbService.getExamsForStudent(createdStudentId);
    expect(studentExams.some(e => e.id === createdExamId)).toBe(true);
  });

  // Step 7: Student reads instructions and begins the exam
  it('Step 7: Student begins the exam and receives authoritative deadline', async () => {
    const sessionData = dbService.startOrResumeExamAttempt(createdExamId, createdStudentId);

    expect(sessionData.attempt).toBeDefined();
    expect(sessionData.attempt.status).toBe('in_progress');
    expect(sessionData.questions.length).toBe(5);
    // CRITICAL: questions MUST NOT contain answer keys or explanations
    expect((sessionData.questions[0] as any).correct_option_id).toBeUndefined();
    expect((sessionData.questions[0] as any).explanation).toBeUndefined();

    // Verify authoritative deadline is ~15 mins in future
    const deadline = new Date(sessionData.attempt.authoritative_deadline).getTime();
    const started = new Date(sessionData.attempt.started_at).getTime();
    expect(deadline - started).toBeCloseTo(15 * 60 * 1000, -3);

    studentAttemptId = sessionData.attempt.id;
  });

  // Step 8: Student answers, navigates, marks for review, and saves responses
  it('Step 8: Student saves responses and marks questions for review', async () => {
    const sessionData = dbService.startOrResumeExamAttempt(createdExamId, createdStudentId);
    const q1 = sessionData.questions[0];
    const q2 = sessionData.questions[1];
    const q3 = sessionData.questions[2];

    // Q1: Answered with option 1
    const res1 = dbService.autosaveExamResponse(studentAttemptId, createdStudentId, q1.id, {
      selected_option_id: 'opt1',
      is_marked_for_review: false,
      is_visited: true,
      time_spent_seconds: 15
    });
    expect(res1.saved).toBe(true);

    // Q2: Answered and Marked for review
    const res2 = dbService.autosaveExamResponse(studentAttemptId, createdStudentId, q2.id, {
      selected_option_id: 'opt2',
      is_marked_for_review: true,
      is_visited: true,
      time_spent_seconds: 20
    });
    expect(res2.saved).toBe(true);

    // Q3: Visited but left unanswered
    const res3 = dbService.autosaveExamResponse(studentAttemptId, createdStudentId, q3.id, {
      selected_option_id: null,
      is_marked_for_review: false,
      is_visited: true,
      time_spent_seconds: 10
    });
    expect(res3.saved).toBe(true);

    // Verify Summary modal table counts
    const summary = dbService.getExamAttemptSummary(studentAttemptId, createdStudentId);
    expect(summary.total_questions).toBe(5);
    expect(summary.answered).toBe(2);
    expect(summary.marked_for_review).toBe(1);
  });

  // Step 9 & 10: Student submits examination and receives neutral confirmation without score leak
  it('Step 9 & 10: Backend atomically finalizes attempt in pending_evaluation without score leak', async () => {
    const finalized = dbService.finalizeExamAttempt(studentAttemptId, createdStudentId);

    expect(finalized.status).toBe('completed');
    expect(finalized.submitted_at).not.toBeNull();
    expect(finalized.evaluation_status).toBe('pending_evaluation');
    expect(finalized.is_published).toBeFalsy();

    // Verify student cannot see unpublished marks or answers
    const unreleasedResult = dbService.getStudentExamResult(createdExamId, createdStudentId);
    expect(unreleasedResult.is_published).toBe(false);
    expect(unreleasedResult.status_message).toContain('Awaiting Trainer Evaluation');
    expect(unreleasedResult.questions_review).toBeUndefined();
    expect((unreleasedResult.attempt as any).total_score).toBeUndefined();

    // Attempt is immutable: repeated submit returns existing attempt
    const duplicateSubmit = dbService.finalizeExamAttempt(studentAttemptId, createdStudentId);
    expect(duplicateSubmit.id).toBe(finalized.id);
  });

  // Step 11: Trainer manually evaluates and publishes results, then student views scorecard
  it('Step 11: Trainer evaluates and publishes results, revealing scorecard to student', async () => {
    // Trainer opens attempt for evaluation
    const evalData = dbService.getAttemptForEvaluation(studentAttemptId);
    expect(evalData.questions.length).toBe(5);

    // Trainer adjusts marks and marks as evaluated
    dbService.saveAttemptEvaluation(studentAttemptId, 'usr-admin-tushar', {
      status: 'evaluated',
      trainer_feedback: 'Well reasoned thermodynamics answers. Keep up the good work.'
    });

    // Trainer publishes results for the batch
    const publishResult = dbService.publishExamResults({
      exam_id: createdExamId,
      batch_id: createdBatchId,
      trainer_id: 'usr-admin-tushar',
      audit_note: 'Official batch release'
    });
    expect(publishResult.published_count).toBeGreaterThanOrEqual(1);

    // Now student accesses result: is_published is true and questions review is available
    const result = dbService.getStudentExamResult(createdExamId, createdStudentId);
    expect(result.is_published).toBe(true);
    expect(result.questions_review).toBeDefined();
    expect(result.questions_review?.length).toBe(5);

    // Verify explanations and correct options are now available for review
    const reviewedQ1 = result.questions_review![0];
    expect(reviewedQ1.correct_option_id).toBeDefined();
    expect(reviewedQ1.explanation).toBeDefined();
  });

  // Step 12: Student from another batch is denied access
  it('Step 12: Student from an unrelated batch is denied access to this private exam', async () => {
    const unrelatedStudent = dbService.createStudent({
      name: 'Unrelated Student',
      email: 'unrelated.student@example.com',
      student_id: 'STU-UNRELATED-001',
      password_hash: '$2a$10$xyzFakeHash12345678901234567890'
    });

    const eligibility = dbService.getStudentExamEligibility(createdExamId, unrelatedStudent.id);

    expect(eligibility.is_eligible).toBe(false);
    expect(eligibility.reason).toContain('not enrolled');

    // Attempt to start exam by unauthorized student must throw
    expect(() => {
      dbService.startOrResumeExamAttempt(createdExamId, unrelatedStudent.id);
    }).toThrow(/not authorized|not enrolled/i);

    dbService.deleteStudent(unrelatedStudent.id);
  });
});
