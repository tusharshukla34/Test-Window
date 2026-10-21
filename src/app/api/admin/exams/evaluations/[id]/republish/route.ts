import { NextRequest, NextResponse } from 'next/server';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    await ensureCloudSyncReady();

    const { id: attemptId } = await context.params;
    const body = await req.json();

    if (!body.audit_reason || body.audit_reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'An audit reason is required when correcting and republishing a result.' },
        { status: 400 }
      );
    }

    const republished = dbService.republishExamResult(attemptId, user.id, {
      audit_reason: body.audit_reason,
      manual_marks: body.manual_marks,
      teacher_remarks: body.teacher_remarks,
      trainer_feedback: body.trainer_feedback
    });

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync: Updates student result in dedicated exam sheet tab automatically
    try {
      const exam = dbService.getExamById(republished.exam_id);
      const student = dbService.getUserById(republished.student_id);
      const batch = republished.batch_id ? dbService.getBatchById(republished.batch_id) : null;
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
          score: republished.total_score !== null && republished.total_score !== undefined ? republished.total_score : 0,
          max_marks: exam.max_marks,
          percentage: republished.percentage !== null && republished.percentage !== undefined ? republished.percentage : 0,
          accuracy: republished.accuracy !== null && republished.accuracy !== undefined ? republished.accuracy : 0,
          total_correct: republished.total_correct || 0,
          total_incorrect: republished.total_incorrect || 0,
          total_unattempted: republished.total_unattempted || 0,
          time_spent_mins: Math.round((republished.time_spent_seconds || 0) / 60),
          submitted_at: republished.submitted_at || new Date().toISOString(),
          evaluation_status: republished.evaluation_status || 'evaluated'
        });
      }
    } catch {}

    return NextResponse.json({ success: true, attempt: republished });
  } catch (err: unknown) {
    console.error('Error republishing attempt evaluation:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
