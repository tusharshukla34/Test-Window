import { describe, it, expect, beforeAll } from 'vitest';
import { dbService } from '../src/lib/db/database';
import { hashPassword } from '../src/lib/auth';

describe('Trainer-Controlled Manual Examination Evaluation and Result Publishing Workflow', () => {
  const runId = Math.floor(1000 + Math.random() * 9000).toString();
  let batchAId: string;
  let batchBId: string;
  let studentAId: string;
  let studentBId: string;
  let testExamId: string;
  let attemptAId: string;

  beforeAll(async () => {
    // Create 2 cohorts
    const bA = dbService.createBatch({
      name: `Cohort Alpha ${runId}`,
      description: 'Morning examination batch'
    });
    batchAId = bA.id;

    const bB = dbService.createBatch({
      name: `Cohort Beta ${runId}`,
      description: 'Afternoon examination batch'
    });
    batchBId = bB.id;

    // Create 2 students
    const pw = await hashPassword('StudentPassword@123');
    const sA = dbService.createStudent({
      name: `Student Alpha ${runId}`,
      email: `alpha.${runId}@example.com`,
      student_id: `STU-A-${runId}`,
      password_hash: pw,
      batch_ids: [batchAId]
    });
    studentAId = sA.id;

    const sB = dbService.createStudent({
      name: `Student Beta ${runId}`,
      email: `beta.${runId}@example.com`,
      student_id: `STU-B-${runId}`,
      password_hash: pw,
      batch_ids: [batchBId]
    });
    studentBId = sB.id;

    // Create exam assigned ONLY to Cohort Alpha
    const qList = dbService.getAllQuestions().slice(0, 3).map(q => q.id);
    const exam = dbService.createExam({
      title: `Thermodynamics Controlled Eval Mock ${runId}`,
      description: 'Exam with trainer manual evaluation requirement',
      duration_minutes: 10,
      negative_marking: 0.25,
      batch_ids: [batchAId],
      question_ids: qList,
      created_by: 'usr-admin-tushar'
    });
    testExamId = exam.id;
  });

  it('Step 1: Student takes exam and submits; state is pending_evaluation without score leak', () => {
    const session = dbService.startOrResumeExamAttempt(testExamId, studentAId);
    attemptAId = session.attempt.id;

    const q1 = session.questions[0];
    const q2 = session.questions[1];

    // Save answer for Q1
    dbService.autosaveExamResponse(attemptAId, studentAId, q1.id, {
      selected_option_id: 'opt1',
      is_marked_for_review: false,
      is_visited: true,
      time_spent_seconds: 20
    });

    // Save answer for Q2
    dbService.autosaveExamResponse(attemptAId, studentAId, q2.id, {
      selected_option_id: 'opt2',
      is_marked_for_review: false,
      is_visited: true,
      time_spent_seconds: 25
    });

    // Finalize attempt
    const finalized = dbService.finalizeExamAttempt(attemptAId, studentAId);
    expect(finalized.status).toBe('completed');
    expect(finalized.evaluation_status).toBe('pending_evaluation');
    expect(finalized.is_published).toBeFalsy();
  });

  it('Step 2: Student receives neutral confirmation and cannot access hidden scores or answers', () => {
    const res = dbService.getStudentExamResult(testExamId, studentAId);

    expect(res.is_published).toBe(false);
    expect(res.status_message).toBe('Submitted — Awaiting Trainer Evaluation');
    expect(res.questions_review).toBeUndefined();
    expect((res.attempt as any).total_score).toBeUndefined();
    expect((res.attempt as any).percentage).toBeUndefined();
  });

  it('Step 3: Trainer views evaluation monitoring queue and sees submission with auto-suggested marks', () => {
    const monitoring = dbService.getExamEvaluationsMonitoring({
      batch_id: batchAId,
      exam_id: testExamId
    });

    expect(monitoring.attempts.length).toBe(1);
    const att = monitoring.attempts[0];
    expect(att.student_name).toContain('Student Alpha');
    expect(att.evaluation_status).toBe('pending_evaluation');
    expect(att.is_published).toBe(false);
  });

  it('Step 4: Trainer opens answer sheet and performs manual evaluation with customized marks', () => {
    const evalData = dbService.getAttemptForEvaluation(attemptAId);
    expect(evalData.questions.length).toBe(3);

    const q1 = evalData.questions[0];
    const q2 = evalData.questions[1];

    // Trainer gives custom manual marks (e.g. 1.0 on Q1, and 0.5 partial on Q2 with note)
    const updated = dbService.saveAttemptEvaluation(attemptAId, 'usr-admin-tushar', {
      status: 'evaluated',
      manual_marks: {
        [q1.id]: 1.0,
        [q2.id]: 0.5
      },
      teacher_remarks: {
        [q1.id]: 'Accurate principle identification.',
        [q2.id]: 'Partial credit: equation was correct, minor constant error.'
      },
      trainer_feedback: 'Good overall analytical approach. Solid derivations.',
      audit_reason: 'Completed manual marking'
    });

    expect(updated).toBeDefined();
    expect((updated as any).evaluation_status).toBe('evaluated');
    expect((updated as any).total_score).toBe(1.5);
  });

  it('Step 5: While evaluated but unpublished, student STILL cannot see marks', () => {
    const res = dbService.getStudentExamResult(testExamId, studentAId);

    expect(res.is_published).toBe(false);
    expect(res.status_message).toBe('Evaluation Completed — Result Not Yet Published');
    expect(res.questions_review).toBeUndefined();
    expect((res.attempt as any).total_score).toBeUndefined();
  });

  it('Step 6: Trainer officially publishes batch results', () => {
    const pub = dbService.publishExamResults({
      exam_id: testExamId,
      batch_id: batchAId,
      trainer_id: 'usr-admin-tushar',
      audit_note: 'Verified cohort results release'
    });

    expect(pub.published_count).toBe(1);
  });

  it('Step 7: Student Alpha now views verified scorecard, remarks, and question solutions', () => {
    const res = dbService.getStudentExamResult(testExamId, studentAId);

    expect(res.is_published).toBe(true);
    expect(res.attempt.total_score).toBe(1.5);
    expect(res.questions_review).toBeDefined();
    expect(res.questions_review?.length).toBe(3);

    // Verify teacher remarks and solutions are released
    const q2Reviewed = res.questions_review!.find(q => q.teacher_remarks?.includes('Partial credit'));
    expect(q2Reviewed).toBeDefined();
    expect(q2Reviewed?.manual_marks).toBe(0.5);
    expect(q2Reviewed?.explanation).toBeDefined();
  });

  it('Step 8: Student Beta in Cohort Beta is strictly isolated and cannot view Alpha results', () => {
    expect(() => {
      dbService.getStudentExamResult(testExamId, studentBId);
    }).toThrow(/attempt not found/i);

    const eligibility = dbService.getStudentExamEligibility(testExamId, studentBId);
    expect(eligibility.is_eligible).toBe(false);
  });

  it('Step 9: Trainer corrects a mark and republishes with recorded audit log', () => {
    const evalData = dbService.getAttemptForEvaluation(attemptAId);
    const q2 = evalData.questions[1];

    // Trainer adjusts Q2 from 0.5 to 1.0 with required audit reason
    const republished = dbService.republishExamResult(attemptAId, 'usr-admin-tushar', {
      audit_reason: 'Student demonstrated correct working during office hours discussion; credited full mark.',
      manual_marks: {
        [q2.id]: 1.0
      },
      teacher_remarks: {
        [q2.id]: 'Full credit restored after working review.'
      }
    });

    expect((republished as any).total_score).toBe(2.0);
    expect((republished as any).is_published).toBe(1);

    // Check audit history in attempt
    const afterData = dbService.getAttemptForEvaluation(attemptAId);
    expect(afterData.evaluation_history.length).toBeGreaterThanOrEqual(2);
    const lastAudit = afterData.evaluation_history[afterData.evaluation_history.length - 1];
    expect(lastAudit.action).toBe('republished_correction');
    expect(lastAudit.notes).toContain('office hours discussion');
  });
});
