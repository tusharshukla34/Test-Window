import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET() {
  try {
    const session = await requireStudent();
    const stats = dbService.getStudentDashboardStats(session.userId);
    return NextResponse.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch student dashboard';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
