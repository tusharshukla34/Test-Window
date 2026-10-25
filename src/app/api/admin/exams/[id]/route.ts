import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await ensureCloudSyncReady();
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await ensureCloudSyncReady();

    const body = await req.json();
    const updated = dbService.updateExam(id, {
      title: body.title,
      description: body.description,
      instructions: body.instructions,
      duration_minutes: body.duration_minutes !== undefined ? Number(body.duration_minutes) : undefined,
      negative_marking: body.negative_marking !== undefined ? Number(body.negative_marking) : undefined,
      passing_percentage: body.passing_percentage !== undefined ? Number(body.passing_percentage) : undefined,
      end_window: body.end_window
    });

    if (!updated) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (err) {
        console.warn('[CLOUD SYNC (after)]:', err);
      }
    });

    return NextResponse.json({ success: true, exam: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating exam';
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
    await ensureCloudSyncReady();

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
