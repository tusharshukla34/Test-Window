import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService } from '@/lib/db/database';

export async function GET() {
  try {
    await requireAdmin();
    const batches = dbService.getAllBatches();
    return NextResponse.json(batches);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch batches';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Batch name is required (e.g. 9:00 AM, 1:00 PM, or 5:00 PM)' }, { status: 400 });
    }

    const batch = dbService.createBatch({
      name: name.trim(),
      description: description?.trim()
    });

    return NextResponse.json({ success: true, batch });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
