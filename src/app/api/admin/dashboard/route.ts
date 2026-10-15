import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export async function GET() {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const stats = dbService.getAdminDashboardStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard stats';
    const status = message.toLowerCase().includes('unauthorized')
      ? 401
      : message.toLowerCase().includes('forbidden')
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
