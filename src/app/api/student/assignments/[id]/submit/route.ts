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
    const body = await req.json();

    await ensureCloudSyncReady();

    const { text_response, file_url, file_name, file_size, file_mime, batch_id } = body;

    const studentBatches = dbService.getStudentBatches(session.userId);
    const asg = dbService.getAssignmentById(id);
    const matchingBatch = studentBatches.find(sb => asg?.target_batches?.includes(sb.id));
    const targetBatchId = batch_id || matchingBatch?.id || (studentBatches.length > 0 ? studentBatches[0].id : undefined);

    const submission = dbService.submitAssignment({
      assignment_id: id,
      student_id: session.userId,
      batch_id: targetBatchId,
      text_response,
      file_url,
      file_name,
      file_size,
      file_mime
    });

    await syncDatabaseToCloud();

    return NextResponse.json({ success: true, submission });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
