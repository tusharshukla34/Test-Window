import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export async function GET() {
  try {
    const session = await requireStudent();
    await ensureCloudSyncReady();
    const stats = dbService.getStudentDashboardStats(session.userId);
    return NextResponse.json({
      student: stats.student,
      batches: stats.batches,
      batch_breakdowns: stats.batch_breakdowns || []
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch student batches';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
