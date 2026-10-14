import { NextRequest, NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStudent();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const attempt_id = searchParams.get('attempt_id');

    if (!attempt_id) {
      return NextResponse.json({ error: 'attempt_id query param is required' }, { status: 400 });
    }

    const summary = dbService.getExamAttemptSummary(attempt_id, session.userId);
    return NextResponse.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving exam summary';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
