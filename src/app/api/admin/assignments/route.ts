import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const assignments = dbService.getAllAssignments();
    return NextResponse.json(assignments, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch assignments';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const {
      title,
      subject,
      instructions,
      submission_type,
      allowed_formats,
      max_file_size_mb,
      max_score,
      rubric,
      allow_late_submissions,
      start_date,
      deadline,
      batch_ids
    } = body;

    if (!title || !subject || !instructions || !deadline || !batch_ids || batch_ids.length === 0) {
      return NextResponse.json({ error: 'Title, subject, instructions, deadline, and at least one target batch are required' }, { status: 400 });
    }

    const assignment = dbService.createAssignment({
      title,
      subject,
      instructions,
      submission_type: submission_type || 'both',
      allowed_formats: allowed_formats || ['pdf', 'docx', 'png', 'ipynb', 'py', 'zip'],
      max_file_size_mb: Number(max_file_size_mb) || 10,
      max_score: Number(max_score) || 100,
      rubric,
      allow_late_submissions: Boolean(allow_late_submissions),
      start_date,
      deadline,
      created_by: session.userId,
      batch_ids
    });

    // Notify all students in the assigned batches and collect recipient emails
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
              title: 'New Daily Homework Assigned',
              message: `Trainer Tushar Shukla assigned "${title}" for batch ${batchData.name}.`,
              type: 'assignment',
              link: `/student/assignments/${assignment.id}`
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
      const { sendTaskAssignedEmail } = await import('@/lib/services/emailNotifications');
      sendTaskAssignedEmail({
        title,
        subject,
        instructions,
        deadline,
        maxScore: Number(max_score) || 100,
        batchNames: batchNamesList.length > 0 ? batchNamesList : batch_ids,
        recipients: Array.from(studentRecipientsMap.values())
      }).catch(err => console.warn('[Task Email Sync]:', err));
    } catch (emailErr) {
      console.warn('[Task Email Error]:', emailErr);
    }

    await syncDatabaseToCloud();

    // Real-Time Google Sheet Sync
    try {
      const { syncAssignmentCreated } = await import('@/lib/services/googleSheets');
      const allBatches = dbService.getAllBatches() || [];
      const batchMap = new Map(allBatches.map(b => [b.id, b.name]));
      const bNames = (batch_ids || []).map((id: string) => batchMap.get(id) || id);
      syncAssignmentCreated(assignment, bNames);
    } catch {}

    return NextResponse.json({ success: true, assignment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create assignment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
