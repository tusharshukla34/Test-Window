import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET() {
  try {
    await requireAdmin();
    const questions = dbService.getAllQuestions();
    return NextResponse.json(questions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch question bank';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const { subject, topic, difficulty, question_text, options, correct_option_id, explanation, marks, negative_penalty } = body;

    if (!subject || !topic || !question_text || !options || !correct_option_id) {
      return NextResponse.json({ error: 'Subject, topic, question text, options, and correct answer key are required' }, { status: 400 });
    }

    const question = dbService.createQuestion({
      subject,
      topic,
      difficulty: difficulty || 'medium',
      question_text,
      options,
      correct_option_id,
      explanation,
      marks: Number(marks) || 1.0,
      negative_penalty: Number(negative_penalty) || 0.25,
      created_by: session.userId
    });

    return NextResponse.json({ success: true, question });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create question';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
