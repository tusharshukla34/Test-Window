import { NextRequest, NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, syncDatabaseToCloud } from '@/lib/db/database';

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

    const finalizedAttempt = dbService.finalizeExamAttempt(attempt_id, session.userId);

    await syncDatabaseToCloud();

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
