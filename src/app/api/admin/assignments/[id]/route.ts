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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const updated = dbService.updateAssignment(id, {
      title: body.title,
      subject: body.subject,
      instructions: body.instructions,
      submission_type: body.submission_type,
      allowed_formats: body.allowed_formats,
      max_file_size_mb: body.max_file_size_mb ? Number(body.max_file_size_mb) : undefined,
      max_score: body.max_score ? Number(body.max_score) : undefined,
      rubric: body.rubric,
      allow_late_submissions: body.allow_late_submissions !== undefined ? Boolean(body.allow_late_submissions) : undefined,
      deadline: body.deadline,
      batch_ids: body.batch_ids,
      status: body.status
    });

    if (!updated) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (err) {
        console.warn('[CLOUD SYNC (after assignment update)]:', err);
      }
    });

    return NextResponse.json({ success: true, assignment: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating assignment';
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
