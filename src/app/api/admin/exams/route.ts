import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function GET() {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const exams = dbService.getAllExams();
    return NextResponse.json(exams);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch exams';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    await ensureCloudSyncReady();
    const body = await req.json();

    const {
      title,
      description,
      instructions,
      duration_minutes,
      negative_marking,
      allow_pausing,
      batch_ids,
      question_ids
    } = body;

    if (!title || !duration_minutes || !batch_ids || batch_ids.length === 0 || !question_ids || question_ids.length === 0) {
      return NextResponse.json({ error: 'Title, duration, at least one target batch, and at least one question are required' }, { status: 400 });
    }

    const exam = dbService.createExam({
      title,
      description,
      instructions,
      duration_minutes: Number(duration_minutes) || 20,
      negative_marking: Number(negative_marking) || 0.25,
      allow_pausing: Boolean(allow_pausing),
      batch_ids,
      question_ids,
      created_by: session.userId
    });

    // Notify students in assigned batches and collect recipient emails
    const studentRecipientsMap = new Map<string, { name: string; email: string; student_id?: string | null }>();
    const batchNamesList: string[] = [];

    for (const bId of batch_ids) {
      const batchData = dbService.getBatchById(bId);
      if (batchData) {
        batchNamesList.push(batchData.name);
        if (batchData.students) {
          for (const stu of batchData.students) {
            dbService.createNotification({
              user_id: stu.id,
              title: 'New Online Examination Scheduled',
              message: `Trainer Tushar Shukla scheduled "${title}" (${duration_minutes} mins) for your batch.`,
              type: 'exam',
              link: `/student/exams/${exam.id}/instructions`
            });
            if (stu.email) {
              studentRecipientsMap.set(stu.id, {
                name: stu.name,
                email: stu.email,
                student_id: stu.student_id
              });
            }
          }
        }
      }
    }

    // Email Notification via Google Apps Script (Non-blocking)
    try {
      const { sendExamScheduledEmail } = await import('@/lib/services/emailNotifications');
      sendExamScheduledEmail({
        title,
        description,
        durationMinutes: Number(duration_minutes) || 20,
        totalQuestions: question_ids.length,
        negativeMarking: Number(negative_marking) || 0.25,
        batchNames: batchNamesList.length > 0 ? batchNamesList : batch_ids,
        recipients: Array.from(studentRecipientsMap.values())
      }).catch(err => console.warn('[Exam Email Sync]:', err));
    } catch (emailErr) {
      console.warn('[Exam Email Error]:', emailErr);
    }

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync
    try {
      const { syncExamCreated } = await import('@/lib/services/googleSheets');
      const allBatches = dbService.getAllBatches() || [];
      const batchMap = new Map(allBatches.map(b => [b.id, b.name]));
      const bNames = (batch_ids || []).map((id: string) => batchMap.get(id) || id);
      syncExamCreated(exam, bNames);
    } catch {}

    return NextResponse.json({ success: true, exam });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create exam';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
