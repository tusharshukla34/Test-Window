import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET() {
  try {
    await requireAdmin();
    const stats = dbService.getAdminDashboardStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard stats';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
