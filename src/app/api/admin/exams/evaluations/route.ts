import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/database';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batch_id = searchParams.get('batch_id') || 'all';
    const exam_id = searchParams.get('exam_id') || 'all';
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    const monitoringData = dbService.getExamEvaluationsMonitoring({
      batch_id,
      exam_id,
      status,
      search
    });

    return NextResponse.json(monitoringData);
  } catch (err: unknown) {
    console.error('Error in exam evaluations monitoring API:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
