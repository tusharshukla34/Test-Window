import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { dbService, ensureCloudSyncReady, syncDatabaseToCloud } from '@/lib/db/database';

export async function GET() {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();
    const students = dbService.getAllStudents();
    return NextResponse.json(students);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch students';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    const { name, email, student_id, password, phone, batch_ids } = body;

    if (!name || !email || !student_id || !password) {
      return NextResponse.json({ error: 'Name, email, student ID, and temporary password are required' }, { status: 400 });
    }

    // Check duplicate
    if (dbService.getUserByEmail(email)) {
      return NextResponse.json({ error: 'A student with this email address already exists' }, { status: 400 });
    }

    if (dbService.getUserByStudentId(student_id)) {
      return NextResponse.json({ error: 'A student with this Student ID already exists' }, { status: 400 });
    }

    const password_hash = await hashPassword(password);
    const newStudent = dbService.createStudent({
      name,
      email,
      student_id,
      password_hash,
      phone,
      batch_ids
    });

    await syncDatabaseToCloud();

    return NextResponse.json({ success: true, student: newStudent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create student';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
