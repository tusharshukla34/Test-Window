import { NextRequest, NextResponse } from 'next/server';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';
import { verifyPassword, signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureCloudSyncReady();
    const body = await req.json();
    const { identifier, password, expectedRole } = body;

    if (!identifier || !password) {
      return NextResponse.json({
        error: expectedRole === 'student' ? 'Please enter your Student ID and password' : 'Please enter your Trainer ID/email and password'
      }, { status: 400 });
    }

    const cleanIdentifier = String(identifier).trim();
    let user: any = null;

    // Strict Rule: Students are ONLY allowed to log in via Student ID, NEVER by email
    if (expectedRole === 'student') {
      if (cleanIdentifier.includes('@')) {
        return NextResponse.json({
          error: 'Please log in using your Student ID.'
        }, { status: 400 });
      }

      user = dbService.getUserByStudentId(cleanIdentifier);
      if (!user) {
        return NextResponse.json({
          error: 'No student account found with this Student ID.'
        }, { status: 401 });
      }

      if (user.role !== 'student') {
        return NextResponse.json({
          error: 'Unauthorized access. This portal is for students only.'
        }, { status: 403 });
      }
    } else {
      // Trainer / Admin Login (Trainer Tushar: Tushar1234 or email)
      user = dbService.getUserByIdentifier(cleanIdentifier);
      if (!user) {
        user = dbService.getUserByEmail(cleanIdentifier);
      }
      if (!user) {
        user = dbService.getUserByStudentId(cleanIdentifier);
      }

      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials. User not found.' }, { status: 401 });
      }

      // Block student accounts attempting to log in via email on admin tab
      if (user.role === 'student') {
        return NextResponse.json({
          error: 'Student login is permitted ONLY via Student ID. Please switch to the Student Portal tab.'
        }, { status: 403 });
      }
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
