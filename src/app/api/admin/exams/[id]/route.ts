import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, syncDatabaseToCloud } from '@/lib/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const exam = dbService.getExamById(id);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    return NextResponse.json(exam);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching exam';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const success = dbService.deleteExam(id);
    if (!success) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (err) {
        console.warn('[CLOUD SYNC (after)]:', err);
      }
    });

    return NextResponse.json({ success: true, message: 'Exam deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error deleting exam';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
