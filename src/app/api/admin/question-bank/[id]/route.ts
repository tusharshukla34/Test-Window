import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await ensureCloudSyncReady();
    const body = await req.json();

    const {
      subject,
      topic,
      difficulty,
      question_type,
      coding_language,
      code_template,
      allowed_file_types,
      max_file_size_mb,
      question_text,
      options,
      correct_option_id,
      explanation,
      marks,
      negative_penalty
    } = body;

    const updated = dbService.updateQuestion(id, {
      subject,
      topic,
      difficulty,
      question_type,
      coding_language,
      code_template,
      allowed_file_types,
      max_file_size_mb: max_file_size_mb !== undefined ? Number(max_file_size_mb) : undefined,
      question_text,
      options,
      correct_option_id,
      explanation,
      marks: marks !== undefined ? Number(marks) : undefined,
      negative_penalty: negative_penalty !== undefined ? Number(negative_penalty) : undefined
    });

    if (!updated) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    await syncDatabaseToCloud();

    return NextResponse.json({ success: true, question: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update question';
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
    const deleted = dbService.deleteQuestion(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (err) {
        console.warn('[CLOUD SYNC (after)]:', err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete question';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
