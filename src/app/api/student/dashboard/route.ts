import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await requireStudent();
    await ensureCloudSyncReady();
    const stats = dbService.getStudentDashboardStats(session.userId);
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch student dashboard';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
