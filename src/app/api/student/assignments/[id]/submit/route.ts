import { NextRequest, NextResponse, after } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStudent();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

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

    // Run cloud upload and Google Sheet sync in the background
    // This allows the student to receive a 200 OK in ~10ms without timing out!
    after(async () => {
      try {
        await syncDatabaseToCloud();
      } catch (cloudErr) {
        console.warn('[CLOUD SYNC AFTER SUBMISSION]:', cloudErr);
      }

      try {
        const { syncAssignmentSubmission } = await import('@/lib/services/googleSheets');
        const student = dbService.getUserById(session.userId);
        const batch = targetBatchId ? dbService.getBatchById(targetBatchId) : null;
        if (asg && student) {
          syncAssignmentSubmission(submission, student.name, asg.title, batch?.name || 'General');
        }
      } catch (sheetErr) {
        console.warn('[GOOGLE SHEET AFTER SUBMISSION]:', sheetErr);
      }
    });

    return NextResponse.json({ success: true, submission });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
