import { NextRequest, NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStudent();
    const { id } = await params;

    await ensureCloudSyncReady();

    let result;
    try {
      result = dbService.getStudentExamResult(id, session.userId);
    } catch {
      await ensureCloudSyncReady(true);
      result = dbService.getStudentExamResult(id, session.userId);
    }
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve exam result';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

