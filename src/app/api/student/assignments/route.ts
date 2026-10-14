import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET() {
  try {
    const session = await requireStudent();
    const assignments = dbService.getAssignmentsForStudent(session.userId);
    return NextResponse.json(assignments);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch assignments';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
