import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const student = dbService.getUserById(id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const batches = dbService.getStudentBatches(id);
    const assignments = dbService.getAssignmentsForStudent(id);
    const exams = dbService.getExamsForStudent(id);

    return NextResponse.json({
      student,
      batches,
      assignments,
      exams
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving student';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const updated = dbService.updateStudent(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating student';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
