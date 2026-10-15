import { NextRequest, NextResponse } from 'next/server';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    await ensureCloudSyncReady();

    const body = await req.json();
    const { exam_id, batch_id, student_ids, audit_note } = body;

    if (!exam_id || !batch_id) {
      return NextResponse.json(
        { error: 'Both exam_id and batch_id are required to publish batch results.' },
        { status: 400 }
      );
    }

    const result = dbService.publishExamResults({
      exam_id,
      batch_id,
      student_ids,
      trainer_id: user.id,
      audit_note
    });

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync for Dedicated Exam Sheet Tab
    try {
      const { syncAllAttemptsForExam } = await import('@/lib/services/googleSheets');
      syncAllAttemptsForExam(exam_id).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      published_count: result.published_count,
      student_names: result.student_names,
      message: `Successfully published examination results for ${result.published_count} student(s).`
    });
  } catch (err: unknown) {
    console.error('Error publishing batch examination results:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
