import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await ensureCloudSyncReady();

    const result = dbService.processExamDeadlines(id);
    await syncDatabaseToCloud();

    return NextResponse.json({
      success: true,
      processed_exams: result.processed_exams,
      auto_failed_count: result.auto_failed_count,
      message: `Finalized deadline. Evaluated ${result.auto_failed_count} absent student(s) as Failed.`
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to finalize exam deadline';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
