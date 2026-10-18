import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    await ensureCloudSyncReady();

    const body = await req.json();
    const { old_password, new_password, confirm_password } = body;

    if (!old_password || !new_password) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (confirm_password !== undefined && new_password !== confirm_password) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match' },
        { status: 400 }
      );
    }

    if (typeof new_password !== 'string' || new_password.trim().length < 4) {
      return NextResponse.json(
        { error: 'New password must be at least 4 characters long' },
        { status: 400 }
      );
    }

    if (old_password === new_password) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      );
    }

    const userWithPw = dbService.getUserByIdentifier(session.userId);
    if (!userWithPw) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    // Verify current (old) password
    const isOldCorrect = await verifyPassword(old_password, userWithPw.password_hash);
    if (!isOldCorrect) {
      return NextResponse.json(
        { error: 'The current password you entered is incorrect' },
        { status: 400 }
      );
    }

    // Hash the new password and update in database
    const newHash = await hashPassword(new_password.trim());
    const updated = dbService.resetPassword(userWithPw.id, newHash);
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update password in database' },
        { status: 500 }
      );
    }

    // Optional notification in student inbox
    try {
      dbService.createNotification({
        user_id: userWithPw.id,
        title: 'Security Alert: Password Changed',
        message: 'Your account password was successfully updated.',
        type: 'system',
        link: '/student/dashboard'
      });
    } catch {}

    // Cloud sync to ensure persistent storage
    try {
      await syncDatabaseToCloud(true);
    } catch (syncErr) {
      console.warn('[CHANGE PASSWORD CLOUD SYNC WARN]:', syncErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully! Please use your new password for future logins.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to change password';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
