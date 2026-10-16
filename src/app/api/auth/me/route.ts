import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await ensureCloudSyncReady();

    const user = dbService.getUserById(session.userId) || dbService.getUserByEmail(session.email);
    if (user) {
      return NextResponse.json({
        authenticated: true,
        user
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    }

    // Resilient fallback using signed session payload if DB record lookup is syncing
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        student_id: session.studentId || null,
        name: session.name,
        email: session.email,
        role: session.role,
        avatar_url: null
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Auth verification error';
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}

