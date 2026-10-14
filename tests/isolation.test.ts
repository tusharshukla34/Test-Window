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

  it('safely creates and deletes an existing batch along with its memberships', () => {
    // Create temporary batch
    const tempBatch = dbService.createBatch({
      name: 'Temporary Test Batch',
      description: 'Batch to be tested for deletion'
    });
    expect(tempBatch.id).toBeDefined();

    const rahul = dbService.getUserByStudentId('STU-2026-001');
    expect(rahul).not.toBeNull();

    // Enroll Rahul in temp batch
    dbService.addStudentToBatch(tempBatch.id, rahul!.id);
    let enrolled = dbService.getStudentBatches(rahul!.id);
    expect(enrolled.some(b => b.id === tempBatch.id)).toBe(true);

    // Delete the batch
    const deleted = dbService.deleteBatch(tempBatch.id);
    expect(deleted).toBe(true);

    // Verify batch is gone
    const fetched = dbService.getBatchById(tempBatch.id);
    expect(fetched).toBeNull();

    // Verify student is no longer enrolled
    enrolled = dbService.getStudentBatches(rahul!.id);
    expect(enrolled.some(b => b.id === tempBatch.id)).toBe(false);

    // Deleting again should return false
    expect(dbService.deleteBatch(tempBatch.id)).toBe(false);
  });

  it('safely creates and permanently deletes a student account and cleans up memberships', () => {
    // Create temporary student
    const tempStudent = dbService.createStudent({
      name: 'Temp Deletable Student',
      email: 'temp.deletable@example.com',
      student_id: 'STU-TEMP-999',
      password_hash: '$2a$10$xyzFakeHash12345678901234567890'
    });
    expect(tempStudent.id).toBeDefined();

    // Verify student exists
    let found = dbService.getUserById(tempStudent.id);
    expect(found).not.toBeNull();
    expect(found?.email).toBe('temp.deletable@example.com');

    // Permanently delete student
    const deleted = dbService.deleteStudent(tempStudent.id);
    expect(deleted).toBe(true);

    // Verify student is gone
    found = dbService.getUserById(tempStudent.id);
    expect(found).toBeNull();

    // Deleting again should return false
    expect(dbService.deleteStudent(tempStudent.id)).toBe(false);

    // Admin user cannot be deleted via deleteStudent
    const adminUser = dbService.getUserByEmail('tushar@cybrom.com');
    if (adminUser) {
      expect(dbService.deleteStudent(adminUser.id)).toBe(false);
    }
  });
});
