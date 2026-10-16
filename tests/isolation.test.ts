import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dbService } from '../src/lib/db/database';

describe('Cohort Batch-Isolation and Security Rules', () => {
  let studentA: any;
  let studentB: any;
  let batchA: any;
  let batchB: any;
  let examA: any;
  let asgA: any;
  let asgB: any;

  beforeAll(() => {
    // Set up clean isolated test fixtures
    batchA = dbService.createBatch({ name: 'Isolation Batch A', description: 'Test Batch A' });
    batchB = dbService.createBatch({ name: 'Isolation Batch B', description: 'Test Batch B' });

    studentA = dbService.createStudent({
      name: 'Isolation Student A',
      email: 'iso.student.a@example.com',
      student_id: 'STU-ISO-001',
      password_hash: '$2a$10$xyzFakeHash12345678901234567890',
      batch_ids: [batchA.id]
    });

    studentB = dbService.createStudent({
      name: 'Isolation Student B',
      email: 'iso.student.b@example.com',
      student_id: 'STU-ISO-002',
      password_hash: '$2a$10$xyzFakeHash12345678901234567890',
      batch_ids: [batchB.id]
    });

    // Create assignments for batches
    asgA = dbService.createAssignment({
      title: 'Isolation Assignment A',
      subject: 'Mechanical Engineering',
      instructions: 'Complete problem set A',
      submission_type: 'both',
      allowed_formats: ['pdf'],
      max_file_size_mb: 10,
      max_score: 50,
      allow_late_submissions: true,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      batch_ids: [batchA.id]
    });

    asgB = dbService.createAssignment({
      title: 'Isolation Assignment B',
      subject: 'Mechanical Engineering',
      instructions: 'Complete problem set B',
      submission_type: 'both',
      allowed_formats: ['pdf'],
      max_file_size_mb: 10,
      max_score: 50,
      allow_late_submissions: true,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      batch_ids: [batchB.id]
    });

    // Create exam for Batch A
    const questions = dbService.getAllQuestions();
    const qIds = questions.slice(0, 3).map(q => q.id);
    examA = dbService.createExam({
      title: 'Isolation Exam A',
      duration_minutes: 15,
      negative_marking: 0.25,
      batch_ids: [batchA.id],
      question_ids: qIds
    });
  });

  afterAll(() => {
    if (studentA?.id) dbService.deleteStudent(studentA.id);
    if (studentB?.id) dbService.deleteStudent(studentB.id);
    if (batchA?.id) dbService.deleteBatch(batchA.id);
    if (batchB?.id) dbService.deleteBatch(batchB.id);
    if (asgA?.id) dbService.deleteAssignment(asgA.id);
    if (asgB?.id) dbService.deleteAssignment(asgB.id);
    if (examA?.id) dbService.deleteExam(examA.id);
  });

  it('retrieves student profile and verifies batch membership', () => {
    const student = dbService.getUserByStudentId('STU-ISO-001');
    expect(student).not.toBeNull();
    expect(student?.name).toBe('Isolation Student A');
    expect(student?.role).toBe('student');

    const batches = dbService.getStudentBatches(student!.id);
    const batchNames = batches.map(b => b.name);
    expect(batchNames).toContain('Isolation Batch A');
  });

  it('restricts exam access only to enrolled cohort students', () => {
    // Student A (in Batch A) should be eligible
    const eligibilityA = dbService.getStudentExamEligibility(examA.id, studentA.id);
    expect(eligibilityA.is_eligible).toBe(true);

    // Student B (in Batch B only) should NOT be eligible for Batch A's mock exam
    const eligibilityB = dbService.getStudentExamEligibility(examA.id, studentB.id);
    expect(eligibilityB.is_eligible).toBe(false);
    expect(eligibilityB.reason).toContain('not enrolled');
  });

  it('restricts assignment visibility to cohort students only', () => {
    const assignmentsA = dbService.getAssignmentsForStudent(studentA.id);
    const assignmentsB = dbService.getAssignmentsForStudent(studentB.id);

    const titlesA = assignmentsA.map(a => a.title);
    const titlesB = assignmentsB.map(a => a.title);

    // Student A should see Batch A assignment
    expect(titlesA).toContain('Isolation Assignment A');

    // Student B should see Batch B assignment
    expect(titlesB).toContain('Isolation Assignment B');

    // Student B must NOT see Batch A assignment
    expect(titlesB).not.toContain('Isolation Assignment A');
  });

  it('safely creates and deletes an existing batch along with its memberships', () => {
    // Create temporary batch
    const tempBatch = dbService.createBatch({
      name: 'Temporary Test Batch',
      description: 'Batch to be tested for deletion'
    });
    expect(tempBatch.id).toBeDefined();

    // Enroll Student A in temp batch
    dbService.addStudentToBatch(tempBatch.id, studentA.id);
    let enrolled = dbService.getStudentBatches(studentA.id);
    expect(enrolled.some(b => b.id === tempBatch.id)).toBe(true);

    // Delete the batch
    const deleted = dbService.deleteBatch(tempBatch.id);
    expect(deleted).toBe(true);

    // Verify batch is gone
    const fetched = dbService.getBatchById(tempBatch.id);
    expect(fetched).toBeNull();

    // Verify student is no longer enrolled
    enrolled = dbService.getStudentBatches(studentA.id);
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
    const adminUser = dbService.getUserByEmail('tushar@portal.edu') || dbService.getUserById('usr-admin-tushar');
    if (adminUser) {
      expect(dbService.deleteStudent(adminUser.id)).toBe(false);
    }
  });
});
