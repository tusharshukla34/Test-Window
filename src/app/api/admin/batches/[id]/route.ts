import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const batch = dbService.getBatchById(id);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json(batch);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const updated = dbService.updateBatch(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, batch: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
