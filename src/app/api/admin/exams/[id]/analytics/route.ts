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
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');

    const analytics = dbService.getExamAnalytics(id);

    if (format === 'csv') {
      const headers = ['Rank', 'Student ID', 'Student Name', 'Batch', 'Score', 'Max Marks', 'Percentage', 'Accuracy %', 'Time Taken (s)', 'Status'];
      const rows = analytics.attempts.map(att => [
        att.rank || '-',
        `"${att.student_id_code}"`,
        `"${att.student_name.replace(/"/g, '""')}"`,
        `"${att.batch_name}"`,
        att.total_score !== null ? att.total_score : 'In Progress',
        analytics.exam.max_marks,
        att.percentage !== null ? `${att.percentage}%` : '-',
        att.accuracy !== null ? `${att.accuracy}%` : '-',
        att.time_spent_seconds,
        att.status
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="exam-results-${id}.csv"`
        }
      });
    }

    return NextResponse.json(analytics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve exam analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
