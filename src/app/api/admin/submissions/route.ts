import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const { searchParams } = new URL(req.url);
    const batch_id = searchParams.get('batch_id') || undefined;
    const assignment_id = searchParams.get('assignment_id') || undefined;
    const status = searchParams.get('status') || undefined;

    const queue = dbService.getAllSubmissionsQueue({
      batch_id,
      assignment_id,
      status
    });

    return NextResponse.json(queue);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving submissions';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
