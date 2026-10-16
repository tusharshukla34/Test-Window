import { NextRequest, NextResponse } from 'next/server';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';
import { verifyPassword, signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureCloudSyncReady();
    const body = await req.json();
    const { identifier, password, expectedRole } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Please enter your username/email and password' }, { status: 400 });
    }

    // Check if identifier is an email, student/admin ID, or username
    let user = dbService.getUserByIdentifier(identifier);
    if (!user) {
      user = dbService.getUserByEmail(identifier);
    }
    if (!user) {
      user = dbService.getUserByStudentId(identifier);
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials. User not found.' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is deactivated. Please contact Trainer Tushar Shukla.' }, { status: 403 });
    }

    if (expectedRole && user.role !== expectedRole) {
      return NextResponse.json({
        error: `Unauthorized access. This portal is for ${expectedRole === 'admin' ? 'Trainers/Administrators' : 'Students'} only.`
      }, { status: 403 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password. Please try again.' }, { status: 401 });
    }

    // Generate JWT token
    const token = await signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
      studentId: user.student_id,
      name: user.name
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        avatar_url: user.avatar_url || null,
      },
      redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'
    });

    // Set HTTP-only cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (err: unknown) {
    console.error('[API AUTH LOGIN ERROR]:', err);
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
