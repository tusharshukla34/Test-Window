import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUploadsDir } from '@/lib/db/database';
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
    const filePath = path.join(getUploadsDir(), safeFilename);

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

    const ext = safeFilename.split('.').pop()?.toLowerCase() || '';
    let mimeType = 'application/octet-stream';
    let isInline = false;

    if (['jpg', 'jpeg'].includes(ext)) {
      mimeType = 'image/jpeg';
      isInline = true;
    } else if (ext === 'png') {
      mimeType = 'image/png';
      isInline = true;
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
      isInline = true;
    } else if (ext === 'gif') {
      mimeType = 'image/gif';
      isInline = true;
    } else if (ext === 'pdf') {
      mimeType = 'application/pdf';
      isInline = true;
    } else if (ext === 'txt') {
      mimeType = 'text/plain';
      isInline = true;
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': isInline ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
