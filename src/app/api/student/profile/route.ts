import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, signToken, COOKIE_NAME } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    await ensureCloudSyncReady();

    const body = await req.json();
    const { name, avatar_url } = body;

    // Strict validation: students CANNOT change their registered name
    if (session.role === 'student' && name !== undefined && name.trim() !== session.name) {
      return NextResponse.json(
        { error: 'Students cannot change their registered name. Please contact your trainer.' },
        { status: 403 }
      );
    }

    if (name !== undefined && session.role === 'admin') {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json({ error: 'Name must be at least 2 characters long' }, { status: 400 });
      }
      if (name.trim().length > 60) {
        return NextResponse.json({ error: 'Name cannot exceed 60 characters' }, { status: 400 });
      }
    }

    if (avatar_url !== undefined && avatar_url !== null) {
      if (typeof avatar_url !== 'string' || avatar_url.length > 500000) {
        return NextResponse.json({ error: 'Avatar image too large or invalid' }, { status: 400 });
      }
    }

    // Only allow admin to change display name; students can only update photo
    const updatedUser = dbService.updateStudentSelfProfile(session.userId, {
      name: session.role === 'admin' && name !== undefined ? name.trim() : undefined,
      avatar_url: avatar_url !== undefined ? avatar_url : undefined
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Refresh the session JWT with the updated name
    const newToken = await signToken({
      ...session,
      name: updatedUser.name
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Ensure database is pushed to Supabase cloud safely
    try {
      await syncDatabaseToCloud(true);
    } catch (syncErr) {
      console.warn('[PROFILE CLOUD SYNC ERROR]:', syncErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        student_id: updatedUser.student_id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar_url: updatedUser.avatar_url
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
