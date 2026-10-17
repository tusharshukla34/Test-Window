import { NextRequest, NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await requireStudent();
    await ensureCloudSyncReady();

    const feedbacks = dbService.getStudentFeedbacks(session.userId);
    return NextResponse.json({ feedbacks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch feedbacks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStudent();
    await ensureCloudSyncReady();

    const body = await req.json();
    const { category, title, description, device_info, page_url } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Please provide a clear title (at least 3 characters).' }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return NextResponse.json({ error: 'Please provide details or steps to describe the issue (at least 5 characters).' }, { status: 400 });
    }

    const validCategories = ['bug', 'dashboard', 'assignment', 'exam', 'suggestion', 'other'];
    const safeCategory = validCategories.includes(category) ? category : 'bug';

    const result = dbService.createFeedback({
      user_id: session.userId,
      category: safeCategory,
      title: title.trim().slice(0, 120),
      description: description.trim().slice(0, 3000),
      device_info: typeof device_info === 'string' ? device_info.slice(0, 300) : undefined,
      page_url: typeof page_url === 'string' ? page_url.slice(0, 300) : undefined
    });

    // Safely sync to cloud DB in background
    try {
      syncDatabaseToCloud().catch(err => console.warn('[FEEDBACK CLOUD SYNC WARN]:', err));
    } catch {}

    return NextResponse.json({
      success: true,
      feedbackId: result.id,
      message: 'Thank you! Your feedback and error report have been delivered directly to Trainer Tushar.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit feedback';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
