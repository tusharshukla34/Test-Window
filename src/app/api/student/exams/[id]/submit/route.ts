import { NextRequest, NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';
import { syncExamResult } from '@/lib/services/googleSheets';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStudent();
    const { id } = await params;
    const body = await req.json();

    const { attempt_id } = body;
    if (!attempt_id) {
      return NextResponse.json({ error: 'attempt_id is required' }, { status: 400 });
    }

    await ensureCloudSyncReady();

    if (!dbService.getExamAttempt(attempt_id)) {
      await ensureCloudSyncReady(true);
    }

    const finalizedAttempt = dbService.finalizeExamAttempt(attempt_id, session.userId);

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync: Creates/updates dedicated exam sheet tab with student results
    try {
      const exam = dbService.getExamById(finalizedAttempt.exam_id);
      const student = dbService.getUserById(session.userId);
      const batch = finalizedAttempt.batch_id ? dbService.getBatchById(finalizedAttempt.batch_id) : null;

      if (exam && student) {
        syncExamResult({
          exam_id: exam.id,
          exam_title: exam.title,
          student_id: student.student_id || student.id,
          student_id_code: student.student_id,
          student_name: student.name,
          student_email: student.email,
          batch_name: batch?.name || 'General Batch',
          score: finalizedAttempt.total_score !== null && finalizedAttempt.total_score !== undefined ? finalizedAttempt.total_score : 0,
          max_marks: exam.max_marks,
          percentage: finalizedAttempt.percentage !== null && finalizedAttempt.percentage !== undefined ? finalizedAttempt.percentage : 0,
          accuracy: finalizedAttempt.accuracy !== null && finalizedAttempt.accuracy !== undefined ? finalizedAttempt.accuracy : 0,
          total_correct: finalizedAttempt.total_correct || 0,
          total_incorrect: finalizedAttempt.total_incorrect || 0,
          total_unattempted: finalizedAttempt.total_unattempted || 0,
          time_spent_mins: Math.round((finalizedAttempt.time_spent_seconds || 0) / 60),
          submitted_at: finalizedAttempt.submitted_at || new Date().toISOString(),
          evaluation_status: finalizedAttempt.evaluation_status || 'submitted'
        });
      }
    } catch (sheetErr) {
      console.warn('[RealTime GoogleSheet ExamSync]:', sheetErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Your examination has been submitted successfully. Your trainer will evaluate your answers and publish the results when they are ready.',
      attempt: {
        id: finalizedAttempt.id,
        exam_id: finalizedAttempt.exam_id,
        submitted_at: finalizedAttempt.submitted_at,
        status: finalizedAttempt.status,
        evaluation_status: finalizedAttempt.evaluation_status || 'pending_evaluation',
        is_published: false
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Exam submission failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
