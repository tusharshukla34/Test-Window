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

    return NextResponse.json({ success: true, attempt: updated });
  } catch (err: unknown) {
    console.error('Error saving attempt evaluation:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
