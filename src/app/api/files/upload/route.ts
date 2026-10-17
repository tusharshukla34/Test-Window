import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUploadsDir } from '@/lib/db/database';
import fs from 'fs';
import path from 'path';

const ALLOWED_EXTENSIONS = new Set([
  // Notebooks & Data Science (Requested: .ipynb and code files)
  'ipynb',
  'py',
  'pyw',
  'r',
  'rmd',
  'csv',
  'tsv',
  'xlsx',
  'xls',

  // Programming Languages & Code
  'java',
  'class',
  'jar',
  'c',
  'cpp',
  'cc',
  'cxx',
  'h',
  'hpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'kts',
  'dart',
  'scala',
  'lua',
  'pl',
  'pm',
  'm',
  'asm',

  // Web & Scripting
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'vue',
  'svelte',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'cmd',

  // Database & Config
  'sql',
  'db',
  'sqlite',
  'sqlite3',
  'prisma',
  'json',
  'xml',
  'yaml',
  'yml',
  'toml',
  'ini',
  'txt',
  'md',
  'markdown',
  'log',

  // Code Packages & Archives
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',

  // Documents & Images
  'pdf',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg'
]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size exceeds maximum permitted limit (25 MB)' }, { status: 400 });
    }

    const originalName = file.name;
    const ext = originalName.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `File extension .${ext} is not allowed` }, { status: 400 });
    }

    const safeBaseName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const uploadDir = getUploadsDir();
    const filePath = path.join(uploadDir, safeBaseName);
    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      file_url: `/api/files/download/${safeBaseName}`,
      file_name: originalName,
      file_size: file.size,
      file_mime: file.type || 'application/octet-stream'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
