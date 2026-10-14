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

    const eligibility = dbService.getStudentExamEligibility(id, session.userId);
    if (!eligibility.is_eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 403 });
    }

    const exam = dbService.getExamById(id);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const student = dbService.getUserById(session.userId);

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        duration_minutes: exam.duration_minutes,
        total_questions: exam.total_questions,
        max_marks: exam.max_marks,
        marks_per_question: exam.marks_per_question,
        negative_marking: exam.negative_marking,
        allow_pausing: exam.allow_pausing
      },
      candidate: {
        id: student?.id,
        name: student?.name,
        student_id: student?.student_id
      },
      attempt: eligibility.attempt || null
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving exam instructions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
