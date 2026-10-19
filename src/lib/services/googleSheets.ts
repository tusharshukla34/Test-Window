import { dbService } from '@/lib/db/database';
import { Batch, UserProfile, Assignment, AssignmentSubmission, Exam } from '@/lib/db/types';

export interface ExamResultPayload {
  exam_id: string;
  exam_title: string;
  student_id: string;
  student_id_code?: string | null;
  student_name: string;
  student_email: string;
  batch_name?: string | null;
  score: number;
  max_marks: number;
  percentage: number;
  accuracy: number;
  total_correct?: number;
  total_incorrect?: number;
  total_unattempted?: number;
  time_spent_mins?: number;
  submitted_at: string;
  evaluation_status?: string;
}

export interface GoogleSheetResponse {
  success: boolean;
  message?: string;
  sheet_url?: string;
  sheet_title?: string;
  count?: number;
  [key: string]: any;
}

/**
 * Sends a JSON payload to the configured Google Apps Script Webhook.
 * Non-blocking by design so user API operations never stall or fail.
 */
export async function postToGoogleSheet(payload: Record<string, any>, overrideUrl?: string): Promise<GoogleSheetResponse> {
  try {
    const webhookUrl = overrideUrl || dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) {
      return { success: false, message: 'Google Sheet Webhook URL is not configured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (res.ok && data?.status !== 'error') {
      if (data?.sheet_url) {
        dbService.setSetting('google_sheet_spreadsheet_url', data.sheet_url);
      }
      if (data?.sheet_title) {
        dbService.setSetting('google_sheet_title', data.sheet_title);
      }
      return {
        success: true,
        message: data?.message || 'Synced successfully',
        sheet_url: data?.sheet_url,
        sheet_title: data?.sheet_title
      };
    } else {
      return { success: false, message: data?.error || 'Google Sheet returned an error response' };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reach Google Sheet webhook';
    console.warn('[GoogleSheetSync]: Failed to post to webhook:', message);
    return { success: false, message };
  }
}

/**
 * Dedicated Real-Time Exam Sheet Creator & Student Result Recorder
 * Creates a dedicated tab in Google Sheet: "Exam - [Exam Title]"
 * and writes the student's name, batch, score, and breakdown.
 */
export async function syncExamResult(result: ExamResultPayload) {
  try {
    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) return;

    // Run in background without awaiting in the main request pipeline
    postToGoogleSheet({
      action: 'record_exam_result',
      ...result
    }).catch(err => {
      console.warn('[GoogleSheetSync ExamResult Error]:', err);
    });
  } catch (err) {
    console.warn('[GoogleSheetSync ExamResult]:', err);
  }
}

/**
 * Real-Time Batch Creation Backup
 */
export async function syncBatchCreated(batch: Batch) {
  try {
    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) return;

    const headers = ['Batch ID', 'Batch Name', 'Description', 'Student Count', 'Created At', 'Status'];
    const row = [
      batch.id,
      batch.name,
      batch.description || 'N/A',
      batch.student_count || 0,
      batch.created_at || new Date().toISOString(),
      batch.status
    ];

    postToGoogleSheet({
      action: 'sync_event',
      sheet_name: 'Batches',
      headers,
      row
    }).catch(() => {});
  } catch {}
}

/**
 * Real-Time Student Registration Backup
 */
export async function syncStudentCreated(student: UserProfile, batchNames: string[] = []) {
  try {
    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) return;

    const headers = ['Roll / Student ID', 'Full Name', 'Email', 'Batches', 'Phone', 'Created At', 'Status'];
    const row = [
      student.student_id || 'N/A',
      student.name,
      student.email,
      batchNames.join(', ') || 'None',
      student.phone || 'N/A',
      student.created_at || new Date().toISOString(),
      student.status
    ];

    postToGoogleSheet({
      action: 'sync_event',
      sheet_name: 'Students',
      headers,
      row
    }).catch(() => {});
  } catch {}
}

/**
 * Real-Time Assignment Creation Backup
 */
export async function syncAssignmentCreated(assignment: Assignment, batchNames: string[] = []) {
  try {
    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) return;

    const headers = ['Assignment ID', 'Title', 'Subject', 'Target Batches', 'Max Score', 'Deadline', 'Status', 'Created At'];
    const row = [
      assignment.id,
      assignment.title,
      assignment.subject,
      batchNames.join(', ') || 'All Batches',
      assignment.max_score,
      assignment.deadline,
      assignment.status,
      assignment.created_at || new Date().toISOString()
    ];

    postToGoogleSheet({
      action: 'sync_event',
      sheet_name: 'Assignments',
      headers,
      row
    }).catch(() => {});
  } catch {}
}

/**
 * Real-Time Homework Submission Backup
 */
