import { NextRequest, NextResponse, after } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStudent();
    const { id } = await params;
    const body = await req.json();

    const { attempt_id, question_id, selected_option_id, is_marked_for_review, is_visited, time_spent_seconds } = body;

    if (!attempt_id || !question_id) {
      return NextResponse.json({ error: 'attempt_id and question_id are required' }, { status: 400 });
    }

    await ensureCloudSyncReady();

    if (!dbService.getExamAttempt(attempt_id)) {
      await ensureCloudSyncReady(true);
    }

    const result = dbService.autosaveExamResponse(attempt_id, session.userId, question_id, {
      selected_option_id,
      is_marked_for_review,
      is_visited,
      time_spent_seconds
    });

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch {}
    });

    return NextResponse.json({
      success: true,
      saved: result.saved,
      remaining_seconds: result.remaining_seconds
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Autosave failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
