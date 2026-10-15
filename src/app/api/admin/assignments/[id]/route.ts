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
    const assignment = dbService.getAssignmentById(id);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    const submissions = dbService.getAllSubmissionsQueue({ assignment_id: id });

    return NextResponse.json({ assignment, submissions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving assignment';
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

    const success = dbService.deleteAssignment(id);
    if (!success) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (err) {
        console.warn('[CLOUD SYNC (after)]:', err);
      }
    });

    return NextResponse.json({ success: true, message: 'Assignment permanently deleted' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error deleting assignment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
