import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const { searchParams } = new URL(req.url);
    const batch_id = searchParams.get('batch_id') || undefined;
    const format = searchParams.get('format');

    const matrix = dbService.getAssignmentMatrix(batch_id);

    if (format === 'csv') {
      // Build CSV content
      const headers = ['Student ID', 'Student Name', 'Batches', ...matrix.assignments.map(a => `"${a.title.replace(/"/g, '""')}"`)];
      const rows = matrix.rows.map(r => {
        const rowData = [
          `"${r.student.student_id || ''}"`,
          `"${r.student.name.replace(/"/g, '""')}"`,
          `"${r.batch_names.join(', ')}"`,
          ...matrix.assignments.map(a => {
            const cell = r.assignments[a.id];
            if (!cell) return '"Not Assigned"';
            if (cell.status === 'Evaluated') {
              return `"${cell.marks}/${cell.max_score} (Evaluated)"`;
            }
            return `"${cell.status}"`;
          })
        ];
        return rowData.join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="assignment-monitoring-matrix.csv"'
        }
      });
    }

    return NextResponse.json(matrix);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate matrix';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
