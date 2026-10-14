import { describe, it, expect } from 'vitest';
import { dbService } from '../src/lib/db/database';

describe('Cohort Batch-Isolation and Security Rules', () => {
  it('retrieves student profile and verifies batch membership', () => {
    const rahul = dbService.getUserByStudentId('STU-2026-001');
    expect(rahul).not.toBeNull();
    expect(rahul?.name).toBe('Rahul Verma');
    expect(rahul?.role).toBe('student');

    const rahulBatches = dbService.getStudentBatches(rahul!.id);
    const batchNames = rahulBatches.map(b => b.name);
    // Rahul is enrolled in 9:00 AM Batch and 5:00 PM Batch
    expect(batchNames).toContain('9:00 AM Batch');
  });

  it('restricts exam access only to enrolled cohort students', () => {
    const rahul = dbService.getUserByStudentId('STU-2026-001');
    const amit = dbService.getUserByStudentId('STU-2026-003'); // Amit is in 1:00 PM Batch only!

    const exam = dbService.getExamById('exam-thermo-mock-1') || dbService.getAllExams().find(e => e.id === 'exam-thermo-mock-1' || e.title.includes('Thermodynamics'))!;
    expect(exam).toBeDefined();

    // Rahul (in 9 AM & 5 PM) should be eligible
    const rahulEligibility = dbService.getStudentExamEligibility(exam.id, rahul!.id);
    expect(rahulEligibility.is_eligible).toBe(true);

    // Amit (in 1 PM only) should NOT be eligible for the 9 AM / 5 PM mock exam
    const amitEligibility = dbService.getStudentExamEligibility(exam.id, amit!.id);
    expect(amitEligibility.is_eligible).toBe(false);
    expect(amitEligibility.reason).toContain('not enrolled');
  });

  it('restricts assignment visibility to cohort students only', () => {
    const rahul = dbService.getUserByStudentId('STU-2026-001'); // in 9 AM Batch
    const amit = dbService.getUserByStudentId('STU-2026-003');  // in 1 PM Batch

    const rahulAssignments = dbService.getAssignmentsForStudent(rahul!.id);
    const amitAssignments = dbService.getAssignmentsForStudent(amit!.id);

    const rahulTitles = rahulAssignments.map(a => a.title);
    const amitTitles = amitAssignments.map(a => a.title);

    // Rahul should see 9 AM assignment: "Thermodynamics Cycle Analysis & Efficiency Report"
    expect(rahulTitles).toContain('Thermodynamics Cycle Analysis & Efficiency Report');

    // Amit should see 1 PM assignment: "Applied Heat Transfer Numerical Worksheet"
    expect(amitTitles).toContain('Applied Heat Transfer Numerical Worksheet');

    // Amit must NOT see the 9 AM cycle analysis report!
    expect(amitTitles).not.toContain('Thermodynamics Cycle Analysis & Efficiency Report');
  });
});
