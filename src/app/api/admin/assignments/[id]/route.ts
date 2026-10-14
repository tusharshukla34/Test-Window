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
