import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();

    const { searchParams } = new URL(req.url);
    const batch_id = searchParams.get('batch_id') || undefined;

    const data = dbService.getAdminCalendarEvents({ batch_id });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch calendar events';
    const status = message.toLowerCase().includes('unauthorized')
      ? 401
      : message.toLowerCase().includes('forbidden')
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
