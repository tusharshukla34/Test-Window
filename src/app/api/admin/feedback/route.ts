import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const feedbacks = dbService.getAllFeedbacks(limit);
    return NextResponse.json({ feedbacks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch student feedbacks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();

    const body = await req.json();
    const { id, status, admin_note, user_id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Feedback ID is required.' }, { status: 400 });
    }

    const validStatuses = ['open', 'in_progress', 'resolved'];
    const safeStatus = validStatuses.includes(status) ? status : 'in_progress';

    const updated = dbService.updateFeedbackStatus(id, safeStatus, admin_note);
    if (!updated) {
      return NextResponse.json({ error: 'Feedback record not found.' }, { status: 404 });
    }

    // If student user_id is provided, send them a notification about their report status
    if (user_id && typeof user_id === 'string') {
      try {
        const statusLabel = safeStatus === 'resolved' ? 'Resolved ✅' : 'In Progress ⚙️';
        dbService.createNotification({
          user_id,
          title: `Report Update: ${statusLabel}`,
          message: admin_note ? `Trainer Note: "${admin_note.slice(0, 90)}"` : `Your report has been marked as ${safeStatus}.`,
          type: 'system',
          link: '/student/dashboard'
        });
      } catch (notifErr) {
        console.warn('[FEEDBACK STUDENT NOTIFICATION WARN]:', notifErr);
      }
    }

    // Sync updates to cloud in background
    try {
      syncDatabaseToCloud().catch(err => console.warn('[FEEDBACK ADMIN SYNC WARN]:', err));
    } catch {}

    return NextResponse.json({ success: true, message: 'Feedback updated successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update feedback';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
