import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/database';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student access required.' }, { status: 403 });
    }

    const results = dbService.getStudentExamSubmissions(user.id);
    return NextResponse.json(results);
  } catch (err: unknown) {
    console.error('Error fetching student exam submissions:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
