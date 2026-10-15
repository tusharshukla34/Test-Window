import { NextRequest, NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStudent();
    const { id } = await params;

    await ensureCloudSyncReady();

    const sessionData = dbService.startOrResumeExamAttempt(id, session.userId);

    // Push attempt to cloud so all serverless instances immediately see this attempt
    await syncDatabaseToCloud();

    return NextResponse.json({
      success: true,
      attempt: sessionData.attempt,
      questions: sessionData.questions,
      responses: sessionData.responses,
      server_time: sessionData.server_time
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initialize exam attempt';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
