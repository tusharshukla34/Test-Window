import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/database';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { id: attemptId } = await context.params;
    const body = await req.json();

    if (!body.audit_reason || body.audit_reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'An audit reason is required when correcting and republishing a result.' },
        { status: 400 }
      );
    }

    const republished = dbService.republishExamResult(attemptId, user.id, {
      audit_reason: body.audit_reason,
      manual_marks: body.manual_marks,
      teacher_remarks: body.teacher_remarks,
      trainer_feedback: body.trainer_feedback
    });

    return NextResponse.json({ success: true, attempt: republished });
  } catch (err: unknown) {
    console.error('Error republishing attempt evaluation:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
