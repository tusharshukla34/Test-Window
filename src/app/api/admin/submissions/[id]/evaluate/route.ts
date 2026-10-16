import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await ensureCloudSyncReady();
    const body = await req.json();

    const { marks_awarded, feedback, release_draft } = body;

    if (marks_awarded === undefined || marks_awarded === null || isNaN(Number(marks_awarded))) {
      return NextResponse.json({ error: 'Please enter valid numerical marks' }, { status: 400 });
    }

    const updated = dbService.evaluateSubmission(id, {
      marks_awarded: Number(marks_awarded),
      feedback: feedback?.trim(),
      release_draft: Boolean(release_draft),
      evaluated_by: session.userId
    });

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (cloudErr) {
        console.warn('[CLOUD SYNC AFTER EVALUATION]:', cloudErr);
      }
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Evaluation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
