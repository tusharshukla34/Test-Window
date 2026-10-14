import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const { id } = await params;
    const body = await req.json();
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    dbService.addStudentToBatch(id, student_id);
    await syncDatabaseToCloud();
    return NextResponse.json({ success: true, message: 'Student added to batch' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error adding student to batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get('student_id');

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required in query params' }, { status: 400 });
    }

    dbService.removeStudentFromBatch(id, student_id);
    await syncDatabaseToCloud();
    return NextResponse.json({ success: true, message: 'Student removed from batch' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error removing student from batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
