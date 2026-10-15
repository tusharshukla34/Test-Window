import { NextRequest, NextResponse } from 'next/server';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { id: attemptId } = await context.params;
    await ensureCloudSyncReady();
    const evaluationData = dbService.getAttemptForEvaluation(attemptId);
    return NextResponse.json(evaluationData);
  } catch (err: unknown) {
    console.error('Error fetching attempt for evaluation:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { id: attemptId } = await context.params;
    await ensureCloudSyncReady();
    const body = await req.json();

    const updated = dbService.saveAttemptEvaluation(attemptId, user.id, {
      status: body.status || 'in_progress',
      manual_marks: body.manual_marks,
      teacher_remarks: body.teacher_remarks,
      trainer_feedback: body.trainer_feedback,
      audit_reason: body.audit_reason
    });

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync: Updates student result in dedicated exam sheet tab automatically
    try {
      const exam = dbService.getExamById(updated.exam_id);
      const student = dbService.getUserById(updated.student_id);
      const batch = updated.batch_id ? dbService.getBatchById(updated.batch_id) : null;
      if (exam && student) {
        const { syncExamResult } = await import('@/lib/services/googleSheets');
        syncExamResult({
          exam_id: exam.id,
          exam_title: exam.title,
          student_id: student.student_id || student.id,
          student_id_code: student.student_id,
          student_name: student.name,
          student_email: student.email,
          batch_name: batch?.name || 'General Batch',
          score: updated.total_score !== null && updated.total_score !== undefined ? updated.total_score : 0,
          max_marks: exam.max_marks,
          percentage: updated.percentage !== null && updated.percentage !== undefined ? updated.percentage : 0,
          accuracy: updated.accuracy !== null && updated.accuracy !== undefined ? updated.accuracy : 0,
          total_correct: updated.total_correct || 0,
          total_incorrect: updated.total_incorrect || 0,
          total_unattempted: updated.total_unattempted || 0,
          time_spent_mins: Math.round((updated.time_spent_seconds || 0) / 60),
          submitted_at: updated.submitted_at || new Date().toISOString(),
          evaluation_status: updated.evaluation_status || 'evaluated'
        });
      }
    } catch {}

    return NextResponse.json({ success: true, attempt: updated });
  } catch (err: unknown) {
    console.error('Error saving attempt evaluation:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
