import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { new_password } = body;

    if (!new_password || new_password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const hash = await hashPassword(new_password);
    const success = dbService.resetPassword(id, hash);

    if (!success) {
      return NextResponse.json({ error: 'Failed to reset password. Student not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resetting password';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
