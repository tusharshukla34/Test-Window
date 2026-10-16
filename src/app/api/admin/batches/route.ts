import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const batches = dbService.getAllBatches();
    return NextResponse.json(batches, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch batches';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const body = await req.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Batch name is required (e.g. 9:00 AM, 1:00 PM, or 5:00 PM)' }, { status: 400 });
    }

    const batch = dbService.createBatch({
      name: name.trim(),
      description: description?.trim()
    });

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync
    try {
      const { syncBatchCreated } = await import('@/lib/services/googleSheets');
      syncBatchCreated(batch);
    } catch {}

    return NextResponse.json({ success: true, batch });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
