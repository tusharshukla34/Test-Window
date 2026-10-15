import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export async function GET() {
  try {
    const session = await requireStudent();
    await ensureCloudSyncReady();
    const exams = dbService.getExamsForStudent(session.userId);
    return NextResponse.json(exams);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch examinations';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
