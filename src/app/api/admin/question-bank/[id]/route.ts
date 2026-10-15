import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await ensureCloudSyncReady();
    const deleted = dbService.deleteQuestion(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (err) {
        console.warn('[CLOUD SYNC (after)]:', err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete question';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