export async function syncAssignmentSubmission(
  submission: AssignmentSubmission,
  studentName: string,
  assignmentTitle: string,
  batchName: string
) {
  try {
    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) return;

    const headers = ['Submission ID', 'Student Name', 'Assignment Title', 'Batch', 'Submitted At', 'Is Late', 'Marks', 'Status'];
    const row = [
      submission.id,
      studentName,
      assignmentTitle,
      batchName || 'General',
      submission.submitted_at || new Date().toISOString(),
      submission.is_late ? 'YES' : 'NO',
      submission.marks_awarded !== null && submission.marks_awarded !== undefined ? submission.marks_awarded : 'Pending',
      submission.status
    ];

    postToGoogleSheet({
      action: 'sync_event',
      sheet_name: 'Submissions',
      headers,
      row
    }).catch(() => {});
  } catch {}
}

/**
 * Real-Time Exam Creation Backup
 */
export async function syncExamCreated(exam: Exam, batchNames: string[] = []) {
  try {
    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    if (!webhookUrl) return;

    const headers = ['Exam ID', 'Exam Title', 'Total Questions', 'Duration (Mins)', 'Max Marks', 'Target Batches', 'Scheduled Date', 'Status'];
    const row = [
      exam.id,
      exam.title,
      exam.total_questions,
      exam.duration_minutes,
      exam.max_marks,
      batchNames.join(', ') || 'All Batches',
      exam.created_at || new Date().toISOString(),
      exam.status
    ];

    postToGoogleSheet({
      action: 'sync_event',
      sheet_name: 'Exams',
      headers,
      row
    }).catch(() => {});
  } catch {}
}

/**
 * 1-Click Full Database Backup to Google Sheets
 * Exports all existing tables to organized tabs
 */
export async function syncFullDatabaseBackup() {
  const batches = dbService.getAllBatches() || [];
  const students = dbService.getAllStudents() || [];
  const assignments = dbService.getAllAssignments() || [];
  const exams = dbService.getAllExams() || [];

  const datasets: Record<string, { headers: string[]; rows: (string | number)[][] }> = {
    Batches: {
      headers: ['Batch ID', 'Batch Name', 'Description', 'Student Count', 'Created At', 'Status'],
      rows: batches.map(b => [
        b.id,
        b.name,
        b.description || '',
        b.student_count || 0,
        b.created_at,
        b.status
      ])
    },
    Students: {
      headers: ['Roll / Student ID', 'Full Name', 'Email', 'Batches', 'Phone', 'Created At', 'Status'],
      rows: students.map(s => [
        s.student_id || '',
        s.name,
        s.email,
        (s.batches || []).join(', '),
        s.phone || '',
        s.created_at,
        s.status
      ])
    },
    Assignments: {
      headers: ['Assignment ID', 'Title', 'Subject', 'Target Batches', 'Max Score', 'Submissions', 'Deadline', 'Status'],
      rows: assignments.map(a => [
        a.id,
        a.title,
        a.subject,
        (a.recipient_batch_names || []).join(', '),
        a.max_score,
        a.submission_count || 0,
        a.deadline,
        a.status
      ])
    },
    Exams: {
      headers: ['Exam ID', 'Exam Title', 'Total Questions', 'Duration (Mins)', 'Max Marks', 'Target Batches', 'Attempts', 'Created At', 'Status'],
      rows: exams.map(e => [
        e.id,
        e.title,
        e.total_questions,
        e.duration_minutes,
        e.max_marks,
        (e.recipient_batch_names || []).join(', '),
        e.attempt_count || 0,
        e.created_at,
        e.status
      ])
    }
  };

  return postToGoogleSheet({
    action: 'full_backup',
    datasets
  });
}

/**
 * Syncs all student attempts for a specific exam into that exam's dedicated sheet tab!
 */
export async function syncAllAttemptsForExam(examId: string) {
  const exam = dbService.getExamById(examId);
  if (!exam) throw new Error('Exam not found');

  const evalData = dbService.getExamEvaluationsMonitoring({ exam_id: examId });
  const attempts = evalData.attempts || [];

  let syncedCount = 0;
  for (const att of attempts) {
    if (att.status === 'completed' || att.status === 'in_progress') {
      await postToGoogleSheet({
        action: 'record_exam_result',
        exam_id: exam.id,
        exam_title: exam.title,
        student_id: att.student_id_code || att.student_id,
        student_id_code: att.student_id_code,
        student_name: att.student_name,
        student_email: att.student_email,
        batch_name: att.batch_name,
        score: att.total_score !== null && att.total_score !== undefined ? att.total_score : 0,
        max_marks: att.exam_max_marks || exam.max_marks,
        percentage: att.percentage !== null && att.percentage !== undefined ? att.percentage : 0,
        accuracy: 100,
        time_spent_mins: Math.round((att.time_spent_seconds || 0) / 60),
        submitted_at: att.submitted_at || new Date().toISOString(),
        evaluation_status: att.evaluation_status || 'evaluated'
      });
      syncedCount++;
    }
  }

  return { success: true, count: syncedCount, exam_title: exam.title };
}

/**
 * Ping / Test the Webhook
 */
export async function pingGoogleSheet(webhookUrl?: string) {
  return postToGoogleSheet({ action: 'ping' }, webhookUrl);
}
