import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    await requireAuth();
    const { filename } = await params;

    // Prevent path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'data', 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      // Mock dummy content if mock-sample.pdf requested
      if (safeFilename === 'mock-sample.pdf') {
        const dummyContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Thermodynamics Assignment Report) /Author (Tushar Shukla Portal) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
        return new NextResponse(dummyContent, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="assignment-submission.pdf"'
          }
        });
      }
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}"`
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
