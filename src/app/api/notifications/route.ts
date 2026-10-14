import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbService } from '@/lib/db/database';


export async function GET() {
  try {
    const session = await requireAuth();
    const notifications = dbService.getNotifications(session.userId);
    return NextResponse.json(notifications);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { notification_id } = body;

    if (notification_id) {
      dbService.markNotificationRead(notification_id, session.userId);
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update notification';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
