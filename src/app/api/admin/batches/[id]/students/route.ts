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
    const { student_id, student_ids } = body;

    const idsToAdd: string[] = [];
    if (Array.isArray(student_ids)) {
      idsToAdd.push(...student_ids.filter(Boolean));
    } else if (student_id) {
      idsToAdd.push(student_id);
    }

    if (idsToAdd.length === 0) {
      return NextResponse.json({ error: 'student_id or student_ids array is required' }, { status: 400 });
    }

    if (idsToAdd.length === 1) {
      dbService.addStudentToBatch(id, idsToAdd[0]);
    } else {
      dbService.addStudentsToBatch(id, idsToAdd);
    }

    await syncDatabaseToCloud();
    return NextResponse.json({ 
      success: true, 
      message: `${idsToAdd.length} student(s) added to batch`,
      count: idsToAdd.length 
    });
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
