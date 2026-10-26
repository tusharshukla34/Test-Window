import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import {
  UserProfile,
  UserWithPassword,
  Batch,
  Assignment,
  AssignmentSubmission,
  QuestionBankItem,
  Exam,
  ExamAttempt,
  AttemptResponse,
  NotificationItem,
  MatrixStudentRow,
  ExamQuestionClient,
  StudentBatchBreakdown,
  CalendarEvent,
} from './types';

// Ensure data directory exists (supports writable /tmp on serverless environments like Vercel)
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION
);

const dataDir = isServerless ? path.join('/tmp', 'portal-data') : (process.env.DATA_DIR || path.join(process.cwd(), 'data'));

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.warn('[DB DATA DIR INIT]:', err);
}

export function getUploadsDir(): string {
  const dir = path.join(dataDir, 'uploads');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  return dir;
}

getUploadsDir();

const dbPath = path.join(dataDir, 'portal.db');
let db: InstanceType<typeof Database>;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.warn('[SQLITE DISK OPEN FAILED, FALLING BACK TO MEMORY]:', err);
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
}

export function getDatabasePath(): string {
  return dbPath;
}

let lastCheckedAt = 0;
let localVersionTag: string | null = null;
let syncLock: Promise<void> | null = null;

export function ensureAllMigrations(targetDb: InstanceType<typeof Database> = db): boolean {
  let changed = false;
  try {
    const getColumns = (tableName: string): Set<string> => {
      try {
        const rows = targetDb.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
        return new Set(rows.map(r => r.name));
      } catch {
        return new Set();
      }
    };

    // question_bank migrations
    const qbCols = getColumns('question_bank');
    if (qbCols.size > 0) {
      if (!qbCols.has('question_type')) {
        targetDb.exec(`ALTER TABLE question_bank ADD COLUMN question_type TEXT NOT NULL DEFAULT 'mcq'`);
        changed = true;
      }
      if (!qbCols.has('coding_language')) {
        targetDb.exec(`ALTER TABLE question_bank ADD COLUMN coding_language TEXT DEFAULT 'python'`);
        changed = true;
      }
      if (!qbCols.has('code_template')) {
        targetDb.exec(`ALTER TABLE question_bank ADD COLUMN code_template TEXT`);
        changed = true;
      }
      if (!qbCols.has('allowed_file_types')) {
        targetDb.exec(`ALTER TABLE question_bank ADD COLUMN allowed_file_types TEXT DEFAULT 'pdf,png,jpg,ipynb,zip,txt,py,java,cpp'`);
        changed = true;
      }
      if (!qbCols.has('max_file_size_mb')) {
        targetDb.exec(`ALTER TABLE question_bank ADD COLUMN max_file_size_mb INTEGER DEFAULT 10`);
        changed = true;
      }
    }

    // exams migrations
    const exCols = getColumns('exams');
    if (exCols.size > 0) {
      if (!exCols.has('is_deleted')) {
        targetDb.exec(`ALTER TABLE exams ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`);
        changed = true;
      }
      if (!exCols.has('passing_percentage')) {
        targetDb.exec(`ALTER TABLE exams ADD COLUMN passing_percentage REAL NOT NULL DEFAULT 40.0`);
        changed = true;
      }
      if (!exCols.has('start_window')) {
        targetDb.exec(`ALTER TABLE exams ADD COLUMN start_window TEXT`);
        changed = true;
      }
      if (!exCols.has('end_window')) {
        targetDb.exec(`ALTER TABLE exams ADD COLUMN end_window TEXT`);
        changed = true;
      }
    }

    // exam_attempts migrations
    const eaCols = getColumns('exam_attempts');
    if (eaCols.size > 0) {
      if (!eaCols.has('evaluation_status')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluation_status TEXT NOT NULL DEFAULT 'pending_evaluation'`);
        changed = true;
      }
      if (!eaCols.has('is_published')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0`);
        changed = true;
      }
      if (!eaCols.has('published_at')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN published_at TEXT`);
        changed = true;
      }
      if (!eaCols.has('published_by')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN published_by TEXT`);
        changed = true;
      }
      if (!eaCols.has('evaluated_at')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluated_at TEXT`);
        changed = true;
      }
      if (!eaCols.has('evaluated_by')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluated_by TEXT`);
        changed = true;
      }
      if (!eaCols.has('trainer_feedback')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN trainer_feedback TEXT`);
        changed = true;
      }
      if (!eaCols.has('evaluation_history')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluation_history TEXT DEFAULT '[]'`);
        changed = true;
      }
      if (!eaCols.has('fullscreen_exit_count')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN fullscreen_exit_count INTEGER NOT NULL DEFAULT 0`);
        changed = true;
      }
      if (!eaCols.has('proctoring_event_log')) {
        targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN proctoring_event_log TEXT DEFAULT '[]'`);
        changed = true;
      }
      if (!eaCols.has('is_absent')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN is_absent INTEGER NOT NULL DEFAULT 0`); changed = true; } catch {}
      }
      if (!eaCols.has('result_status')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN result_status TEXT DEFAULT 'pending'`); changed = true; } catch {}
      }
      if (!eaCols.has('exam_title')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN exam_title TEXT`); changed = true; } catch {}
      }
      if (!eaCols.has('exam_max_marks')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN exam_max_marks REAL`); changed = true; } catch {}
      }
      if (!eaCols.has('exam_duration_minutes')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN exam_duration_minutes INTEGER`); changed = true; } catch {}
      }
      if (!eaCols.has('exam_passing_percentage')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN exam_passing_percentage REAL DEFAULT 40.0`); changed = true; } catch {}
      }
      if (!eaCols.has('batch_name')) {
        try { targetDb.exec(`ALTER TABLE exam_attempts ADD COLUMN batch_name TEXT`); changed = true; } catch {}
      }
    }

    // attempt_responses migrations
    const arCols = getColumns('attempt_responses');
    if (arCols.size > 0) {
      if (!arCols.has('manual_marks')) {
        targetDb.exec(`ALTER TABLE attempt_responses ADD COLUMN manual_marks REAL`);
        changed = true;
      }
      if (!arCols.has('teacher_remarks')) {
        targetDb.exec(`ALTER TABLE attempt_responses ADD COLUMN teacher_remarks TEXT`);
        changed = true;
      }
      if (!arCols.has('descriptive_answer')) {
        targetDb.exec(`ALTER TABLE attempt_responses ADD COLUMN descriptive_answer TEXT`);
        changed = true;
      }
      if (!arCols.has('submitted_file_url')) {
        targetDb.exec(`ALTER TABLE attempt_responses ADD COLUMN submitted_file_url TEXT`);
        changed = true;
      }
      if (!arCols.has('submitted_file_name')) {
        targetDb.exec(`ALTER TABLE attempt_responses ADD COLUMN submitted_file_name TEXT`);
        changed = true;
      }
    }

    // Reconcile and auto-heal exam max_marks and attempt percentages
    try {
      const examsToCheck = targetDb.prepare(`SELECT id, max_marks, total_questions FROM exams`).all() as { id: string; max_marks: number; total_questions: number }[];
      for (const ex of examsToCheck) {
        const qSum = targetDb.prepare(`
          SELECT COALESCE(SUM(q.marks), 0) as total_marks, COUNT(q.id) as q_count
          FROM exam_questions eq
          JOIN question_bank q ON eq.question_id = q.id
          WHERE eq.exam_id = ?
        `).get(ex.id) as { total_marks: number; q_count: number };

        if (qSum.total_marks > 0 && Math.abs(ex.max_marks - qSum.total_marks) > 0.001) {
          const marksPerQ = qSum.q_count > 0 ? Number((qSum.total_marks / qSum.q_count).toFixed(2)) : 1.0;
          targetDb.prepare(`
            UPDATE exams 
            SET max_marks = ?, marks_per_question = ? 
            WHERE id = ?
          `).run(qSum.total_marks, marksPerQ, ex.id);

          targetDb.prepare(`
            UPDATE exam_attempts
            SET percentage = ROUND((total_score / ?) * 100, 1)
            WHERE exam_id = ? AND total_score IS NOT NULL
          `).run(qSum.total_marks, ex.id);

          changed = true;
        }
      }
    } catch (examHealErr) {
      console.warn('[ensureAllMigrations exam mark healing warning]:', examHealErr);
    }

    // Reconcile and auto-heal total_correct, total_incorrect, total_unattempted for all evaluated attempts
    try {
      const evaluatedAttempts = targetDb.prepare(`
        SELECT id, exam_id, is_absent, result_status FROM exam_attempts 
        WHERE evaluation_status IN ('evaluated', 'published') OR status = 'completed'
      `).all() as { id: string; exam_id: string; is_absent?: number; result_status?: string }[];

      for (const att of evaluatedAttempts) {
        if (att.is_absent === 1 || att.result_status === 'absent_fail') {
          // Absent candidate: never attended the exam -> exactly 0 correct, 0 incorrect, all unattempted
          const qCountRow = targetDb.prepare(`
            SELECT count(*) as cnt FROM exam_questions WHERE exam_id = ?
          `).get(att.exam_id) as { cnt: number } | undefined;
          const respCountRow = targetDb.prepare(`
            SELECT count(*) as cnt FROM attempt_responses WHERE attempt_id = ?
          `).get(att.id) as { cnt: number } | undefined;
          const totalQ = qCountRow?.cnt || respCountRow?.cnt || 0;

          targetDb.prepare(`
            UPDATE exam_attempts
            SET total_correct = 0, total_incorrect = 0, total_unattempted = ?
            WHERE id = ?
          `).run(totalQ, att.id);
          continue;
        }

        const resps = targetDb.prepare(`
          SELECT ar.manual_marks, ar.selected_option_id, ar.descriptive_answer, ar.submitted_file_url,
                 q.marks as q_marks, q.correct_option_id, q.question_type, q.code_template
          FROM attempt_responses ar
          JOIN question_bank q ON ar.question_id = q.id
          WHERE ar.attempt_id = ?
        `).all(att.id) as any[];

        let totalCorrect = 0;
        let totalIncorrect = 0;
        let totalUnattempted = 0;

        for (const r of resps) {
          const maxQMarks = Number(r.q_marks || 1);
          const isMcq = r.question_type === 'mcq';
          const isUnattempted = isMcq
            ? !r.selected_option_id
            : r.question_type === 'file_upload'
            ? !r.submitted_file_url
            : !(r.descriptive_answer && r.descriptive_answer.trim().length > 0 && r.descriptive_answer.trim() !== (r.code_template || '').trim());

          if (isUnattempted) {
            totalUnattempted++;
          } else if (r.manual_marks !== null && r.manual_marks !== undefined) {
            const m = Number(r.manual_marks);
            if (m >= maxQMarks) {
              totalCorrect++;
            } else if (m <= 0) {
              totalIncorrect++;
            } else {
              totalUnattempted++;
            }
          } else if (isMcq) {
            if (r.selected_option_id === r.correct_option_id) {
              totalCorrect++;
            } else {
              totalIncorrect++;
            }
          } else {
            totalUnattempted++;
          }
        }

        targetDb.prepare(`
          UPDATE exam_attempts
          SET total_correct = ?, total_incorrect = ?, total_unattempted = ?
          WHERE id = ?
        `).run(totalCorrect, totalIncorrect, totalUnattempted, att.id);
      }
    } catch (metricHealErr) {
      console.warn('[ensureAllMigrations attempt metrics healing warning]:', metricHealErr);
    }

    // Clean up any premature absent attempts generated before the exam deadline had passed,
    // or generated for exams with no deadline set.
    try {
      const allAbsentAttempts = targetDb.prepare(`
        SELECT ea.id, ea.exam_id, e.end_window
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE ea.is_absent = 1 OR ea.result_status = 'absent_fail'
      `).all() as { id: string; exam_id: string; end_window: string | null }[];

      const nowTime = Date.now();
      const invalidAttemptIds: string[] = [];

      for (const att of allAbsentAttempts) {
        if (!att.end_window || att.end_window.trim() === '') {
          // Exam had NO deadline set! Student was prematurely marked absent
          invalidAttemptIds.push(att.id);
        } else {
          const deadlineTimestamp = new Date(att.end_window).getTime();
          if (isNaN(deadlineTimestamp) || nowTime < deadlineTimestamp) {
            // Deadline is in the FUTURE! Student was prematurely marked absent
            invalidAttemptIds.push(att.id);
          }
        }
      }

      if (invalidAttemptIds.length > 0) {
        console.log(`[Auto-heal] Removing ${invalidAttemptIds.length} premature absent attempts (deadline not passed yet)...`);
        for (const attId of invalidAttemptIds) {
          targetDb.prepare('DELETE FROM attempt_responses WHERE attempt_id = ?').run(attId);
          targetDb.prepare('DELETE FROM exam_attempts WHERE id = ?').run(attId);
        }
      }
    } catch (cleanupErr) {
      console.warn('[Auto-heal premature absent attempts warning]:', cleanupErr);
    }

    // Backfill exam snapshots and result_status on exam_attempts so scorecards are permanent
    try {
      targetDb.prepare(`
        UPDATE exam_attempts
        SET exam_title = (SELECT title FROM exams WHERE exams.id = exam_attempts.exam_id),
            exam_max_marks = (SELECT max_marks FROM exams WHERE exams.id = exam_attempts.exam_id),
            exam_duration_minutes = (SELECT duration_minutes FROM exams WHERE exams.id = exam_attempts.exam_id),
            exam_passing_percentage = COALESCE((SELECT passing_percentage FROM exams WHERE exams.id = exam_attempts.exam_id), 40.0)
        WHERE (exam_title IS NULL OR exam_max_marks IS NULL) AND exam_id IN (SELECT id FROM exams)
      `).run();

      targetDb.prepare(`
        UPDATE exam_attempts
        SET result_status = CASE 
          WHEN is_absent = 1 THEN 'absent_fail'
          WHEN percentage >= COALESCE(exam_passing_percentage, 40.0) THEN 'pass'
          ELSE 'fail'
        END
        WHERE (result_status IS NULL OR result_status = 'pending') AND (status = 'completed' OR is_published = 1)
      `).run();
    } catch (backfillErr) {
      console.warn('[ensureAllMigrations snapshot backfill warning]:', backfillErr);
    }
  } catch (err) {
    console.warn('[ensureAllMigrations warning]:', err);
  }
  return changed;
}

export async function ensureCloudSyncReady(force = false): Promise<void> {
  if (!isServerless && !process.env.FORCE_CLOUD_SYNC) {
    ensureAllMigrations(db);
    return;
  }

  if (syncLock) {
    await syncLock;
    return;
  }

  const now = Date.now();
  if (!force && localVersionTag && now - lastCheckedAt < 2500) {
    ensureAllMigrations(db);
    return;
  }
  lastCheckedAt = now;

  syncLock = (async () => {
    try {
      const { getCloudDatabaseMetadata, pullDatabaseFromCloud } = await import('./cloudSync');
      const meta = await getCloudDatabaseMetadata();
      if (!meta) {
        ensureAllMigrations(db);
        return;
      }

      if (!localVersionTag || meta.versionTag !== localVersionTag) {
        const res = await pullDatabaseFromCloud(dbPath);
        if (res.success) {
          localVersionTag = res.versionTag || meta.versionTag;
          try {
            db.close();
          } catch {}
          db = new Database(dbPath);
          db.pragma('journal_mode = DELETE');
          db.pragma('foreign_keys = ON');
          initSchema();
          const changed = ensureAllMigrations(db);
          if (changed) {
            try {
              const { pushDatabaseToCloud } = await import('./cloudSync');
              const pushRes = await pushDatabaseToCloud(dbPath);
              if (pushRes.success) {
                localVersionTag = pushRes.versionTag;
              }
            } catch (syncErr) {
              console.warn('[CLOUD SYNC]: Auto-migration sync back warning:', syncErr);
            }
          }
        }
      } else {
        ensureAllMigrations(db);
      }
    } catch (err) {
      console.warn('[CLOUD SYNC]: ensureCloudSyncReady warning:', err);
      ensureAllMigrations(db);
    } finally {
      syncLock = null;
    }
  })();

  await syncLock;
}

let debouncePushTimer: NodeJS.Timeout | null = null;

export async function syncDatabaseToCloud(forceSync = false): Promise<boolean> {
  // On local machine / non-serverless:
  // Data is ALREADY written to SQLite disk in < 1ms.
  // We trigger cloud backup in the background so HTTP responses return in 5ms instead of waiting 2-4 seconds!
  if (!isServerless && !process.env.FORCE_CLOUD_SYNC && !forceSync) {
    if (debouncePushTimer) clearTimeout(debouncePushTimer);
    debouncePushTimer = setTimeout(async () => {
      try {
        const { pushDatabaseToCloud } = await import('./cloudSync');
        const res = await pushDatabaseToCloud(dbPath);
        if (res.success) {
          localVersionTag = res.versionTag;
          lastCheckedAt = Date.now();
        }
      } catch (err) {
        console.warn('[BACKGROUND CLOUD SYNC]:', err);
      }
    }, 300);
    return true;
  }

  // Serverless or forced synchronous upload
  try {
    const { pushDatabaseToCloud } = await import('./cloudSync');
    const res = await pushDatabaseToCloud(dbPath);
    if (res.success) {
      localVersionTag = res.versionTag;
      lastCheckedAt = Date.now();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[CLOUD SYNC]: Push warning:', err);
    return false;
  }
}

// Initialize database schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
      avatar_url TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batch_memberships (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (batch_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      instructions TEXT NOT NULL,
      submission_type TEXT NOT NULL CHECK (submission_type IN ('file_upload', 'text_response', 'both')),
      allowed_formats TEXT NOT NULL DEFAULT 'pdf,docx,xlsx,csv,txt,png,jpg,ipynb,py,java,cpp,c,cs,js,ts,html,css,sql,json,zip',
      max_file_size_mb INTEGER NOT NULL DEFAULT 10,
      max_score REAL NOT NULL DEFAULT 100,
      rubric TEXT,
      reference_file_url TEXT,
      reference_file_name TEXT,
      allow_late_submissions INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
      start_date TEXT NOT NULL DEFAULT (datetime('now')),
      deadline TEXT NOT NULL,
      created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignment_recipients (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
      student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (assignment_id, batch_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      version INTEGER NOT NULL DEFAULT 1,
      text_response TEXT,
      file_url TEXT,
      file_name TEXT,
      file_size INTEGER,
      file_mime TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_late INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'evaluated')),
      marks_awarded REAL,
      feedback TEXT,
      feedback_released INTEGER NOT NULL DEFAULT 0,
      evaluated_at TEXT,
      evaluated_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      UNIQUE (assignment_id, student_id, version)
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      instructions TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 20,
      total_questions INTEGER NOT NULL DEFAULT 20,
      max_marks REAL NOT NULL DEFAULT 20,
      marks_per_question REAL NOT NULL DEFAULT 1.0,
      negative_marking REAL NOT NULL DEFAULT 0.25,
      unattempted_deduction REAL NOT NULL DEFAULT 0.0,
      allow_pausing INTEGER NOT NULL DEFAULT 0,
      max_pauses INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
      result_release_policy TEXT NOT NULL DEFAULT 'immediate' CHECK (result_release_policy IN ('immediate', 'manual', 'after_deadline')),
      start_window TEXT,
      end_window TEXT,
      passing_percentage REAL NOT NULL DEFAULT 40.0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exam_batches (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      UNIQUE (exam_id, batch_id)
    );

    CREATE TABLE IF NOT EXISTS question_bank (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
      question_type TEXT NOT NULL DEFAULT 'mcq',
      coding_language TEXT DEFAULT 'python',
      code_template TEXT,
      allowed_file_types TEXT DEFAULT 'pdf,png,jpg,ipynb,zip,txt,py,java,cpp',
      max_file_size_mb INTEGER DEFAULT 10,
      question_text TEXT NOT NULL,
      question_image_url TEXT,
      options TEXT NOT NULL, -- JSON string array
      correct_option_id TEXT NOT NULL, -- PROTECTED server-side only
      explanation TEXT,
      marks REAL NOT NULL DEFAULT 1.0,
      negative_penalty REAL NOT NULL DEFAULT 0.25,
      created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
      question_order INTEGER NOT NULL,
      UNIQUE (exam_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      authoritative_deadline TEXT NOT NULL,
      submitted_at TEXT,
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      is_paused INTEGER NOT NULL DEFAULT 0,
      pause_count INTEGER NOT NULL DEFAULT 0,
      total_score REAL,
      total_correct INTEGER NOT NULL DEFAULT 0,
      total_incorrect INTEGER NOT NULL DEFAULT 0,
      total_unattempted INTEGER NOT NULL DEFAULT 0,
      percentage REAL,
      accuracy REAL,
      rank INTEGER,
      feedback TEXT,
      evaluation_status TEXT NOT NULL DEFAULT 'pending_evaluation',
      is_published INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      published_by TEXT,
      evaluated_at TEXT,
      evaluated_by TEXT,
      trainer_feedback TEXT,
      evaluation_history TEXT DEFAULT '[]',
      fullscreen_exit_count INTEGER NOT NULL DEFAULT 0,
      proctoring_event_log TEXT DEFAULT '[]',
      is_absent INTEGER NOT NULL DEFAULT 0,
      result_status TEXT DEFAULT 'pending',
      exam_title TEXT,
      exam_max_marks REAL,
      exam_duration_minutes INTEGER,
      exam_passing_percentage REAL DEFAULT 40.0,
      batch_name TEXT,
      UNIQUE (exam_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS attempt_responses (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
      selected_option_id TEXT,
      is_marked_for_review INTEGER NOT NULL DEFAULT 0,
      is_visited INTEGER NOT NULL DEFAULT 1,
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      is_correct INTEGER,
      score_awarded REAL,
      manual_marks REAL,
      teacher_remarks TEXT,
      descriptive_answer TEXT,
      submitted_file_url TEXT,
      submitted_file_name TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (attempt_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'assignment', 'exam', 'grade', 'system')),
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portal_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      device_info TEXT,
      page_url TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure all dynamic columns and migrations are applied
  ensureAllMigrations(db);

  // Ensure assignments table includes ipynb and coding formats
  try {
    const existingAsgs = db.prepare(`SELECT id, allowed_formats FROM assignments`).all() as { id: string; allowed_formats: string }[];
    for (const asg of existingAsgs) {
      if (asg.allowed_formats && !asg.allowed_formats.includes('ipynb')) {
        const expanded = `${asg.allowed_formats},ipynb,py,java,cpp,c,cs,js,ts,html,css,sql,json,zip`;
        db.prepare(`UPDATE assignments SET allowed_formats = ? WHERE id = ?`).run(expanded, asg.id);
      }
    }
  } catch {}

  // Ensure Admin credentials (ID: Tushar1234, Password: Tushar@0963)
  try {
    const adminPassHash = bcrypt.hashSync('Tushar@0963', 10);
    db.prepare(`
      UPDATE profiles 
      SET student_id = 'Tushar1234', 
          password_hash = ?
      WHERE role = 'admin' AND (id = 'usr-admin-tushar' OR role = 'admin')
    `).run(adminPassHash);
  } catch {}
}

// Seed initial demonstration data
function seedInitialData() {
  const adminCheck = db.prepare(`SELECT count(*) as count FROM profiles WHERE role = 'admin'`).get() as { count: number };
  if (adminCheck.count > 0) {
    return; // Already seeded
  }

  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('Password@123', salt);
  const adminPasswordHash = bcrypt.hashSync('Tushar@0963', salt);

  const insertProfile = db.prepare(`
    INSERT OR IGNORE INTO profiles (id, student_id, name, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin
  insertProfile.run(
    'usr-admin-tushar',
    'Tushar1234',
    'Tushar Shukla',
    'tushar@portal.edu',
    adminPasswordHash,
    'admin',
    'active'
  );

  // Demo Student
  insertProfile.run(
    'usr-student-demo-01',
    'STU-2026-001',
    'Aarav Sharma',
    'student@portal.edu',
    defaultPasswordHash,
    'student',
    'active'
  );

  // Question Bank: Initial seeding left empty (managed dynamically by trainer)
  const questionsData: any[] = [];

  // Create Exam: "Thermodynamics for All AE/JE ME Exams Mock Test"
  const insertExam = db.prepare(`
    INSERT INTO exams (id, title, description, instructions, duration_minutes, total_questions, max_marks, marks_per_question, negative_marking, unattempted_deduction, allow_pausing, max_pauses, status, result_release_policy, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const examInstructions = `General Instructions:
1. The test has 20 total questions.
2. Each question has 4 options out of which only one is correct.
3. You have to finish the test in 20 minutes.
4. You will be awarded 1 mark for each correct answer and 0.25 marks will be deducted for each wrong answer.
5. There is no negative marking for the questions that you have not attempted.
6. You can write this test only once. Make sure that you complete the test before you submit the test and/or close the browser.`;

  insertExam.run(
    'exam-thermo-mock-1',
    'Thermodynamics for All AE/JE ME Exams Mock Test',
    'Comprehensive mock examination covering basic and applied thermodynamic principles for AE/JE aspirants.',
    examInstructions,
    20,
    20,
    20.0,
    1.0,
    0.25,
    0.0,
    0,
    0,
    'published',
    'immediate',
    'usr-admin-tushar'
  );

  // Associate all 20 questions with the exam in order
  const insertExamQuestion = db.prepare(`
    INSERT INTO exam_questions (id, exam_id, question_id, question_order)
    VALUES (?, ?, ?, ?)
  `);

  questionsData.forEach((q, idx) => {
    insertExamQuestion.run(`eq-${idx + 1}`, 'exam-thermo-mock-1', q.id, idx + 1);
  });
}

// Run schema and seed
initSchema();
seedInitialData();

// ============================================================================
// DATA ACCESS METHODS
// ============================================================================

export const dbService = {
  // Profiles & Auth
  getUserByEmail(email: string): UserWithPassword | null {
    return (db.prepare('SELECT * FROM profiles WHERE lower(email) = lower(?)').get(email) as UserWithPassword) || null;
  },

  getUserByStudentId(studentId: string): UserWithPassword | null {
    return (db.prepare('SELECT * FROM profiles WHERE lower(student_id) = lower(?)').get(studentId) as UserWithPassword) || null;
  },

  getUserByIdentifier(identifier: string): UserWithPassword | null {
    return (
      (db.prepare(
        'SELECT * FROM profiles WHERE lower(email) = lower(?) OR lower(student_id) = lower(?) OR lower(id) = lower(?)'
      ).get(identifier, identifier, identifier) as UserWithPassword) || null
    );
  },

  getUserById(id: string): UserProfile | null {
    const row = db.prepare('SELECT id, student_id, name, email, role, avatar_url, phone, status, created_at, updated_at FROM profiles WHERE id = ? OR lower(student_id) = lower(?) OR lower(email) = lower(?)').get(id, id, id) as UserProfile;
    return row || null;
  },

  getAllStudents(): (UserProfile & { batches: string[] })[] {
    const students = db.prepare(`
      SELECT id, student_id, name, email, role, avatar_url, phone, status, created_at, updated_at
      FROM profiles
      WHERE role = 'student'
      ORDER BY name ASC
    `).all() as UserProfile[];

    const getBatches = db.prepare(`
      SELECT b.name FROM batches b
      JOIN batch_memberships bm ON b.id = bm.batch_id
      WHERE bm.user_id = ?
    `);

    return students.map(s => {
      const bRows = getBatches.all(s.id) as { name: string }[];
      return {
        ...s,
        batches: bRows.map(b => b.name)
      };
    });
  },

  createStudent(data: { name: string; email: string; student_id: string; password_hash: string; phone?: string; batch_ids?: string[] }): UserProfile {
    const id = `usr-stu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const stmt = db.prepare(`
      INSERT INTO profiles (id, student_id, name, email, password_hash, role, phone, status)
      VALUES (?, ?, ?, ?, ?, 'student', ?, 'active')
    `);
    stmt.run(id, data.student_id, data.name, data.email, data.password_hash, data.phone || null);

    if (data.batch_ids && data.batch_ids.length > 0) {
      const insMem = db.prepare('INSERT OR IGNORE INTO batch_memberships (id, batch_id, user_id) VALUES (?, ?, ?)');
      for (const bId of data.batch_ids) {
        insMem.run(`mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, bId, id);
      }
    }

    return this.getUserById(id)!;
  },

  updateStudent(id: string, data: { name?: string; email?: string; phone?: string; status?: 'active' | 'inactive'; batch_ids?: string[] }): UserProfile | null {
    const existing = this.getUserById(id);
    if (!existing) return null;

    if (data.name !== undefined || data.email !== undefined || data.phone !== undefined || data.status !== undefined) {
      db.prepare(`
        UPDATE profiles
        SET name = coalesce(?, name),
            email = coalesce(?, email),
            phone = coalesce(?, phone),
            status = coalesce(?, status),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(data.name || null, data.email || null, data.phone || null, data.status || null, id);
    }

    if (data.batch_ids) {
      // Re-sync batch memberships
      db.prepare('DELETE FROM batch_memberships WHERE user_id = ?').run(id);
      const insMem = db.prepare('INSERT INTO batch_memberships (id, batch_id, user_id) VALUES (?, ?, ?)');
      for (const bId of data.batch_ids) {
        insMem.run(`mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, bId, id);
      }
    }

    return this.getUserById(id);
  },

  updateStudentSelfProfile(id: string, data: { name?: string; avatar_url?: string | null }): UserProfile | null {
    const existing = this.getUserById(id);
    if (!existing) return null;

    const newName = data.name !== undefined ? data.name.trim() : existing.name;
    const newAvatar = data.avatar_url !== undefined ? data.avatar_url : (existing.avatar_url || null);

    db.prepare(`
      UPDATE profiles
      SET name = ?,
          avatar_url = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newName || existing.name, newAvatar, id);

    return this.getUserById(id);
  },

  resetPassword(userId: string, newHash: string): boolean {
    const res = db.prepare(`UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(newHash, userId);
    return res.changes > 0;
  },

  deleteStudent(id: string): boolean {
    const user = db.prepare('SELECT id, role FROM profiles WHERE id = ?').get(id) as { id: string; role: string } | undefined;
    if (!user || user.role !== 'student') return false;

    // Explicit cleanup of all student associations
    db.prepare('DELETE FROM batch_memberships WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM assignment_recipients WHERE student_id = ?').run(id);
    db.prepare('DELETE FROM assignment_submissions WHERE student_id = ?').run(id);

    const attempts = db.prepare('SELECT id FROM exam_attempts WHERE student_id = ?').all(id) as { id: string }[];
    for (const att of attempts) {
      db.prepare('DELETE FROM attempt_responses WHERE attempt_id = ?').run(att.id);
    }
    db.prepare('DELETE FROM exam_attempts WHERE student_id = ?').run(id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);

    const res = db.prepare("DELETE FROM profiles WHERE id = ? AND role = 'student'").run(id);
    return res.changes > 0;
  },

  // Batches
  getAllBatches(): (Batch & { student_count: number })[] {
    const rows = db.prepare(`
      SELECT b.*, count(bm.user_id) as student_count
      FROM batches b
      LEFT JOIN batch_memberships bm ON b.id = bm.batch_id
      GROUP BY b.id
      ORDER BY b.name ASC
    `).all() as (Batch & { student_count: number })[];
    return rows;
  },

  getBatchById(id: string): (Batch & { students: UserProfile[] }) | null {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as Batch;
    if (!batch) return null;

    const students = db.prepare(`
      SELECT p.id, p.student_id, p.name, p.email, p.role, p.status, p.phone, p.created_at, p.updated_at
      FROM profiles p
      JOIN batch_memberships bm ON p.id = bm.user_id
      WHERE bm.batch_id = ?
      ORDER BY p.name ASC
    `).all(id) as UserProfile[];

    return { ...batch, students };
  },

  createBatch(data: { name: string; description?: string }): Batch {
    const id = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`INSERT INTO batches (id, name, description, status) VALUES (?, ?, ?, 'active')`)
      .run(id, data.name, data.description || null);
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as Batch;
  },

  updateBatch(id: string, data: { name?: string; description?: string; status?: 'active' | 'archived' }): Batch | null {
    db.prepare(`
      UPDATE batches
      SET name = coalesce(?, name),
          description = coalesce(?, description),
          status = coalesce(?, status),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(data.name || null, data.description || null, data.status || null, id);
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as Batch;
  },

  deleteBatch(id: string): boolean {
    const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(id);
    if (!existing) return false;

    // Clean up dependent records safely
    db.prepare('DELETE FROM batch_memberships WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM assignment_recipients WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM exam_batches WHERE batch_id = ?').run(id);
    try {
      db.prepare('UPDATE assignment_submissions SET batch_id = NULL WHERE batch_id = ?').run(id);
    } catch {}
    const res = db.prepare('DELETE FROM batches WHERE id = ?').run(id);
    return res.changes > 0;
  },

  addStudentToBatch(batchId: string, studentId: string): void {
    db.prepare('INSERT OR IGNORE INTO batch_memberships (id, batch_id, user_id) VALUES (?, ?, ?)')
      .run(`mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, batchId, studentId);
  },

  addStudentsToBatch(batchId: string, studentIds: string[]): number {
    const insertStmt = db.prepare('INSERT OR IGNORE INTO batch_memberships (id, batch_id, user_id) VALUES (?, ?, ?)');
    let count = 0;
    const tx = db.transaction((ids: string[]) => {
      for (const sId of ids) {
        const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const res = insertStmt.run(id, batchId, sId);
        if (res.changes > 0) count++;
      }
    });
    tx(studentIds);
    return count;
  },

  removeStudentFromBatch(batchId: string, studentId: string): void {
    db.prepare('DELETE FROM batch_memberships WHERE batch_id = ? AND user_id = ?').run(batchId, studentId);
  },

  getStudentBatches(studentId: string): Batch[] {
    return db.prepare(`
      SELECT b.* FROM batches b
      JOIN batch_memberships bm ON b.id = bm.batch_id
      WHERE bm.user_id = ? AND b.status = 'active'
    `).all(studentId) as Batch[];
  },

  // Assignments
  getAllAssignments(): (Assignment & { recipient_batch_names: string[]; submission_count: number })[] {
    const assignments = db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all() as Assignment[];
    const getBatches = db.prepare(`
      SELECT b.id, b.name FROM batches b
      JOIN assignment_recipients ar ON b.id = ar.batch_id
      WHERE ar.assignment_id = ?
    `);
    const countSubs = db.prepare('SELECT count(*) as count FROM assignment_submissions WHERE assignment_id = ?');

    return assignments.map(a => {
      const batchRows = getBatches.all(a.id) as { id: string; name: string }[];
      const bNames = batchRows.map(r => r.name);
      const bIds = batchRows.map(r => r.id);
      const subCount = (countSubs.get(a.id) as { count: number }).count;
      return {
        ...a,
        allowed_formats: typeof a.allowed_formats === 'string' ? (a.allowed_formats as string).split(',') : a.allowed_formats,
        recipient_batch_names: bNames,
        target_batches: bIds,
        submission_count: subCount
      };
    });
  },

  getAssignmentsForStudent(studentId: string): (Assignment & { submission?: AssignmentSubmission | null; batch_names?: string[] })[] {
    // Only fetch assignments targeted to batches that this student belongs to!
    const assignments = db.prepare(`
      SELECT DISTINCT a.* FROM assignments a
      JOIN assignment_recipients ar ON a.id = ar.assignment_id
      JOIN batch_memberships bm ON ar.batch_id = bm.batch_id
      WHERE bm.user_id = ? AND a.status = 'published'
      ORDER BY a.deadline ASC
    `).all(studentId) as Assignment[];

    const getSub = db.prepare(`
      SELECT * FROM assignment_submissions
      WHERE assignment_id = ? AND student_id = ?
      ORDER BY version DESC LIMIT 1
    `);

    const getBatchesStmt = db.prepare(`
      SELECT b.name FROM batches b
      JOIN assignment_recipients ar ON b.id = ar.batch_id
      JOIN batch_memberships bm ON b.id = bm.batch_id
      WHERE ar.assignment_id = ? AND bm.user_id = ?
      ORDER BY b.name ASC
    `);

    return assignments.map(a => {
      const sub = getSub.get(a.id, studentId) as AssignmentSubmission | undefined;
      const bRows = getBatchesStmt.all(a.id, studentId) as { name: string }[];
      return {
        ...a,
        allowed_formats: typeof a.allowed_formats === 'string' ? (a.allowed_formats as string).split(',') : a.allowed_formats,
        submission: sub || null,
        batch_names: bRows.map(r => r.name)
      };
    });
  },

  getAssignmentById(id: string): (Assignment & { target_batches: string[] }) | null {
    const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as Assignment;
    if (!row) return null;

    const bIds = (db.prepare('SELECT batch_id FROM assignment_recipients WHERE assignment_id = ?').all(id) as { batch_id: string }[])
      .map(r => r.batch_id);

    return {
      ...row,
      allowed_formats: typeof row.allowed_formats === 'string' ? (row.allowed_formats as string).split(',') : row.allowed_formats,
      target_batches: bIds
    };
  },

  createAssignment(data: {
    title: string;
    subject: string;
    instructions: string;
    submission_type: 'file_upload' | 'text_response' | 'both';
    allowed_formats: string[];
    max_file_size_mb: number;
    max_score: number;
    rubric?: string;
    allow_late_submissions: boolean;
    start_date?: string;
    deadline: string;
    created_by?: string;
    batch_ids: string[];
  }): Assignment {
    const id = `asg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
      INSERT INTO assignments (
        id, title, subject, instructions, submission_type, allowed_formats,
        max_file_size_mb, max_score, rubric, allow_late_submissions,
        status, start_date, deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', coalesce(?, datetime('now')), ?, ?)
    `).run(
      id,
      data.title,
      data.subject,
      data.instructions,
      data.submission_type,
      data.allowed_formats.join(','),
      data.max_file_size_mb,
      data.max_score,
      data.rubric || null,
      data.allow_late_submissions ? 1 : 0,
      data.start_date || null,
      data.deadline,
      data.created_by || null
    );

    const insRcp = db.prepare('INSERT INTO assignment_recipients (id, assignment_id, batch_id) VALUES (?, ?, ?)');
    for (const bId of data.batch_ids) {
      insRcp.run(`rcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, id, bId);
    }

    return this.getAssignmentById(id)!;
  },

  updateAssignment(id: string, data: {
    title?: string;
    subject?: string;
    instructions?: string;
    submission_type?: 'file_upload' | 'text_response' | 'both';
    allowed_formats?: string[];
    max_file_size_mb?: number;
    max_score?: number;
    rubric?: string | null;
    allow_late_submissions?: boolean;
    deadline?: string;
    batch_ids?: string[];
    status?: 'draft' | 'published' | 'archived';
  }): (Assignment & { recipient_batch_names: string[]; submission_count: number }) | null {
    const existing = this.getAssignmentById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE assignments SET
        title = coalesce(?, title),
        subject = coalesce(?, subject),
        instructions = coalesce(?, instructions),
        submission_type = coalesce(?, submission_type),
        allowed_formats = coalesce(?, allowed_formats),
        max_file_size_mb = coalesce(?, max_file_size_mb),
        max_score = coalesce(?, max_score),
        rubric = coalesce(?, rubric),
        allow_late_submissions = coalesce(?, allow_late_submissions),
        deadline = coalesce(?, deadline),
        status = coalesce(?, status),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.title ?? null,
      data.subject ?? null,
      data.instructions ?? null,
      data.submission_type ?? null,
      data.allowed_formats ? data.allowed_formats.join(',') : null,
      data.max_file_size_mb ?? null,
      data.max_score ?? null,
      data.rubric !== undefined ? data.rubric : null,
      data.allow_late_submissions !== undefined ? (data.allow_late_submissions ? 1 : 0) : null,
      data.deadline ?? null,
      data.status ?? null,
      id
    );

    if (data.batch_ids && Array.isArray(data.batch_ids)) {
      db.prepare('DELETE FROM assignment_recipients WHERE assignment_id = ?').run(id);
      const insRcp = db.prepare('INSERT INTO assignment_recipients (id, assignment_id, batch_id) VALUES (?, ?, ?)');
      for (const bId of data.batch_ids) {
        insRcp.run(`rcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, id, bId);
      }
    }

    const updated = this.getAssignmentById(id);
    if (!updated) return null;

    const getBatches = db.prepare(`
      SELECT b.id, b.name FROM batches b
      JOIN assignment_recipients ar ON b.id = ar.batch_id
      WHERE ar.assignment_id = ?
    `);
    const countSubs = db.prepare('SELECT count(*) as count FROM assignment_submissions WHERE assignment_id = ?');
    const batchRows = getBatches.all(id) as { id: string; name: string }[];
    const bNames = batchRows.map(r => r.name);
    const subCount = (countSubs.get(id) as { count: number }).count;

    return {
      ...updated,
      recipient_batch_names: bNames,
      target_batches: batchRows.map(r => r.id),
      submission_count: subCount
    };
  },

  deleteAssignment(id: string): boolean {
    db.prepare('DELETE FROM assignment_submissions WHERE assignment_id = ?').run(id);
    db.prepare('DELETE FROM assignment_recipients WHERE assignment_id = ?').run(id);
    const res = db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
    return res.changes > 0;
  },

  // Submissions & Evaluation
  submitAssignment(data: {
    assignment_id: string;
    student_id: string;
    batch_id?: string;
    text_response?: string;
    file_name?: string;
    file_url?: string;
    file_size?: number;
    file_mime?: string;
  }): AssignmentSubmission {
    const asg = this.getAssignmentById(data.assignment_id);
    if (!asg) throw new Error('Assignment not found');

    const now = new Date();
    const deadline = new Date(asg.deadline);
    const isLate = now > deadline;

    if (isLate && !asg.allow_late_submissions) {
      throw new Error('Late submissions are not permitted for this assignment');
    }

    // Check if an evaluated submission already exists
    const existingEvaluated = db.prepare(`
      SELECT id, status FROM assignment_submissions
      WHERE assignment_id = ? AND student_id = ? AND status = 'evaluated'
      LIMIT 1
    `).get(data.assignment_id, data.student_id);

    if (existingEvaluated) {
      throw new Error('This assignment has already been evaluated and graded by Trainer Shukla. Resubmission is closed.');
    }

    // Check version
    const existing = db.prepare(`
      SELECT max(version) as max_v FROM assignment_submissions
      WHERE assignment_id = ? AND student_id = ?
    `).get(data.assignment_id, data.student_id) as { max_v: number | null };

    const version = (existing?.max_v || 0) + 1;
    const subId = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    db.prepare(`
      INSERT INTO assignment_submissions (
        id, assignment_id, student_id, batch_id, version,
        text_response, file_name, file_url, file_size, file_mime,
        submitted_at, is_late, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'submitted')
    `).run(
      subId,
      data.assignment_id,
      data.student_id,
      data.batch_id || null,
      version,
      data.text_response || null,
      data.file_name || null,
      data.file_url || null,
      data.file_size || null,
      data.file_mime || null,
      isLate ? 1 : 0
    );

    return db.prepare('SELECT * FROM assignment_submissions WHERE id = ?').get(subId) as AssignmentSubmission;
  },

  getAllSubmissionsQueue(filters?: { batch_id?: string; assignment_id?: string; status?: string }): (AssignmentSubmission & { student_name: string; student_code: string; assignment_title: string; batch_name: string })[] {
    let sql = `
      SELECT sub.*, p.name as student_name, p.student_id as student_code, a.title as assignment_title, coalesce(b.name, 'Default Batch') as batch_name
      FROM assignment_submissions sub
      JOIN profiles p ON sub.student_id = p.id
      JOIN assignments a ON sub.assignment_id = a.id
      LEFT JOIN batches b ON sub.batch_id = b.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.batch_id) {
      sql += ' AND sub.batch_id = ?';
      params.push(filters.batch_id);
    }
    if (filters?.assignment_id) {
      sql += ' AND sub.assignment_id = ?';
      params.push(filters.assignment_id);
    }
    if (filters?.status) {
      sql += ' AND sub.status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY sub.submitted_at DESC';
    return db.prepare(sql).all(...params) as (AssignmentSubmission & { student_name: string; student_code: string; assignment_title: string; batch_name: string })[];
  },

  evaluateSubmission(submissionId: string, data: { marks_awarded: number; feedback?: string; release_draft?: boolean; evaluated_by: string }): AssignmentSubmission {
    const status = 'evaluated';
    const releaseFlag = data.release_draft ? 1 : 0;

    db.prepare(`
      UPDATE assignment_submissions
      SET marks_awarded = ?,
          feedback = ?,
          feedback_released = ?,
          status = ?,
          evaluated_at = datetime('now'),
          evaluated_by = ?
      WHERE id = ?
    `).run(data.marks_awarded, data.feedback || null, releaseFlag, status, data.evaluated_by, submissionId);

    const updated = db.prepare('SELECT * FROM assignment_submissions WHERE id = ?').get(submissionId) as AssignmentSubmission;

    // Send notification to student if released
    if (data.release_draft) {
      const student = this.getUserById(updated.student_id);
      const asg = this.getAssignmentById(updated.assignment_id);
      if (student && asg) {
        this.createNotification({
          user_id: updated.student_id,
          title: 'Assignment Evaluated',
          message: `Your work for "${asg.title}" has been evaluated by Trainer Tushar Shukla (Score: ${data.marks_awarded}/${asg.max_score}).`,
          type: 'grade',
          link: `/student/assignments/${asg.id}`
        });
      }
    }

    return updated;
  },

  // Assignment Monitoring Matrix
  getAssignmentMatrix(batchId?: string): {
    assignments: Assignment[];
    rows: MatrixStudentRow[];
    summary: { total_expected: number; submitted: number; evaluated: number; pending: number; overdue: number };
  } {
    let studentQuery = `SELECT id, student_id, name, email, role, avatar_url, phone, status, created_at, updated_at FROM profiles WHERE role = 'student' AND status = 'active'`;
    const params: unknown[] = [];

    if (batchId) {
      studentQuery = `
        SELECT p.id, p.student_id, p.name, p.email, p.role, p.avatar_url, p.phone, p.status, p.created_at, p.updated_at
        FROM profiles p
        JOIN batch_memberships bm ON p.id = bm.user_id
        WHERE bm.batch_id = ? AND p.status = 'active'
      `;
      params.push(batchId);
    }

    const students = db.prepare(studentQuery).all(...params) as UserProfile[];
    const assignments = this.getAllAssignments();

    const getStudentBatchesStmt = db.prepare(`
      SELECT b.id, b.name FROM batches b
      JOIN batch_memberships bm ON b.id = bm.batch_id
      WHERE bm.user_id = ?
    `);

    const getRecipientsStmt = db.prepare('SELECT batch_id FROM assignment_recipients WHERE assignment_id = ?');
    const getSubStmt = db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ? ORDER BY version DESC LIMIT 1');

    let totalExpected = 0;
    let totalSubmitted = 0;
    let totalEvaluated = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    const rows: MatrixStudentRow[] = students.map(student => {
      const studentBatches = getStudentBatchesStmt.all(student.id) as { id: string; name: string }[];
      const studentBatchIds = new Set(studentBatches.map(b => b.id));
      const studentAssignmentsRecord: MatrixStudentRow['assignments'] = {};

      for (const asg of assignments) {
        const targetBatchIds = (getRecipientsStmt.all(asg.id) as { batch_id: string }[]).map(r => r.batch_id);
        const isEligible = targetBatchIds.some(bId => studentBatchIds.has(bId));

        if (!isEligible) {
          studentAssignmentsRecord[asg.id] = { status: 'Not Assigned' };
          continue;
        }

        totalExpected++;
        const sub = getSubStmt.get(asg.id, student.id) as AssignmentSubmission | undefined;
        const now = new Date();
        const deadline = new Date(asg.deadline);

        if (sub) {
          totalSubmitted++;
          if (sub.status === 'evaluated') {
            totalEvaluated++;
            studentAssignmentsRecord[asg.id] = {
              status: 'Evaluated',
              marks: sub.marks_awarded,
              max_score: asg.max_score,
              submission_id: sub.id,
              submitted_at: sub.submitted_at
            };
          } else {
            studentAssignmentsRecord[asg.id] = {
              status: sub.is_late ? 'Late' : 'Submitted',
              submission_id: sub.id,
              submitted_at: sub.submitted_at
            };
          }
        } else {
          if (now > deadline) {
            totalOverdue++;
            studentAssignmentsRecord[asg.id] = { status: 'Overdue' };
          } else {
            totalPending++;
            studentAssignmentsRecord[asg.id] = { status: 'Pending' };
          }
        }
      }

      return {
        student,
        batch_names: studentBatches.map(b => b.name),
        assignments: studentAssignmentsRecord
      };
    });

    return {
      assignments,
      rows,
      summary: {
        total_expected: totalExpected,
        submitted: totalSubmitted,
        evaluated: totalEvaluated,
        pending: totalPending,
        overdue: totalOverdue
      }
    };
  },

  // Question Bank
  getAllQuestions(): QuestionBankItem[] {
    const rows = db.prepare('SELECT * FROM question_bank ORDER BY created_at DESC').all() as (Omit<QuestionBankItem, 'options'> & { options: string })[];
    return rows.map(r => ({
      ...r,
      options: JSON.parse(r.options)
    }));
  },

  getQuestionById(id: string): QuestionBankItem | null {
    const row = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(id) as (Omit<QuestionBankItem, 'options'> & { options: string }) | undefined;
    if (!row) return null;
    return {
      ...row,
      options: JSON.parse(row.options)
    };
  },

  createQuestion(data: {
    subject: string;
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    question_type?: 'mcq' | 'coding' | 'written' | 'file_upload';
    coding_language?: 'c' | 'cpp' | 'java' | 'python' | 'javascript';
    code_template?: string;
    allowed_file_types?: string;
    max_file_size_mb?: number;
    question_text: string;
    options?: { id: string; text: string }[];
    correct_option_id?: string;
    explanation?: string;
    marks: number;
    negative_penalty: number;
    created_by?: string;
  }): QuestionBankItem {
    const id = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const qType = data.question_type || 'mcq';
    db.prepare(`
      INSERT INTO question_bank (
        id, subject, topic, difficulty, question_type, coding_language,
        code_template, allowed_file_types, max_file_size_mb,
        question_text, options, correct_option_id, explanation, marks, negative_penalty, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.subject,
      data.topic,
      data.difficulty,
      qType,
      data.coding_language || null,
      data.code_template || null,
      data.allowed_file_types || null,
      data.max_file_size_mb || null,
      data.question_text,
      JSON.stringify(data.options || []),
      data.correct_option_id || (qType !== 'mcq' ? 'manual_evaluation' : 'none'),
      data.explanation || null,
      data.marks,
      data.negative_penalty,
      data.created_by || null
    );

    return this.getQuestionById(id)!;
  },

  updateQuestion(id: string, data: {
    subject?: string;
    topic?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    question_type?: 'mcq' | 'coding' | 'written' | 'file_upload';
    coding_language?: string;
    code_template?: string;
    allowed_file_types?: string;
    max_file_size_mb?: number;
    question_text?: string;
    options?: { id: string; text: string }[];
    correct_option_id?: string;
    explanation?: string;
    marks?: number;
    negative_penalty?: number;
  }): QuestionBankItem | null {
    const existing = this.getQuestionById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE question_bank
      SET subject = coalesce(?, subject),
          topic = coalesce(?, topic),
          difficulty = coalesce(?, difficulty),
          question_type = coalesce(?, question_type),
          coding_language = coalesce(?, coding_language),
          code_template = coalesce(?, code_template),
          allowed_file_types = coalesce(?, allowed_file_types),
          max_file_size_mb = coalesce(?, max_file_size_mb),
          question_text = coalesce(?, question_text),
          options = coalesce(?, options),
          correct_option_id = coalesce(?, correct_option_id),
          explanation = coalesce(?, explanation),
          marks = coalesce(?, marks),
          negative_penalty = coalesce(?, negative_penalty)
      WHERE id = ?
    `).run(
      data.subject !== undefined ? data.subject : null,
      data.topic !== undefined ? data.topic : null,
      data.difficulty !== undefined ? data.difficulty : null,
      data.question_type !== undefined ? data.question_type : null,
      data.coding_language !== undefined ? data.coding_language : null,
      data.code_template !== undefined ? data.code_template : null,
      data.allowed_file_types !== undefined ? data.allowed_file_types : null,
      data.max_file_size_mb !== undefined ? data.max_file_size_mb : null,
      data.question_text !== undefined ? data.question_text : null,
      data.options !== undefined ? JSON.stringify(data.options) : null,
      data.correct_option_id !== undefined ? data.correct_option_id : null,
      data.explanation !== undefined ? data.explanation : null,
      data.marks !== undefined ? data.marks : null,
      data.negative_penalty !== undefined ? data.negative_penalty : null,
      id
    );

    return this.getQuestionById(id);
  },

  deleteQuestion(id: string): boolean {
    const res = db.prepare('DELETE FROM question_bank WHERE id = ?').run(id);
    return res.changes > 0;
  },

  clearAllQuestions(): number {
    const res = db.prepare('DELETE FROM question_bank').run();
    return res.changes;
  },

  // Exams
  getAllExams(options?: { includeDeleted?: boolean }): (Exam & { recipient_batch_names: string[]; attempt_count: number })[] {
    const where = options?.includeDeleted ? '' : 'WHERE is_deleted = 0';
    const exams = db.prepare(`SELECT * FROM exams ${where} ORDER BY created_at DESC`).all() as Exam[];
    const getBatches = db.prepare(`
      SELECT b.name FROM batches b
      JOIN exam_batches eb ON b.id = eb.batch_id
      WHERE eb.exam_id = ?
    `);
    const countAttempts = db.prepare('SELECT count(*) as count FROM exam_attempts WHERE exam_id = ?');

    return exams.map(e => ({
      ...e,
      recipient_batch_names: (getBatches.all(e.id) as { name: string }[]).map(r => r.name),
      attempt_count: (countAttempts.get(e.id) as { count: number }).count
    }));
  },

  getExamsForStudent(studentId: string): (Exam & { attempt?: ExamAttempt | null; is_eligible: boolean })[] {
    const studentBatches = this.getStudentBatches(studentId);
    const studentBatchIds = new Set(studentBatches.map(b => b.id));

    const exams = db.prepare(`SELECT * FROM exams WHERE status = 'published' AND is_deleted = 0 ORDER BY created_at DESC`).all() as Exam[];
    const getExamBatchesStmt = db.prepare('SELECT batch_id FROM exam_batches WHERE exam_id = ?');
    const getAttemptStmt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?');

    return exams.map(exam => {
      const eBatchIds = (getExamBatchesStmt.all(exam.id) as { batch_id: string }[]).map(r => r.batch_id);
      const isEligible = eBatchIds.some(bId => studentBatchIds.has(bId));
      const attempt = getAttemptStmt.get(exam.id, studentId) as ExamAttempt | undefined;

      let sanitizedAttempt = attempt ? { ...attempt, is_published: Boolean(attempt.is_published) } : null;
      if (sanitizedAttempt && !sanitizedAttempt.is_published) {
        sanitizedAttempt.total_score = null;
        sanitizedAttempt.percentage = null;
        sanitizedAttempt.accuracy = null;
        sanitizedAttempt.total_correct = 0;
        sanitizedAttempt.total_incorrect = 0;
        sanitizedAttempt.trainer_feedback = null;
      }

      return {
        ...exam,
        is_eligible: isEligible,
        attempt: sanitizedAttempt
      };
    }).filter(e => e.is_eligible);
  },

  getExamById(id: string): (Exam & { target_batches: string[]; questions: QuestionBankItem[] }) | null {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as Exam;
    if (!exam) return null;

    const bIds = (db.prepare('SELECT batch_id FROM exam_batches WHERE exam_id = ?').all(id) as { batch_id: string }[])
      .map(r => r.batch_id);

    const questions = db.prepare(`
      SELECT q.*, eq.question_order FROM question_bank q
      JOIN exam_questions eq ON q.id = eq.question_id
      WHERE eq.exam_id = ?
      ORDER BY eq.question_order ASC
    `).all(id) as (Omit<QuestionBankItem, 'options'> & { options: string })[];

    return {
      ...exam,
      target_batches: bIds,
      questions: questions.map(q => ({
        ...q,
        options: JSON.parse(q.options)
      }))
    };
  },

  // ============================================================================
  // EXAM DEADLINE & ABSENT STUDENT EVALUATION ENGINE
  // Authoritative server-side evaluation: Students who missed deadline are marked FAIL
  // Score cards are generated and stored permanently for both trainer and student
  // ============================================================================
  processExamDeadlines(specificExamId?: string): { processed_exams: number; auto_failed_count: number } {
    let autoFailedCount = 0;
    let processedExams = 0;

    try {
      let targetExams: Exam[] = [];
      if (specificExamId) {
        const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(specificExamId) as Exam | undefined;
        if (exam) targetExams = [exam];
      } else {
        targetExams = db.prepare(`
          SELECT * FROM exams 
          WHERE is_deleted = 0 
            AND status = 'published' 
            AND end_window IS NOT NULL 
            AND end_window != ''
        `).all() as Exam[];
      }

      const nowTime = Date.now();

      for (const ex of targetExams) {
        // STRICT DEADLINE RULE:
        // A student who has not attempted should ONLY be marked as failed if the deadline has actually crossed!
        if (!ex.end_window || ex.end_window.trim() === '') {
          // No deadline is configured. Do not auto-fail unattempted students.
          continue;
        }

        const deadlineTimestamp = new Date(ex.end_window).getTime();
        if (isNaN(deadlineTimestamp) || nowTime < deadlineTimestamp) {
          // Deadline has NOT crossed yet. Students still have time to take the examination.
          continue;
        }

        processedExams++;
        const passPct = ex.passing_percentage ?? 40.0;

        // 1. Get all batches assigned to this exam
        const examBatches = db.prepare('SELECT batch_id FROM exam_batches WHERE exam_id = ?').all(ex.id) as { batch_id: string }[];
        if (examBatches.length === 0) continue;

        const batchPlaceholders = examBatches.map(() => '?').join(',');
        const batchIds = examBatches.map(b => b.batch_id);

        // 2. Fetch all enrolled students in these target batches
        const enrolledStudents = db.prepare(`
          SELECT DISTINCT p.id, p.name, p.student_id, p.email, bm.batch_id, b.name as batch_name
          FROM batch_memberships bm
          JOIN profiles p ON bm.user_id = p.id
          LEFT JOIN batches b ON bm.batch_id = b.id
          WHERE bm.batch_id IN (${batchPlaceholders}) AND p.role = 'student' AND p.status = 'active'
        `).all(...batchIds) as { id: string; name: string; student_id?: string; email?: string; batch_id: string; batch_name: string }[];

        for (const stu of enrolledStudents) {
          const existingAtt = db.prepare(`
            SELECT * FROM exam_attempts 
            WHERE exam_id = ? AND (student_id = ? OR student_id = ?)
          `).get(ex.id, stu.id, stu.student_id || '') as ExamAttempt | undefined;

          if (!existingAtt) {
            // Student did not attempt the exam before deadline -> Mark as FAIL (Absent)
            const attemptId = `att-absent-${ex.id.slice(0, 8)}-${stu.id.slice(0, 8)}-${Date.now().toString(36)}`;
            const deadlineTime = ex.end_window || new Date().toISOString();

            db.prepare(`
              INSERT INTO exam_attempts (
                id, exam_id, student_id, batch_id, status, started_at,
                authoritative_deadline, submitted_at, time_spent_seconds, is_paused, pause_count,
                total_score, total_correct, total_incorrect, total_unattempted,
                percentage, accuracy, rank, evaluation_status, is_published,
                published_at, trainer_feedback, is_absent, result_status,
                exam_title, exam_max_marks, exam_duration_minutes, exam_passing_percentage, batch_name
              ) VALUES (
                ?, ?, ?, ?, 'completed', ?,
                ?, ?, 0, 0, 0,
                0.0, 0, 0, ?,
                0.0, 0.0, null, 'evaluated', 1,
                ?, 'Absent — Student did not attempt this exam before the scheduled deadline. Officially marked as Failed (0 marks).',
                1, 'absent_fail',
                ?, ?, ?, ?, ?
              )
            `).run(
              attemptId,
              ex.id,
              stu.id,
              stu.batch_id || null,
              deadlineTime,
              deadlineTime,
              deadlineTime,
              ex.total_questions || 0,
              new Date().toISOString(),
              ex.title,
              ex.max_marks,
              ex.duration_minutes,
              passPct,
              stu.batch_name || 'Enrolled Batch'
            );

            // Pre-seed blank attempt responses so question breakdowns remain clean
            try {
              const examQRows = db.prepare('SELECT question_id FROM exam_questions WHERE exam_id = ? ORDER BY question_order ASC').all(ex.id) as { question_id: string }[];
              const insResp = db.prepare(`
                INSERT INTO attempt_responses (id, attempt_id, question_id, selected_option_id, is_marked_for_review, is_visited, manual_marks)
                VALUES (?, ?, ?, null, 0, 0, 0.0)
              `);
              for (let i = 0; i < examQRows.length; i++) {
                insResp.run(`resp-${attemptId}-${i + 1}`, attemptId, examQRows[i].question_id);
              }
            } catch {}

            // Send instant score card notification to student
            try {
              this.createNotification({
                user_id: stu.id,
                title: `Exam Score Card: ${ex.title} — Failed (Absent)`,
                message: `The exam deadline for "${ex.title}" has passed. Because you did not attempt the exam, your score card has been generated as Fail (0/${ex.max_marks}).`,
                type: 'exam',
                link: `/student/exams/${ex.id}/result`
              });
            } catch {}

            autoFailedCount++;
          } else if (existingAtt.status === 'in_progress') {
            // Student started but abandoned / didn't submit before deadline
            try {
              this.finalizeExamAttempt(existingAtt.id, stu.id);
              const finalizedAtt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(existingAtt.id) as ExamAttempt | undefined;
              if (finalizedAtt) {
                const isPass = Number(finalizedAtt.percentage || 0) >= passPct;
                db.prepare(`
                  UPDATE exam_attempts
                  SET evaluation_status = 'evaluated',
                      is_published = 1,
                      published_at = COALESCE(published_at, datetime('now')),
                      result_status = ?,
                      exam_title = COALESCE(exam_title, ?),
                      exam_max_marks = COALESCE(exam_max_marks, ?),
                      exam_duration_minutes = COALESCE(exam_duration_minutes, ?),
                      exam_passing_percentage = COALESCE(exam_passing_percentage, ?),
                      batch_name = COALESCE(batch_name, ?)
                  WHERE id = ?
                `).run(isPass ? 'pass' : 'fail', ex.title, ex.max_marks, ex.duration_minutes, passPct, stu.batch_name || null, existingAtt.id);
              }
            } catch (finErr) {
              console.warn('[processExamDeadlines in_progress finalize warning]:', finErr);
            }
          } else if (existingAtt.status === 'completed') {
            // Ensure snapshot metadata and result_status are populated
            const isPass = existingAtt.is_absent ? false : (Number(existingAtt.percentage || 0) >= passPct);
            const resStatus = existingAtt.is_absent ? 'absent_fail' : (isPass ? 'pass' : 'fail');
            db.prepare(`
              UPDATE exam_attempts
              SET result_status = COALESCE(result_status, ?),
                  exam_title = COALESCE(exam_title, ?),
                  exam_max_marks = COALESCE(exam_max_marks, ?),
                  exam_duration_minutes = COALESCE(exam_duration_minutes, ?),
                  exam_passing_percentage = COALESCE(exam_passing_percentage, ?),
                  batch_name = COALESCE(batch_name, ?),
                  is_published = 1,
                  published_at = COALESCE(published_at, datetime('now'))
              WHERE id = ?
            `).run(resStatus, ex.title, ex.max_marks, ex.duration_minutes, passPct, stu.batch_name || null, existingAtt.id);
          }
        }
      }
    } catch (err) {
      console.warn('[processExamDeadlines error]:', err);
    }

    return { processed_exams: processedExams, auto_failed_count: autoFailedCount };
  },

  createExam(data: {
    title: string;
    description?: string;
    instructions?: string;
    duration_minutes: number;
    negative_marking: number;
    allow_pausing?: boolean;
    batch_ids: string[];
    question_ids: string[];
    created_by?: string;
    start_window?: string | null;
    end_window?: string | null;
    passing_percentage?: number;
  }): Exam {
    const id = `exam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const totalQ = data.question_ids.length;
    let maxMarks = 0;
    if (totalQ > 0) {
      const placeholders = data.question_ids.map(() => '?').join(',');
      const sumRow = db.prepare(`SELECT COALESCE(SUM(marks), 0) as total FROM question_bank WHERE id IN (${placeholders})`).get(...data.question_ids) as { total: number };
      maxMarks = sumRow.total > 0 ? sumRow.total : totalQ * 1.0;
    } else {
      maxMarks = 0;
    }
    const marksPerQuestion = totalQ > 0 ? Number((maxMarks / totalQ).toFixed(2)) : 1.0;
    const passingPct = data.passing_percentage !== undefined && data.passing_percentage !== null ? Number(data.passing_percentage) : 40.0;

    db.prepare(`
      INSERT INTO exams (
        id, title, description, instructions, duration_minutes, total_questions,
        max_marks, marks_per_question, negative_marking, unattempted_deduction,
        allow_pausing, max_pauses, status, result_release_policy, start_window, end_window, passing_percentage, is_deleted, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, 0, 'published', 'immediate', ?, ?, ?, 0, ?)
    `).run(
      id,
      data.title,
      data.description || null,
      data.instructions || null,
      data.duration_minutes,
      totalQ,
      maxMarks,
      marksPerQuestion,
      data.negative_marking,
      data.allow_pausing ? 1 : 0,
      data.start_window || new Date().toISOString(),
      data.end_window || null,
      passingPct,
      data.created_by || null
    );

    const insEB = db.prepare('INSERT INTO exam_batches (id, exam_id, batch_id) VALUES (?, ?, ?)');
    for (const bId of data.batch_ids) {
      insEB.run(`eb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, id, bId);
    }

    const insEQ = db.prepare('INSERT INTO exam_questions (id, exam_id, question_id, question_order) VALUES (?, ?, ?, ?)');
    data.question_ids.forEach((qId, idx) => {
      insEQ.run(`eq-${id}-${idx + 1}`, id, qId, idx + 1);
    });

    return this.getExamById(id)!;
  },

  updateExam(id: string, data: {
    title?: string;
    description?: string;
    instructions?: string;
    duration_minutes?: number;
    negative_marking?: number;
    passing_percentage?: number;
    end_window?: string | null;
  }): (Exam & { target_batches: string[]; questions: QuestionBankItem[] }) | null {
    const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as Exam | undefined;
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title.trim());
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description ? data.description.trim() : null);
    }
    if (data.instructions !== undefined) {
      fields.push('instructions = ?');
      values.push(data.instructions ? data.instructions.trim() : null);
    }
    if (data.duration_minutes !== undefined) {
      fields.push('duration_minutes = ?');
      values.push(Math.max(1, Number(data.duration_minutes)));
    }
    if (data.negative_marking !== undefined) {
      fields.push('negative_marking = ?');
      values.push(Math.max(0, Number(data.negative_marking)));
    }
    if (data.end_window !== undefined) {
      fields.push('end_window = ?');
      values.push(data.end_window || null);
    }
    if (data.passing_percentage !== undefined) {
      const passPct = Math.max(1, Math.min(100, Number(data.passing_percentage)));
      fields.push('passing_percentage = ?');
      values.push(passPct);

      // Update snapshot in all attempts of this exam
      db.prepare(`
        UPDATE exam_attempts
        SET exam_passing_percentage = ?
        WHERE exam_id = ?
      `).run(passPct, id);

      // Re-evaluate pass/fail status for completed or published student scorecards
      db.prepare(`
        UPDATE exam_attempts
        SET result_status = CASE
          WHEN is_absent = 1 THEN 'absent_fail'
          WHEN percentage >= ? THEN 'pass'
          ELSE 'fail'
        END
        WHERE exam_id = ? AND (status = 'completed' OR is_published = 1)
      `).run(passPct, id);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    syncDatabaseToCloud();

    return this.getExamById(id);
  },

  deleteExam(id: string): boolean {
    // 1. Process deadline for this exam so unattempted students are marked absent/failed
    try {
      this.processExamDeadlines(id);
    } catch (procErr) {
      console.warn('[deleteExam processExamDeadlines warning]:', procErr);
    }

    // 2. Snapshot exam title, max marks, duration into attempts so they are permanently preserved
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as Exam | undefined;
    if (exam) {
      db.prepare(`
        UPDATE exam_attempts
        SET exam_title = COALESCE(exam_title, ?),
            exam_max_marks = COALESCE(exam_max_marks, ?),
            exam_duration_minutes = COALESCE(exam_duration_minutes, ?),
            exam_passing_percentage = COALESCE(exam_passing_percentage, ?)
        WHERE exam_id = ?
      `).run(exam.title, exam.max_marks, exam.duration_minutes, exam.passing_percentage || 40.0, id);
    }

    // 3. Soft-delete the exam: mark is_deleted = 1 and status = 'archived'
    // Score cards, attempts, and trainer reports are PERMANENTLY preserved!
    const res = db.prepare(`
      UPDATE exams 
      SET is_deleted = 1, status = 'archived', updated_at = datetime('now') 
      WHERE id = ?
    `).run(id);

    return res.changes > 0;
  },

  // ============================================================================
  // EXAMINATION ENGINE METHODS (Server-Authoritative, Bulletproof)
  // ============================================================================

  getStudentExamEligibility(examId: string, studentId: string): { is_eligible: boolean; reason?: string; attempt?: ExamAttempt } {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam;
    if (!exam) return { is_eligible: false, reason: 'Examination not found' };
    if (exam.status !== 'published' || exam.is_deleted) return { is_eligible: false, reason: 'This examination is not currently active.' };

    const now = new Date();
    if (exam.start_window && new Date(exam.start_window) > now) {
      return { is_eligible: false, reason: `Examination is not yet open. Scheduled to open on ${new Date(exam.start_window).toLocaleString('en-IN')}.` };
    }

    if (exam.end_window && new Date(exam.end_window) < now) {
      this.processExamDeadlines(examId);
      const attempt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(examId, studentId) as ExamAttempt | undefined;
      return { is_eligible: false, reason: 'The deadline for this examination has passed. Score card has been generated.', attempt };
    }

    const studentBatches = this.getStudentBatches(studentId);
    const studentBatchIds = new Set(studentBatches.map(b => b.id));

    const examBatches = db.prepare('SELECT batch_id FROM exam_batches WHERE exam_id = ?').all(examId) as { batch_id: string }[];
    const isMember = examBatches.some(eb => studentBatchIds.has(eb.batch_id));

    if (!isMember) {
      return { is_eligible: false, reason: 'You are not enrolled in the batch authorized to take this examination' };
    }

    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(examId, studentId) as ExamAttempt | undefined;

    return {
      is_eligible: true,
      attempt
    };
  },

  startOrResumeExamAttempt(examId: string, studentId: string): {
    attempt: ExamAttempt;
    questions: ExamQuestionClient[];
    responses: AttemptResponse[];
    server_time: string;
  } {
    const eligibility = this.getStudentExamEligibility(examId, studentId);
    if (!eligibility.is_eligible) {
      throw new Error(eligibility.reason || 'Not authorized for this examination');
    }

    let attempt = eligibility.attempt;
    const now = new Date();
    const serverTimeStr = now.toISOString();

    if (!attempt) {
      // Create new attempt with authoritative server-computed deadline
      const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam;
      const attemptId = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const deadline = new Date(now.getTime() + exam.duration_minutes * 60 * 1000).toISOString();

      // Find primary student batch for this exam
      const studentBatches = this.getStudentBatches(studentId);
      const examBatches = db.prepare('SELECT batch_id FROM exam_batches WHERE exam_id = ?').all(examId) as { batch_id: string }[];
      const matchedBatch = studentBatches.find(sb => examBatches.some(eb => eb.batch_id === sb.id));

      db.prepare(`
        INSERT INTO exam_attempts (
          id, exam_id, student_id, batch_id, status, started_at,
          authoritative_deadline, time_spent_seconds, is_paused, pause_count,
          exam_title, exam_max_marks, exam_duration_minutes, exam_passing_percentage, batch_name
        ) VALUES (?, ?, ?, ?, 'in_progress', ?, ?, 0, 0, 0, ?, ?, ?, ?, ?)
      `).run(
        attemptId,
        examId,
        studentId,
        matchedBatch?.id || null,
        serverTimeStr,
        deadline,
        exam.title,
        exam.max_marks,
        exam.duration_minutes,
        exam.passing_percentage || 40.0,
        matchedBatch?.name || null
      );

      attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt;

      // Pre-seed blank attempt responses for all exam questions
      const examQRows = db.prepare(`
        SELECT question_id FROM exam_questions WHERE exam_id = ? ORDER BY question_order ASC
      `).all(examId) as { question_id: string }[];

      const insResp = db.prepare(`
        INSERT INTO attempt_responses (id, attempt_id, question_id, selected_option_id, is_marked_for_review, is_visited)
        VALUES (?, ?, ?, null, 0, 0)
      `);

      for (let i = 0; i < examQRows.length; i++) {
        insResp.run(`resp-${attemptId}-${i + 1}`, attemptId, examQRows[i].question_id);
      }
    } else if (attempt.status === 'in_progress') {
      // Check if deadline has elapsed on the server
      const deadline = new Date(attempt.authoritative_deadline);
      if (now > deadline) {
        // Auto-finalize on expiration
        this.finalizeExamAttempt(attempt.id, studentId);
        attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attempt.id) as ExamAttempt;
      }
    }

    // Fetch sanitized client questions (CRITICAL: without correct_option_id or explanation!)
    let rawQuestions: (Omit<ExamQuestionClient, 'options'> & { options: string })[] = [];
    try {
      rawQuestions = db.prepare(`
        SELECT q.id, eq.question_order, q.subject, q.topic, q.question_text, q.question_image_url, q.options, q.marks, q.negative_penalty,
               COALESCE(q.question_type, 'mcq') as question_type, q.coding_language, q.code_template, q.allowed_file_types, q.max_file_size_mb
        FROM question_bank q
        JOIN exam_questions eq ON q.id = eq.question_id
        WHERE eq.exam_id = ?
        ORDER BY eq.question_order ASC
      `).all(examId) as (Omit<ExamQuestionClient, 'options'> & { options: string })[];
    } catch (queryErr: any) {
      if (String(queryErr?.message).includes('no such column')) {
        ensureAllMigrations(db);
        try {
          rawQuestions = db.prepare(`
            SELECT q.id, eq.question_order, q.subject, q.topic, q.question_text, q.question_image_url, q.options, q.marks, q.negative_penalty,
                   COALESCE(q.question_type, 'mcq') as question_type, q.coding_language, q.code_template, q.allowed_file_types, q.max_file_size_mb
            FROM question_bank q
            JOIN exam_questions eq ON q.id = eq.question_id
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `).all(examId) as any[];
        } catch {
          rawQuestions = db.prepare(`
            SELECT q.id, eq.question_order, q.subject, q.topic, q.question_text, q.question_image_url, q.options, q.marks, q.negative_penalty
            FROM question_bank q
            JOIN exam_questions eq ON q.id = eq.question_id
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `).all(examId) as any[];
        }
      } else {
        throw queryErr;
      }
    }

    const clientQuestions: ExamQuestionClient[] = rawQuestions.map(q => ({
      id: q.id,
      question_order: q.question_order,
      subject: q.subject,
      topic: q.topic,
      question_type: (q.question_type || 'mcq') as any,
      coding_language: q.coding_language || null,
      code_template: q.code_template || null,
      allowed_file_types: q.allowed_file_types || null,
      max_file_size_mb: q.max_file_size_mb || null,
      question_text: q.question_text,
      question_image_url: q.question_image_url,
      options: q.options ? JSON.parse(q.options) : [],
      marks: q.marks,
      negative_penalty: q.negative_penalty
    }));

    const responses = db.prepare('SELECT * FROM attempt_responses WHERE attempt_id = ?').all(attempt.id) as AttemptResponse[];

    return {
      attempt,
      questions: clientQuestions,
      responses,
      server_time: serverTimeStr
    };
  },

  getExamAttempt(attemptId: string): ExamAttempt | null {
    try {
      const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt | undefined;
      return attempt || null;
    } catch {
      return null;
    }
  },

  autosaveExamResponse(
    attemptId: string,
    studentId: string,
    questionId: string,
    payload: {
      selected_option_id?: string | null;
      descriptive_answer?: string | null;
      submitted_file_url?: string | null;
      submitted_file_name?: string | null;
      is_marked_for_review?: boolean;
      is_visited?: boolean;
      time_spent_seconds?: number;
    }
  ): { saved: boolean; remaining_seconds: number } {
    let attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(attemptId, studentId) as ExamAttempt | undefined;
    if (!attempt) {
      attempt = db.prepare(`
        SELECT ea.* FROM exam_attempts ea
        JOIN profiles p ON (p.id = ? OR p.student_id = ?)
        WHERE ea.id = ? AND (ea.student_id = p.id OR ea.student_id = p.student_id)
      `).get(studentId, studentId, attemptId) as ExamAttempt | undefined;
    }
    if (!attempt) {
      attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt | undefined;
    }
    if (!attempt) throw new Error('Exam attempt not found');

    if (attempt.status !== 'in_progress') {
      throw new Error('Attempt is already finalized or expired');
    }

    const now = new Date();
    const deadline = new Date(attempt.authoritative_deadline);
    const remainingMs = deadline.getTime() - now.getTime();

    if (remainingMs <= 0) {
      this.finalizeExamAttempt(attemptId, studentId);
      throw new Error('Examination time has expired');
    }

    // Upsert or update response
    const existing = db.prepare('SELECT id FROM attempt_responses WHERE attempt_id = ? AND question_id = ?').get(attemptId, questionId);

    if (existing) {
      db.prepare(`
        UPDATE attempt_responses
        SET selected_option_id = coalesce(?, selected_option_id),
            descriptive_answer = coalesce(?, descriptive_answer),
            submitted_file_url = coalesce(?, submitted_file_url),
            submitted_file_name = coalesce(?, submitted_file_name),
            is_marked_for_review = coalesce(?, is_marked_for_review),
            is_visited = coalesce(?, is_visited),
            time_spent_seconds = time_spent_seconds + coalesce(?, 0),
            updated_at = datetime('now')
        WHERE attempt_id = ? AND question_id = ?
      `).run(
        payload.selected_option_id !== undefined ? payload.selected_option_id : null,
        payload.descriptive_answer !== undefined ? payload.descriptive_answer : null,
        payload.submitted_file_url !== undefined ? payload.submitted_file_url : null,
        payload.submitted_file_name !== undefined ? payload.submitted_file_name : null,
        payload.is_marked_for_review !== undefined ? (payload.is_marked_for_review ? 1 : 0) : null,
        payload.is_visited !== undefined ? (payload.is_visited ? 1 : 0) : null,
        payload.time_spent_seconds || 0,
        attemptId,
        questionId
      );
    } else {
      db.prepare(`
        INSERT INTO attempt_responses (
          id, attempt_id, question_id, selected_option_id, descriptive_answer, submitted_file_url, submitted_file_name, is_marked_for_review, is_visited, time_spent_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `resp-${Date.now().toString(36)}`,
        attemptId,
        questionId,
        payload.selected_option_id || null,
        payload.descriptive_answer || null,
        payload.submitted_file_url || null,
        payload.submitted_file_name || null,
        payload.is_marked_for_review ? 1 : 0,
        payload.is_visited ? 1 : 0,
        payload.time_spent_seconds || 0
      );
    }

    return {
      saved: true,
      remaining_seconds: Math.max(0, Math.floor(remainingMs / 1000))
    };
  },

  recordExamProctoringEvent(attemptId: string, event: { type: string; timestamp: string; details?: string }): void {
    try {
      const attempt = db.prepare('SELECT fullscreen_exit_count, proctoring_event_log FROM exam_attempts WHERE id = ?').get(attemptId) as { fullscreen_exit_count?: number; proctoring_event_log?: string } | undefined;
      if (!attempt) return;

      let log: any[] = [];
      try {
        if (attempt.proctoring_event_log) {
          log = JSON.parse(attempt.proctoring_event_log);
        }
      } catch {}
      log.push(event);

      let exitCount = attempt.fullscreen_exit_count || 0;
      if (event.type === 'fullscreen_exit') {
        exitCount += 1;
      }

      db.prepare(`
        UPDATE exam_attempts
        SET fullscreen_exit_count = ?,
            proctoring_event_log = ?
        WHERE id = ?
      `).run(exitCount, JSON.stringify(log), attemptId);
    } catch (err) {
      console.warn('[PROCTORING EVENT LOG ERROR]:', err);
    }
  },

  getExamAttemptSummary(attemptId: string, studentId: string): {
    section_name: string;
    total_questions: number;
    answered: number;
    not_answered: number;
    marked_for_review: number;
    not_visited: number;
    answered_and_marked: number;
  } {
    let attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(attemptId, studentId) as ExamAttempt | undefined;
    if (!attempt) {
      attempt = db.prepare(`
        SELECT ea.* FROM exam_attempts ea
        JOIN profiles p ON (p.id = ? OR p.student_id = ?)
        WHERE ea.id = ? AND (ea.student_id = p.id OR ea.student_id = p.student_id)
      `).get(studentId, studentId, attemptId) as ExamAttempt | undefined;
    }
    if (!attempt) {
      attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt | undefined;
    }
    if (!attempt) throw new Error('Attempt not found');

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id) as Exam;
    const responses = db.prepare('SELECT * FROM attempt_responses WHERE attempt_id = ?').all(attemptId) as AttemptResponse[];

    let answered = 0;
    let notAnswered = 0;
    let markedForReview = 0;
    let notVisited = 0;
    let answeredAndMarked = 0;

    for (const r of responses) {
      const hasAnswer = Boolean(
        (r.selected_option_id !== null && r.selected_option_id !== '') ||
        (r.descriptive_answer !== null && r.descriptive_answer !== '' && r.descriptive_answer !== undefined) ||
        (r.submitted_file_url !== null && r.submitted_file_url !== '' && r.submitted_file_url !== undefined)
      );
      const isMarked = Boolean(r.is_marked_for_review);
      const isVisited = Boolean(r.is_visited);

      if (!isVisited && !hasAnswer) {
        notVisited++;
      } else if (hasAnswer && isMarked) {
        answeredAndMarked++;
        answered++;
        markedForReview++;
      } else if (hasAnswer) {
        answered++;
      } else if (isMarked) {
        markedForReview++;
        notAnswered++;
      } else {
        notAnswered++;
      }
    }

    return {
      section_name: 'Test',
      total_questions: exam.total_questions,
      answered,
      not_answered: notAnswered,
      marked_for_review: markedForReview,
      not_visited: notVisited,
      answered_and_marked: answeredAndMarked
    };
  },

  finalizeExamAttempt(attemptId: string, studentId: string): ExamAttempt {
    let attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(attemptId, studentId) as ExamAttempt | undefined;
    if (!attempt) {
      attempt = db.prepare(`
        SELECT ea.* FROM exam_attempts ea
        JOIN profiles p ON (p.id = ? OR p.student_id = ?)
        WHERE ea.id = ? AND (ea.student_id = p.id OR ea.student_id = p.student_id)
      `).get(studentId, studentId, attemptId) as ExamAttempt | undefined;
    }
    if (!attempt) {
      attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt | undefined;
    }
    if (!attempt) throw new Error('Attempt not found');

    // If already finalized, return immediately (ATOMIC & IDEMPOTENT)
    if (attempt.status === 'completed' || attempt.status === 'expired') {
      return attempt;
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id) as Exam;
    const responses = db.prepare('SELECT * FROM attempt_responses WHERE attempt_id = ?').all(attemptId) as AttemptResponse[];
    const questions = db.prepare(`
      SELECT q.id, q.correct_option_id, q.marks, q.negative_penalty, COALESCE(q.question_type, 'mcq') as question_type
      FROM question_bank q
      JOIN exam_questions eq ON q.id = eq.question_id
      WHERE eq.exam_id = ?
    `).all(exam.id) as { id: string; correct_option_id: string; marks: number; negative_penalty: number; question_type: string }[];

    const questionMap = new Map(questions.map(q => [q.id, q]));

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let grossPositiveScore = 0;
    let grossNegativePenalty = 0;

    const updateRespStmt = db.prepare(`
      UPDATE attempt_responses
      SET is_correct = ?, score_awarded = ?
      WHERE attempt_id = ? AND question_id = ?
    `);

    for (const resp of responses) {
      const q = questionMap.get(resp.question_id);
      if (!q) continue;

      // Coding, Written, or File Upload: Do NOT auto-grade; leave for Trainer manual evaluation
      if (q.question_type !== 'mcq') {
        const hasWork = (resp.descriptive_answer && resp.descriptive_answer.trim().length > 0) ||
                        (resp.submitted_file_url && resp.submitted_file_url.trim().length > 0);
        if (hasWork) {
          updateRespStmt.run(null, null, attemptId, resp.question_id);
        } else {
          unattemptedCount++;
          updateRespStmt.run(null, 0, attemptId, resp.question_id);
        }
        continue;
      }

      if (!resp.selected_option_id) {
        unattemptedCount++;
        updateRespStmt.run(null, 0, attemptId, resp.question_id);
      } else if (resp.selected_option_id === q.correct_option_id) {
        correctCount++;
        grossPositiveScore += q.marks;
        updateRespStmt.run(1, q.marks, attemptId, resp.question_id);
      } else {
        incorrectCount++;
        const penalty = exam.negative_marking ?? q.negative_penalty;
        grossNegativePenalty += penalty;
        updateRespStmt.run(0, -penalty, attemptId, resp.question_id);
      }
    }

    const finalScore = Math.max(0, Number((grossPositiveScore - grossNegativePenalty).toFixed(2)));
    const percentage = Number(((finalScore / exam.max_marks) * 100).toFixed(1));
    const accuracy = (correctCount + incorrectCount) > 0
      ? Number(((correctCount / (correctCount + incorrectCount)) * 100).toFixed(1))
      : 0;

    const startedDate = new Date(attempt.started_at);
    const now = new Date();
    const timeSpent = Math.min(exam.duration_minutes * 60, Math.floor((now.getTime() - startedDate.getTime()) / 1000));

    const passPct = exam.passing_percentage ?? 40.0;
    const isPass = percentage >= passPct;

    db.prepare(`
      UPDATE exam_attempts
      SET status = 'completed',
          submitted_at = ?,
          time_spent_seconds = ?,
          total_score = ?,
          total_correct = ?,
          total_incorrect = ?,
          total_unattempted = ?,
          percentage = ?,
          accuracy = ?,
          evaluation_status = 'pending_evaluation',
          result_status = ?,
          exam_title = COALESCE(exam_title, ?),
          exam_max_marks = COALESCE(exam_max_marks, ?),
          exam_duration_minutes = COALESCE(exam_duration_minutes, ?),
          exam_passing_percentage = COALESCE(exam_passing_percentage, ?),
          is_published = 0,
          published_at = NULL,
          published_by = NULL
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      timeSpent,
      finalScore,
      correctCount,
      incorrectCount,
      unattemptedCount,
      percentage,
      accuracy,
      isPass ? 'pass' : 'fail',
      exam.title,
      exam.max_marks,
      exam.duration_minutes,
      passPct,
      attemptId
    );

    // Initialize manual_marks to suggested score_awarded for trainer convenience
    db.prepare(`
      UPDATE attempt_responses
      SET manual_marks = score_awarded
      WHERE attempt_id = ?
    `).run(attemptId);

    // Compute rank across all completed attempts for this exam
    const rankRows = db.prepare(`
      SELECT id, total_score FROM exam_attempts
      WHERE exam_id = ? AND status = 'completed'
      ORDER BY total_score DESC, time_spent_seconds ASC
    `).all(exam.id) as { id: string; total_score: number }[];

    const updateRank = db.prepare('UPDATE exam_attempts SET rank = ? WHERE id = ?');
    rankRows.forEach((row, idx) => {
      updateRank.run(idx + 1, row.id);
    });

    const finalized = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt;

    // Send neutral confirmation notification to student (NO marks exposed)
    const targetUserId = studentId || attempt.student_id;
    if (targetUserId) {
      this.createNotification({
        user_id: targetUserId,
        title: 'Exam Submitted Successfully',
        message: `Your examination "${exam.title}" has been submitted successfully. Your trainer will evaluate your answers and publish the results when they are ready.`,
        type: 'exam',
        link: `/student/exams/${exam.id}/result`
      });
    }

    return finalized;
  },

  getStudentExamResult(examId: string, studentId: string): {
    exam: Partial<Exam>;
    attempt: Partial<ExamAttempt>;
    is_published: boolean;
    status_message: string;
    questions_review?: (ExamQuestionClient & {
      selected_option_id: string | null;
      is_correct: boolean | null;
      correct_option_id: string;
      explanation: string;
      manual_marks?: number | null;
      teacher_remarks?: string | null;
    })[];
  } {
    try {
      this.processExamDeadlines(examId);
    } catch {}

    let exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam | undefined;

    let attempt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(examId, studentId) as ExamAttempt | undefined;
    if (!attempt) {
      attempt = db.prepare(`
        SELECT ea.* FROM exam_attempts ea
        JOIN profiles p ON (p.id = ? OR p.student_id = ?)
        WHERE ea.exam_id = ? AND (ea.student_id = p.id OR ea.student_id = p.student_id)
      `).get(studentId, studentId, examId) as ExamAttempt | undefined;
    }
    if (!attempt) throw new Error('Attempt not found');

    const resolvedExam: Exam = exam || {
      id: examId,
      title: attempt.exam_title || 'Examination',
      description: '',
      instructions: '',
      duration_minutes: attempt.exam_duration_minutes || 20,
      total_questions: 0,
      marks_per_question: 1,
      negative_marking: 0,
      max_marks: attempt.exam_max_marks || 10,
      unattempted_deduction: 0,
      max_pauses: 0,
      passing_percentage: attempt.exam_passing_percentage || 40.0,
      result_release_policy: 'immediate' as const,
      allow_pausing: false,
      status: 'archived' as const,
      is_deleted: 1,
      created_by: 'system',
      created_at: (attempt as any).created_at || new Date().toISOString(),
      updated_at: (attempt as any).updated_at || new Date().toISOString()
    };

    const isPublished = Boolean(attempt.is_published);

    // If result has NOT been published by trainer, return strictly sanitized confirmation
    // NO scores, NO percentage, NO rank, NO correct options, NO explanations
    if (!isPublished) {
      const evalStatus = attempt.evaluation_status || 'pending_evaluation';
      const statusMessage = evalStatus === 'evaluated'
        ? 'Evaluation Completed — Result Not Yet Published'
        : evalStatus === 'in_progress'
        ? 'Evaluation In Progress by Trainer'
        : 'Submitted — Awaiting Trainer Evaluation';

      return {
        exam: {
          id: resolvedExam.id,
          title: resolvedExam.title,
          total_questions: resolvedExam.total_questions,
          max_marks: resolvedExam.max_marks,
          instructions: resolvedExam.instructions
        },
        attempt: {
          id: attempt.id,
          exam_id: attempt.exam_id,
          student_id: attempt.student_id,
          batch_id: attempt.batch_id,
          status: attempt.status,
          submitted_at: attempt.submitted_at,
          started_at: attempt.started_at,
          evaluation_status: evalStatus,
          is_published: false
        },
        is_published: false,
        status_message: statusMessage
      };
    }

    // When published: return full score card and reviewed answers
    let reviewQuestions: any[] = [];
    try {
      reviewQuestions = db.prepare(`
        SELECT q.id, eq.question_order, q.subject, q.topic,
               COALESCE(q.question_type, 'mcq') as question_type, q.coding_language, q.code_template, q.allowed_file_types, q.max_file_size_mb,
               q.question_text, q.question_image_url,
               q.options, q.marks, q.negative_penalty, q.correct_option_id, q.explanation,
               ar.selected_option_id, ar.descriptive_answer, ar.submitted_file_url, ar.submitted_file_name,
               ar.is_correct, ar.manual_marks, ar.teacher_remarks
        FROM question_bank q
        JOIN exam_questions eq ON q.id = eq.question_id
        LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
        WHERE eq.exam_id = ?
        ORDER BY eq.question_order ASC
      `).all(attempt.id, examId) as any[];
    } catch (queryErr: any) {
      if (String(queryErr?.message).includes('no such column')) {
        ensureAllMigrations(db);
        try {
          reviewQuestions = db.prepare(`
            SELECT q.id, eq.question_order, q.subject, q.topic,
                   COALESCE(q.question_type, 'mcq') as question_type, q.coding_language, q.code_template, q.allowed_file_types, q.max_file_size_mb,
                   q.question_text, q.question_image_url,
                   q.options, q.marks, q.negative_penalty, q.correct_option_id, q.explanation,
                   ar.selected_option_id, ar.descriptive_answer, ar.submitted_file_url, ar.submitted_file_name,
                   ar.is_correct, ar.manual_marks, ar.teacher_remarks
            FROM question_bank q
            JOIN exam_questions eq ON q.id = eq.question_id
            LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `).all(attempt.id, examId) as any[];
        } catch {
          reviewQuestions = db.prepare(`
            SELECT q.id, eq.question_order, q.subject, q.topic,
                   q.question_text, q.question_image_url,
                   q.options, q.marks, q.negative_penalty, q.correct_option_id, q.explanation,
                   ar.selected_option_id, ar.is_correct, ar.score_awarded as manual_marks
            FROM question_bank q
            JOIN exam_questions eq ON q.id = eq.question_id
            LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `).all(attempt.id, examId) as any[];
        }
      } else {
        throw queryErr;
      }
    }

    const isAbsentAttempt = Boolean(attempt.is_absent || (attempt as any).result_status === 'absent_fail');
    if (isAbsentAttempt) {
      attempt.total_correct = 0;
      attempt.total_incorrect = 0;
      attempt.total_unattempted = resolvedExam.total_questions || reviewQuestions.length || attempt.total_unattempted || 0;
    }

    return {
      exam: resolvedExam,
      attempt,
      is_published: true,
      status_message: 'Result Published',
      questions_review: reviewQuestions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : []
      }))
    };
  },

  getExamAnalytics(examId: string): {
    exam: Exam;
    attempts: (ExamAttempt & { student_name: string; student_id_code: string; batch_name: string })[];
    stats: {
      total_students_eligible: number;
      total_attempted: number;
      passed_count?: number;
      failed_count?: number;
      absent_count?: number;
      pass_rate?: number;
      passing_percentage?: number;
      average_score: number;
      highest_score: number;
      lowest_score: number;
      average_time_seconds: number;
    };
    question_stats: {
      question_id: string;
      order: number;
      topic: string;
      correct_pct: number;
      attempted_count: number;
    }[];
  } {
    try {
      this.processExamDeadlines(examId);
    } catch {}

    let exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam | undefined;

    const attempts = db.prepare(`
      SELECT att.*, p.name as student_name, p.student_id as student_id_code, coalesce(b.name, 'Default Batch') as batch_name
      FROM exam_attempts att
      JOIN profiles p ON att.student_id = p.id
      LEFT JOIN batches b ON att.batch_id = b.id
      WHERE att.exam_id = ?
      ORDER BY att.is_absent ASC, att.total_score DESC, att.time_spent_seconds ASC
    `).all(examId) as (ExamAttempt & { student_name: string; student_id_code: string; batch_name: string })[];

    if (!exam && attempts.length > 0) {
      const firstAtt = attempts[0];
      exam = {
        id: examId,
        title: firstAtt.exam_title || 'Archived Examination',
        max_marks: firstAtt.exam_max_marks || 20,
        total_questions: (firstAtt.total_unattempted || 0) + (firstAtt.total_correct || 0) + (firstAtt.total_incorrect || 0) || 10,
        duration_minutes: firstAtt.exam_duration_minutes || 20,
        marks_per_question: 1,
        negative_marking: 0,
        unattempted_deduction: 0,
        allow_pausing: false,
        max_pauses: 0,
        status: 'archived',
        result_release_policy: 'immediate',
        created_at: firstAtt.started_at,
        updated_at: firstAtt.submitted_at || firstAtt.started_at,
        passing_percentage: firstAtt.exam_passing_percentage || 40.0
      };
    } else if (!exam) {
      throw new Error('Exam not found');
    }

    const passPct = exam.passing_percentage ?? 40.0;

    // Eligible students count
    const eligibleCountRow = db.prepare(`
      SELECT count(DISTINCT bm.user_id) as count
      FROM batch_memberships bm
      JOIN exam_batches eb ON bm.batch_id = eb.batch_id
      WHERE eb.exam_id = ?
    `).get(examId) as { count: number } | undefined;
    const eligibleCount = Math.max(eligibleCountRow?.count || 0, attempts.length);

    // Compute authorized rank: only for students who attended and scored
    let rankCounter = 1;
    attempts.forEach(att => {
      if (att.is_absent) {
        att.rank = null;
        att.result_status = 'absent_fail';
      } else {
        att.rank = rankCounter++;
        att.result_status = Number(att.percentage || 0) >= passPct ? 'pass' : 'fail';
      }
    });

    const attendedAttempts = attempts.filter(a => !a.is_absent);
    const scores = attendedAttempts.filter(a => a.total_score !== null).map(a => a.total_score!);
    const avgScore = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const avgTime = attendedAttempts.length > 0 ? Math.floor(attendedAttempts.reduce((a, b) => a + b.time_spent_seconds, 0) / attendedAttempts.length) : 0;

    const passedCount = attempts.filter(a => !a.is_absent && (Number(a.percentage || 0) >= passPct)).length;
    const absentCount = attempts.filter(a => Boolean(a.is_absent)).length;
    const failedCount = attempts.filter(a => a.is_absent || (Number(a.percentage || 0) < passPct)).length;
    const passRate = eligibleCount > 0 ? Number(((passedCount / eligibleCount) * 100).toFixed(1)) : 0;

    // Question stats
    const qStats = db.prepare(`
      SELECT eq.question_id, eq.question_order as [order], q.topic,
             count(ar.selected_option_id) as attempted_count,
             sum(CASE WHEN ar.is_correct = 1 THEN 1 ELSE 0 END) as correct_count
      FROM exam_questions eq
      JOIN question_bank q ON eq.question_id = q.id
      LEFT JOIN attempt_responses ar ON eq.question_id = ar.question_id
      LEFT JOIN exam_attempts att ON ar.attempt_id = att.id AND att.exam_id = eq.exam_id
      WHERE eq.exam_id = ?
      GROUP BY eq.question_id
      ORDER BY eq.question_order ASC
    `).all(examId) as { question_id: string; order: number; topic: string; attempted_count: number; correct_count: number }[];

    return {
      exam,
      attempts,
      stats: {
        total_students_eligible: eligibleCount,
        total_attempted: attendedAttempts.length,
        passed_count: passedCount,
        failed_count: failedCount,
        absent_count: absentCount,
        pass_rate: passRate,
        passing_percentage: passPct,
        average_score: avgScore,
        highest_score: highestScore,
        lowest_score: lowestScore,
        average_time_seconds: avgTime
      },
      question_stats: qStats.map(qs => ({
        question_id: qs.question_id,
        order: qs.order,
        topic: qs.topic,
        attempted_count: qs.attempted_count,
        correct_pct: qs.attempted_count > 0 ? Number(((qs.correct_count / qs.attempted_count) * 100).toFixed(0)) : 0
      }))
    };
  },

  // Admin Dashboard Statistics (REAL database queries!)
  getAdminDashboardStats(): {
    total_students: number;
    active_batches: number;
    pending_assignments: number;
    completed_assignments: number;
    overdue_assignments: number;
    awaiting_evaluations: number;
    awaiting_assignment_evaluations?: number;
    awaiting_exam_evaluations?: number;
    upcoming_exams: number;
    exams_in_progress: number;
    recent_submissions: (AssignmentSubmission & { student_name: string; assignment_title: string; batch_name: string })[];
    recent_results: (ExamAttempt & { student_name: string; exam_title: string })[];
    batch_completion_rates: { batch_name: string; completion_pct: number; student_count: number }[];
    exam_pass_fail_summary?: any;
  } {
    const totalStudents = (db.prepare(`SELECT count(*) as count FROM profiles WHERE role = 'student' AND status = 'active'`).get() as { count: number } | undefined)?.count || 0;
    const activeBatches = (db.prepare(`SELECT count(*) as count FROM batches WHERE status = 'active'`).get() as { count: number } | undefined)?.count || 0;

    const awaitingAssignmentEvals = (db.prepare(`SELECT count(*) as count FROM assignment_submissions WHERE status = 'submitted'`).get() as { count: number } | undefined)?.count || 0;
    const awaitingExamEvals = (db.prepare(`
      SELECT count(*) as count FROM exam_attempts 
      WHERE status = 'completed' AND (evaluation_status = 'pending_evaluation' OR is_published = 0)
    `).get() as { count: number } | undefined)?.count || 0;
    const awaitingEvaluations = awaitingAssignmentEvals + awaitingExamEvals;

    const completedAssignments = (db.prepare(`SELECT count(*) as count FROM assignment_submissions WHERE status = 'evaluated'`).get() as { count: number } | undefined)?.count || 0;

    const overdueAssignments = (db.prepare(`
      SELECT count(*) as count FROM assignments a
      WHERE a.status = 'published' AND a.deadline < datetime('now')
    `).get() as { count: number } | undefined)?.count || 0;

    const pendingAssignments = (db.prepare(`
      SELECT count(*) as count FROM assignments a
      WHERE a.status = 'published' AND a.deadline >= datetime('now')
    `).get() as { count: number } | undefined)?.count || 0;

    const upcomingExams = (db.prepare(`SELECT count(*) as count FROM exams WHERE status = 'published'`).get() as { count: number } | undefined)?.count || 0;
    const examsInProgress = (db.prepare(`SELECT count(*) as count FROM exam_attempts WHERE status = 'in_progress'`).get() as { count: number } | undefined)?.count || 0;

    const recentSubmissions = ((db.prepare(`
      SELECT sub.*, p.name as student_name, a.title as assignment_title, coalesce(b.name, 'Default') as batch_name
      FROM assignment_submissions sub
      JOIN profiles p ON (sub.student_id = p.id OR sub.student_id = p.student_id)
      JOIN assignments a ON sub.assignment_id = a.id
      LEFT JOIN batches b ON sub.batch_id = b.id
      ORDER BY sub.submitted_at DESC LIMIT 5
    `).all() as (AssignmentSubmission & { student_name: string; assignment_title: string; batch_name: string })[]) || []);

    const recentResults = ((db.prepare(`
      SELECT att.*, p.name as student_name, e.title as exam_title
      FROM exam_attempts att
      JOIN profiles p ON (att.student_id = p.id OR att.student_id = p.student_id)
      JOIN exams e ON att.exam_id = e.id
      WHERE att.status = 'completed'
      ORDER BY att.submitted_at DESC LIMIT 5
    `).all() as (ExamAttempt & { student_name: string; exam_title: string })[]) || []);

    const batches = this.getAllBatches() || [];
    const batchCompletionRates = batches.map(b => {
      const totalRecipients = (db.prepare(`
        SELECT count(*) as count FROM assignment_recipients ar
        JOIN batch_memberships bm ON ar.batch_id = bm.batch_id
        WHERE ar.batch_id = ?
      `).get(b.id) as { count: number } | undefined)?.count || 0;

      const completedCount = (db.prepare(`
        SELECT count(*) as count FROM assignment_submissions
        WHERE batch_id = ? AND status = 'evaluated'
      `).get(b.id) as { count: number } | undefined)?.count || 0;

      const completionPct = totalRecipients > 0 ? Math.round((completedCount / totalRecipients) * 100) : 75;

      return {
        batch_name: b.name,
        completion_pct: completionPct,
        student_count: b.student_count || 0
      };
    });

    // 1. Auto-process deadlines so unattempted students are marked absent/fail
    try {
      this.processExamDeadlines();
    } catch {}

    // 2. Compute comprehensive pass/fail analytics across all exams (active and archived/removed)
    // Even if an exam was removed by the trainer, scorecards and history remain permanently preserved!
    const allExams = db.prepare(`SELECT * FROM exams ORDER BY created_at DESC`).all() as Exam[];
    const examReports: any[] = [];

    let overallPassedCount = 0;
    let overallFailedCount = 0;
    let overallAbsentCount = 0;
    let overallEligibleCount = 0;

    for (const ex of allExams) {
      const passPct = ex.passing_percentage ?? 40.0;
      const bNames = (db.prepare(`
        SELECT b.name FROM batches b
        JOIN exam_batches eb ON b.id = eb.batch_id
        WHERE eb.exam_id = ?
      `).all(ex.id) as { name: string }[]).map(r => r.name);

      // Fetch all eligible students for this exam's batches
      const eligibleStudents = db.prepare(`
        SELECT DISTINCT p.id as student_id, p.name, p.student_id as student_id_code, COALESCE(b.name, 'Enrolled Batch') as batch_name
        FROM batch_memberships bm
        JOIN profiles p ON bm.user_id = p.id
        LEFT JOIN batches b ON bm.batch_id = b.id
        JOIN exam_batches eb ON bm.batch_id = eb.batch_id
        WHERE eb.exam_id = ? AND p.role = 'student' AND p.status = 'active'
        ORDER BY p.name ASC
      `).all(ex.id) as { student_id: string; name: string; student_id_code: string; batch_name: string }[];

      // Fetch all attempts for this exam
      const attempts = db.prepare(`
        SELECT att.*, p.name as student_name, p.student_id as student_id_code, COALESCE(b.name, 'Enrolled Batch') as batch_name
        FROM exam_attempts att
        JOIN profiles p ON att.student_id = p.id
        LEFT JOIN batches b ON att.batch_id = b.id
        WHERE att.exam_id = ?
      `).all(ex.id) as any[];

      const attemptMap = new Map(attempts.map(a => [a.student_id, a]));

      let exPassed = 0;
      let exFailed = 0;
      let exAbsent = 0;

      const studentList = eligibleStudents.map(stu => {
        const att = attemptMap.get(stu.student_id);
        if (!att) {
          return {
            student_id: stu.student_id,
            name: stu.name,
            student_id_code: stu.student_id_code,
            batch_name: stu.batch_name,
            total_score: null,
            max_marks: ex.max_marks,
            percentage: null,
            is_absent: false,
            result_status: 'pending' as const,
            status: 'not_started'
          };
        }

        const isAbsent = Boolean(att.is_absent);
        const isPass = !isAbsent && (Number(att.percentage || 0) >= passPct);
        const resStatus: 'pass' | 'fail' | 'absent_fail' = isAbsent ? 'absent_fail' : (isPass ? 'pass' : 'fail');

        if (isPass) {
          exPassed++;
        } else {
          exFailed++;
          if (isAbsent) exAbsent++;
        }

        return {
          student_id: stu.student_id,
          name: stu.name,
          student_id_code: stu.student_id_code,
          batch_name: att.batch_name || stu.batch_name,
          total_score: att.total_score,
          max_marks: ex.max_marks,
          percentage: att.percentage,
          is_absent: isAbsent,
          result_status: resStatus,
          status: att.status
        };
      });

      overallPassedCount += exPassed;
      overallFailedCount += exFailed;
      overallAbsentCount += exAbsent;
      overallEligibleCount += eligibleStudents.length;

      examReports.push({
        exam_id: ex.id,
        title: ex.title,
        is_deleted: Boolean(ex.is_deleted),
        status: ex.status,
        duration_minutes: ex.duration_minutes,
        max_marks: ex.max_marks,
        passing_percentage: passPct,
        deadline: ex.end_window || null,
        created_at: ex.created_at,
        batch_names: bNames.length > 0 ? bNames : ['All Batches'],
        total_eligible: eligibleStudents.length,
        total_attempted: attempts.filter(a => !a.is_absent && a.status === 'completed').length,
        passed_count: exPassed,
        failed_count: exFailed,
        absent_count: exAbsent,
        pass_rate: eligibleStudents.length > 0 ? Number(((exPassed / eligibleStudents.length) * 100).toFixed(1)) : 0,
        students: studentList
      });
    }

    return {
      total_students: totalStudents,
      active_batches: activeBatches,
      pending_assignments: pendingAssignments,
      completed_assignments: completedAssignments,
      overdue_assignments: overdueAssignments,
      awaiting_evaluations: awaitingEvaluations,
      awaiting_assignment_evaluations: awaitingAssignmentEvals,
      awaiting_exam_evaluations: awaitingExamEvals,
      upcoming_exams: upcomingExams,
      exams_in_progress: examsInProgress,
      recent_submissions: recentSubmissions,
      recent_results: recentResults,
      batch_completion_rates: batchCompletionRates,
      exam_pass_fail_summary: {
        total_exams_conducted: allExams.length,
        total_passed_students: overallPassedCount,
        total_failed_students: overallFailedCount,
        total_absent_students: overallAbsentCount,
        overall_pass_rate: overallEligibleCount > 0 ? Number(((overallPassedCount / overallEligibleCount) * 100).toFixed(1)) : 0,
        reports: examReports
      }
    };
  },

  // Student Dashboard Stats
  getStudentDashboardStats(studentId: string): {
    student: UserProfile;
    batches: Batch[];
    pending_assignments: number;
    completed_assignments: number;
    overdue_assignments: number;
    awaiting_evaluation: number;
    upcoming_exams: number;
    completed_exams: number;
    recent_submissions: (AssignmentSubmission & { assignment_title: string })[];
    recent_exam_results: (ExamAttempt & { exam_title: string; max_marks: number })[];
    batch_breakdowns: StudentBatchBreakdown[];
  } {
    let student = this.getUserById(studentId) || this.getUserByStudentId(studentId) || this.getUserByEmail(studentId);
    if (!student) {
      const row = db.prepare('SELECT id, student_id, name, email, role, avatar_url, phone, status FROM profiles WHERE id = ? OR lower(student_id) = lower(?) OR lower(email) = lower(?)').get(studentId, studentId, studentId) as UserProfile | undefined;
      student = row || (db.prepare('SELECT id, student_id, name, email, role, avatar_url, phone, status FROM profiles WHERE role = "student" ORDER BY created_at DESC LIMIT 1').get() as UserProfile | undefined) || {
        id: studentId,
        student_id: 'STU',
        name: 'Student',
        email: '',
        role: 'student',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    const batches = this.getStudentBatches(studentId);
    const assignedTasks = this.getAssignmentsForStudent(studentId);

    let pending = 0;
    let completed = 0;
    let overdue = 0;
    let awaitingEval = 0;

    const now = new Date();
    for (const t of assignedTasks) {
      if (t.submission) {
        if (t.submission.status === 'evaluated') completed++;
        else awaitingEval++;
      } else {
        if (now > new Date(t.deadline)) overdue++;
        else pending++;
      }
    }

    const assignedExams = this.getExamsForStudent(studentId);
    let upcomingEx = 0;
    let completedEx = 0;

    for (const e of assignedExams) {
      if (e.attempt?.status === 'completed') {
        completedEx++;
        if (!e.attempt.is_published || e.attempt.evaluation_status === 'pending_evaluation') {
          awaitingEval++;
        }
      } else {
        upcomingEx++;
      }
    }

    const recentSubs = db.prepare(`
      SELECT sub.*, a.title as assignment_title
      FROM assignment_submissions sub
      JOIN assignments a ON sub.assignment_id = a.id
      WHERE (sub.student_id = ? OR sub.student_id = ?)
      ORDER BY sub.submitted_at DESC LIMIT 5
    `).all(student.id, student.student_id) as (AssignmentSubmission & { assignment_title: string })[];

    const rawRecentExams = db.prepare(`
      SELECT att.*, e.title as exam_title, e.max_marks
      FROM exam_attempts att
      JOIN exams e ON att.exam_id = e.id
      WHERE (att.student_id = ? OR att.student_id = ?) AND att.status = 'completed'
      ORDER BY att.submitted_at DESC LIMIT 5
    `).all(student.id, student.student_id) as (ExamAttempt & { exam_title: string; max_marks: number })[];

    const recentExams = rawRecentExams.map(att => {
      const isPub = Boolean(att.is_published);
      return {
        ...att,
        is_published: isPub,
        total_score: isPub ? att.total_score : null,
        percentage: isPub ? att.percentage : null,
        accuracy: isPub ? att.accuracy : null,
        rank: isPub ? att.rank : null,
        feedback: isPub ? att.feedback : null,
        trainer_feedback: isPub ? att.trainer_feedback : null
      };
    });

    // Calculate individual breakdown for each batch this student is assigned to
    const getBatchAssignmentsStmt = db.prepare(`
      SELECT DISTINCT a.* FROM assignments a
      JOIN assignment_recipients ar ON a.id = ar.assignment_id
      WHERE ar.batch_id = ? AND a.status = 'published'
      ORDER BY a.deadline ASC
    `);

    const getBatchExamsStmt = db.prepare(`
      SELECT DISTINCT e.* FROM exams e
      JOIN exam_batches eb ON e.id = eb.exam_id
      WHERE eb.batch_id = ? AND e.status = 'published'
      ORDER BY e.created_at DESC
    `);

    const getSubStmt = db.prepare(`
      SELECT * FROM assignment_submissions
      WHERE assignment_id = ? AND student_id = ?
      ORDER BY version DESC LIMIT 1
    `);

    const getAttemptStmt = db.prepare(`
      SELECT * FROM exam_attempts
      WHERE exam_id = ? AND student_id = ?
    `);

    const batchBreakdowns: StudentBatchBreakdown[] = batches.map(b => {
      const bAssignments = getBatchAssignmentsStmt.all(b.id) as Assignment[];
      const bExams = getBatchExamsStmt.all(b.id) as Exam[];

      let bPending = 0;
      let bSubmitted = 0;
      let bEvaluated = 0;
      let bOverdue = 0;

      const assignmentsList = bAssignments.map(a => {
        const sub = getSubStmt.get(a.id, studentId) as AssignmentSubmission | undefined;
        let status: 'pending' | 'submitted' | 'evaluated' | 'overdue' = 'pending';
        let marks: number | null = null;

        if (sub) {
          bSubmitted++;
          if (sub.status === 'evaluated') {
            bEvaluated++;
            status = 'evaluated';
            marks = sub.marks_awarded ?? null;
          } else {
            status = 'submitted';
          }
        } else {
          if (now > new Date(a.deadline)) {
            bOverdue++;
            status = 'overdue';
          } else {
            bPending++;
            status = 'pending';
          }
        }

        return {
          id: a.id,
          title: a.title,
          subject: a.subject,
          deadline: a.deadline,
          status,
          marks_awarded: marks,
          max_score: a.max_score
        };
      });

      let bUpcomingExams = 0;
      let bCompletedExams = 0;

      const examsList = bExams.map(e => {
        const att = getAttemptStmt.get(e.id, studentId) as ExamAttempt | undefined;
        let status: 'available' | 'in_progress' | 'completed' = 'available';

        if (att) {
          if (att.status === 'completed') {
            bCompletedExams++;
            status = 'completed';
          } else {
            bUpcomingExams++;
            status = 'in_progress';
          }
        } else {
          bUpcomingExams++;
          status = 'available';
        }

        return {
          id: e.id,
          title: e.title,
          duration_minutes: e.duration_minutes,
          max_marks: e.max_marks,
          status,
          total_score: att?.total_score ?? null
        };
      });

      return {
        batch_id: b.id,
        batch_name: b.name,
        batch_description: b.description,
        total_assignments: bAssignments.length,
        pending_assignments: bPending,
        submitted_assignments: bSubmitted,
        evaluated_assignments: bEvaluated,
        overdue_assignments: bOverdue,
        upcoming_exams: bUpcomingExams,
        completed_exams: bCompletedExams,
        assignments: assignmentsList,
        exams: examsList
      };
    });

    return {
      student,
      batches,
      pending_assignments: pending,
      completed_assignments: completed,
      overdue_assignments: overdue,
      awaiting_evaluation: awaitingEval,
      upcoming_exams: upcomingEx,
      completed_exams: completedEx,
      recent_submissions: recentSubs,
      recent_exam_results: recentExams,
      batch_breakdowns: batchBreakdowns
    };
  },

  // Notifications
  getNotifications(userId: string): NotificationItem[] {
    const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId) as (Omit<NotificationItem, 'is_read'> & { is_read: number })[];
    return rows.map(r => ({ ...r, is_read: Boolean(r.is_read) }));
  },

  createNotification(data: { user_id: string; title: string; message: string; type: 'info' | 'assignment' | 'exam' | 'grade' | 'system'; link?: string }): void {
    const id = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.user_id, data.title, data.message, data.type, data.link || null);
  },

  markNotificationRead(id: string, userId: string): void {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  },

  // --- TRAINER-CONTROLLED MANUAL EXAMINATION EVALUATION & RESULT PUBLISHING ---

  getExamEvaluationsMonitoring(filter?: { batch_id?: string; exam_id?: string; status?: string; search?: string }) {
    const batches = this.getAllBatches();
    const exams = this.getAllExams();

    // Query all attempts with joins to student, batch, exam
    let query = `
      SELECT 
        att.id,
        att.exam_id,
        e.title as exam_title,
        e.max_marks as exam_max_marks,
        att.student_id,
        p.name as student_name,
        p.student_id as student_id_code,
        p.email as student_email,
        att.batch_id,
        COALESCE(b.name, 'Unassigned Cohort') as batch_name,
        att.status,
        att.submitted_at,
        att.time_spent_seconds,
        att.total_score,
        att.percentage,
        COALESCE(att.evaluation_status, 'pending_evaluation') as evaluation_status,
        COALESCE(att.is_published, 0) as is_published,
        att.published_at,
        att.evaluated_at,
        att.evaluated_by,
        att.trainer_feedback,
        att.evaluation_history,
        COALESCE(att.is_absent, 0) as is_absent,
        att.result_status
      FROM exam_attempts att
      JOIN exams e ON att.exam_id = e.id
      JOIN profiles p ON (att.student_id = p.id OR att.student_id = p.student_id)
      LEFT JOIN batches b ON (att.batch_id = b.id OR b.id IN (SELECT batch_id FROM batch_memberships WHERE user_id = p.id OR user_id = p.student_id))
      WHERE att.status = 'completed'
    `;
    const params: any[] = [];

    // The evaluation dashboard is strictly for reviewing submitted answer sheets.
    // Unattempted / absent students did not submit anything to evaluate, so exclude them from the evaluation dashboard by default.
    if (filter?.status === 'absent') {
      query += ` AND (att.is_absent = 1 OR att.result_status = 'absent_fail')`;
    } else {
      query += ` AND COALESCE(att.is_absent, 0) = 0 AND COALESCE(att.result_status, '') != 'absent_fail'`;
    }

    if (filter?.batch_id && filter.batch_id !== 'all') {
      query += ` AND att.batch_id = ?`;
      params.push(filter.batch_id);
    }
    if (filter?.exam_id && filter.exam_id !== 'all') {
      query += ` AND att.exam_id = ?`;
      params.push(filter.exam_id);
    }
    if (filter?.status && filter.status !== 'all' && filter.status !== 'absent') {
      if (filter.status === 'published') {
        query += ` AND att.is_published = 1`;
      } else if (filter.status === 'unpublished') {
        query += ` AND att.is_published = 0`;
      } else {
        query += ` AND att.evaluation_status = ?`;
        params.push(filter.status);
      }
    }
    if (filter?.search) {
      query += ` AND (p.name LIKE ? OR p.student_id LIKE ? OR e.title LIKE ?)`;
      params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
    }

    query += ` ORDER BY att.submitted_at DESC`;

    const attempts = db.prepare(query).all(...params) as any[];

    // Calculate aggregate metrics across selected batch/exam
    let targetBatchClause = '';
    const metricParams: any[] = [];
    if (filter?.batch_id && filter.batch_id !== 'all') {
      targetBatchClause = `WHERE bm.batch_id = ?`;
      metricParams.push(filter.batch_id);
    }

    const totalEligibleStudents = db.prepare(`
      SELECT COUNT(DISTINCT bm.user_id) as count
      FROM batch_memberships bm
      ${targetBatchClause}
    `).get(...metricParams) as { count: number };

    const allCompletedAttempts = db.prepare(`
      SELECT * FROM exam_attempts 
      WHERE status = 'completed' 
        AND COALESCE(is_absent, 0) = 0 
        AND COALESCE(result_status, '') != 'absent_fail'
    `).all() as any[];
    const inProgressAttempts = db.prepare(`SELECT COUNT(*) as count FROM exam_attempts WHERE status = 'in_progress'`).get() as { count: number };

    let pendingEvalCount = 0;
    let evaluatedCount = 0;
    let publishedCount = 0;

    for (const a of allCompletedAttempts) {
      if (a.is_published) {
        publishedCount++;
      } else if (a.evaluation_status === 'evaluated') {
        evaluatedCount++;
      } else {
        pendingEvalCount++;
      }
    }

    return {
      batches,
      exams,
      metrics: {
        total_assigned: totalEligibleStudents.count,
        not_started_count: Math.max(0, totalEligibleStudents.count - allCompletedAttempts.length - inProgressAttempts.count),
        in_progress_count: inProgressAttempts.count,
        submitted_count: allCompletedAttempts.length,
        pending_evaluation_count: pendingEvalCount,
        evaluated_count: evaluatedCount,
        published_count: publishedCount
      },
      attempts: attempts.map(a => ({
        ...a,
        is_published: Boolean(a.is_published)
      }))
    };
  },

  getAttemptForEvaluation(attemptId: string) {
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as any;
    if (!attempt) throw new Error('Attempt not found');

    const student = this.getUserById(attempt.student_id) || this.getUserByStudentId(attempt.student_id) || this.getUserByEmail(attempt.student_id);
    const exam = this.getExamById(attempt.exam_id);
    if (!student || !exam) throw new Error('Student or exam not found');

    const batch = attempt.batch_id ? this.getBatchById(attempt.batch_id) : (this.getStudentBatches(student.id)[0] || null);

    // Fetch all questions for this exam and student's responses
    let questions: any[] = [];
    try {
      questions = db.prepare(`
        SELECT 
          q.id,
          eq.question_order,
          q.subject,
          q.topic,
          COALESCE(q.question_type, 'mcq') as question_type,
          q.coding_language,
          q.code_template,
          q.allowed_file_types,
          q.max_file_size_mb,
          q.question_text,
          q.question_image_url,
          q.options,
          q.correct_option_id,
          q.explanation,
          q.marks,
          q.negative_penalty,
          ar.selected_option_id,
          ar.descriptive_answer,
          ar.submitted_file_url,
          ar.submitted_file_name,
          ar.is_marked_for_review,
          ar.is_visited,
          ar.is_correct,
          ar.score_awarded as suggested_score,
          COALESCE(ar.manual_marks, ar.score_awarded, 0) as manual_marks,
          ar.teacher_remarks
        FROM question_bank q
        JOIN exam_questions eq ON q.id = eq.question_id
        LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
        WHERE eq.exam_id = ?
        ORDER BY eq.question_order ASC
      `).all(attemptId, exam.id) as any[];
    } catch (queryErr: any) {
      if (String(queryErr?.message).includes('no such column')) {
        ensureAllMigrations(db);
        try {
          questions = db.prepare(`
            SELECT 
              q.id,
              eq.question_order,
              q.subject,
              q.topic,
              COALESCE(q.question_type, 'mcq') as question_type,
              q.coding_language,
              q.code_template,
              q.allowed_file_types,
              q.max_file_size_mb,
              q.question_text,
              q.question_image_url,
              q.options,
              q.correct_option_id,
              q.explanation,
              q.marks,
              q.negative_penalty,
              ar.selected_option_id,
              ar.descriptive_answer,
              ar.submitted_file_url,
              ar.submitted_file_name,
              ar.is_marked_for_review,
              ar.is_visited,
              ar.is_correct,
              ar.score_awarded as suggested_score,
              COALESCE(ar.manual_marks, ar.score_awarded, 0) as manual_marks,
              ar.teacher_remarks
            FROM question_bank q
            JOIN exam_questions eq ON q.id = eq.question_id
            LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `).all(attemptId, exam.id) as any[];
        } catch {
          questions = db.prepare(`
            SELECT 
              q.id,
              eq.question_order,
              q.subject,
              q.topic,
              q.question_text,
              q.question_image_url,
              q.options,
              q.correct_option_id,
              q.explanation,
              q.marks,
              q.negative_penalty,
              ar.selected_option_id,
              ar.is_marked_for_review,
              ar.is_visited,
              ar.is_correct,
              ar.score_awarded as suggested_score,
              COALESCE(ar.manual_marks, ar.score_awarded, 0) as manual_marks,
              ar.teacher_remarks
            FROM question_bank q
            JOIN exam_questions eq ON q.id = eq.question_id
            LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `).all(attemptId, exam.id) as any[];
        }
      } else {
        throw queryErr;
      }
    }

    let history: any[] = [];
    try {
      if (attempt.evaluation_history) {
        history = JSON.parse(attempt.evaluation_history);
      }
    } catch {}

    let proctoringLog: any[] = [];
    try {
      if (attempt.proctoring_event_log) {
        proctoringLog = JSON.parse(attempt.proctoring_event_log);
      }
    } catch {}

    return {
      attempt: {
        ...attempt,
        is_published: Boolean(attempt.is_published),
        fullscreen_exit_count: attempt.fullscreen_exit_count || 0,
        proctoring_event_log: proctoringLog
      },
      student,
      batch,
      exam,
      questions: questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : [],
        is_marked_for_review: Boolean(q.is_marked_for_review),
        is_visited: Boolean(q.is_visited)
      })),
      evaluation_history: history
    };
  },

  saveAttemptEvaluation(attemptId: string, trainerId: string, data: {
    status: 'in_progress' | 'evaluated';
    manual_marks?: Record<string, number>;
    teacher_remarks?: Record<string, string>;
    trainer_feedback?: string;
    audit_reason?: string;
  }): ExamAttempt {
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as any;
    if (!attempt) throw new Error('Attempt not found');
    const exam = this.getExamById(attempt.exam_id);
    if (!exam) throw new Error('Exam not found');
    const trainer = this.getUserById(trainerId);

    // Update individual questions
    if (data.manual_marks) {
      const updateStmt = db.prepare(`
        UPDATE attempt_responses
        SET manual_marks = ?, teacher_remarks = ?
        WHERE attempt_id = ? AND question_id = ?
      `);

      for (const [qId, marks] of Object.entries(data.manual_marks)) {
        const remark = data.teacher_remarks?.[qId] ?? null;
        updateStmt.run(marks, remark, attemptId, qId);
      }
    }

    // Compute new total score from manual_marks
    const sumRow = db.prepare(`
      SELECT COALESCE(SUM(manual_marks), 0) as total
      FROM attempt_responses
      WHERE attempt_id = ?
    `).get(attemptId) as { total: number };

    const newScore = Math.max(0, Number(sumRow.total.toFixed(2)));
    const percentage = Number(((newScore / exam.max_marks) * 100).toFixed(1));

    // Recalculate total_correct, total_incorrect, and total_unattempted based on trainer grading:
    const isAbsentAttempt = Boolean(attempt.is_absent || (attempt as any).result_status === 'absent_fail');
    const allResponses = db.prepare(`
      SELECT ar.manual_marks, ar.selected_option_id, ar.descriptive_answer, ar.submitted_file_url,
             q.marks as q_marks, q.correct_option_id, q.question_type, q.code_template
      FROM attempt_responses ar
      JOIN question_bank q ON ar.question_id = q.id
      WHERE ar.attempt_id = ?
    `).all(attemptId) as any[];

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnattempted = 0;

    if (isAbsentAttempt) {
      totalUnattempted = allResponses.length || (exam.total_questions || 0);
    } else {
      for (const r of allResponses) {
        const maxQMarks = Number(r.q_marks || 1);
        const isMcq = r.question_type === 'mcq';
        const isUnattempted = isMcq
          ? !r.selected_option_id
          : r.question_type === 'file_upload'
          ? !r.submitted_file_url
          : !(r.descriptive_answer && r.descriptive_answer.trim().length > 0 && r.descriptive_answer.trim() !== (r.code_template || '').trim());

        if (isUnattempted) {
          totalUnattempted++;
        } else if (r.manual_marks !== null && r.manual_marks !== undefined) {
          const m = Number(r.manual_marks);
          if (m >= maxQMarks) {
            totalCorrect++;
          } else if (m <= 0) {
            totalIncorrect++;
          } else {
            totalUnattempted++;
          }
        } else if (isMcq) {
          if (r.selected_option_id === r.correct_option_id) {
            totalCorrect++;
          } else {
            totalIncorrect++;
          }
        } else {
          totalUnattempted++;
        }
      }
    }

    // Audit trail
    let history: any[] = [];
    try {
      if (attempt.evaluation_history) history = JSON.parse(attempt.evaluation_history);
    } catch {}

    history.push({
      date: new Date().toISOString(),
      action: data.status === 'evaluated' ? 'marked_evaluated' : 'saved_draft',
      actor_name: trainer?.name || 'Trainer Tushar',
      actor_id: trainerId,
      previous_score: attempt.total_score,
      new_score: newScore,
      notes: data.audit_reason || `Evaluation status set to ${data.status}`
    });

    db.prepare(`
      UPDATE exam_attempts
      SET total_score = ?,
          percentage = ?,
          total_correct = ?,
          total_incorrect = ?,
          total_unattempted = ?,
          evaluation_status = ?,
          evaluated_at = ?,
          evaluated_by = ?,
          trainer_feedback = ?,
          evaluation_history = ?
      WHERE id = ?
    `).run(
      newScore,
      percentage,
      totalCorrect,
      totalIncorrect,
      totalUnattempted,
      data.status,
      new Date().toISOString(),
      trainerId,
      data.trainer_feedback ?? attempt.trainer_feedback,
      JSON.stringify(history),
      attemptId
    );

    return db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt;
  },

  publishExamResults(data: {
    exam_id: string;
    batch_id: string;
    student_ids?: string[];
    trainer_id: string;
    audit_note?: string;
  }): { published_count: number; student_names: string[] } {
    const exam = this.getExamById(data.exam_id);
    if (!exam) throw new Error('Exam not found');
    const trainer = this.getUserById(data.trainer_id);

    let query = `
      SELECT att.id, att.student_id, p.name as student_name, att.total_score, att.evaluation_history
      FROM exam_attempts att
      JOIN profiles p ON att.student_id = p.id
      WHERE att.exam_id = ? AND att.batch_id = ? AND att.status = 'completed'
    `;
    const params: any[] = [data.exam_id, data.batch_id];

    if (data.student_ids && data.student_ids.length > 0) {
      query += ` AND att.student_id IN (${data.student_ids.map(() => '?').join(',')})`;
      params.push(...data.student_ids);
    }

    const attemptsToPublish = db.prepare(query).all(...params) as {
      id: string;
      student_id: string;
      student_name: string;
      total_score: number | null;
      evaluation_history: string | null;
    }[];

    const updateAttemptStmt = db.prepare(`
      UPDATE exam_attempts
      SET is_published = 1,
          evaluation_status = 'published',
          published_at = ?,
          published_by = ?,
          evaluation_history = ?
      WHERE id = ?
    `);

    const publishedNames: string[] = [];

    for (const a of attemptsToPublish) {
      let history: any[] = [];
      try {
        if (a.evaluation_history) history = JSON.parse(a.evaluation_history);
      } catch {}

      history.push({
        date: new Date().toISOString(),
        action: 'published',
        actor_name: trainer?.name || 'Trainer Tushar',
        actor_id: data.trainer_id,
        score: a.total_score,
        notes: data.audit_note || 'Result officially released to student'
      });

      updateAttemptStmt.run(
        new Date().toISOString(),
        data.trainer_id,
        JSON.stringify(history),
        a.id
      );

      // Send student notification
      this.createNotification({
        user_id: a.student_id,
        title: 'Examination Results Published',
        message: `Trainer Tushar Shukla has evaluated and published your result for "${exam.title}". View your score and solutions now.`,
        type: 'exam',
        link: `/student/exams/${exam.id}/result`
      });

      publishedNames.push(a.student_name);
    }

    return {
      published_count: publishedNames.length,
      student_names: publishedNames
    };
  },

  republishExamResult(attemptId: string, trainerId: string, data: {
    audit_reason: string;
    manual_marks?: Record<string, number>;
    teacher_remarks?: Record<string, string>;
    trainer_feedback?: string;
  }): ExamAttempt {
    if (!data.audit_reason || data.audit_reason.trim().length === 0) {
      throw new Error('An audit reason is required when correcting and republishing a result.');
    }

    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as any;
    if (!attempt) throw new Error('Attempt not found');
    const exam = this.getExamById(attempt.exam_id);
    if (!exam) throw new Error('Exam not found');
    const trainer = this.getUserById(trainerId);

    // Update marks
    if (data.manual_marks) {
      const updateStmt = db.prepare(`
        UPDATE attempt_responses
        SET manual_marks = ?, teacher_remarks = ?
        WHERE attempt_id = ? AND question_id = ?
      `);

      for (const [qId, marks] of Object.entries(data.manual_marks)) {
        const remark = data.teacher_remarks?.[qId] ?? null;
        updateStmt.run(marks, remark, attemptId, qId);
      }
    }

    const sumRow = db.prepare(`
      SELECT COALESCE(SUM(manual_marks), 0) as total
      FROM attempt_responses
      WHERE attempt_id = ?
    `).get(attemptId) as { total: number };

    const newScore = Math.max(0, Number(sumRow.total.toFixed(2)));
    const percentage = Number(((newScore / exam.max_marks) * 100).toFixed(1));

    const allResponses = db.prepare(`
      SELECT ar.manual_marks, ar.selected_option_id, q.marks as q_marks, q.correct_option_id, q.question_type
      FROM attempt_responses ar
      JOIN question_bank q ON ar.question_id = q.id
      WHERE ar.attempt_id = ?
    `).all(attemptId) as any[];

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnattempted = 0;

    for (const r of allResponses) {
      const maxQMarks = Number(r.q_marks || 1);
      if (r.manual_marks !== null && r.manual_marks !== undefined) {
        const m = Number(r.manual_marks);
        if (m >= maxQMarks) {
          totalCorrect++;
        } else if (m <= 0) {
          totalIncorrect++;
        } else {
          totalUnattempted++;
        }
      } else if (r.question_type === 'mcq') {
        if (!r.selected_option_id) {
          totalUnattempted++;
        } else if (r.selected_option_id === r.correct_option_id) {
          totalCorrect++;
        } else {
          totalIncorrect++;
        }
      } else {
        totalUnattempted++;
      }
    }

    let history: any[] = [];
    try {
      if (attempt.evaluation_history) history = JSON.parse(attempt.evaluation_history);
    } catch {}

    history.push({
      date: new Date().toISOString(),
      action: 'republished_correction',
      actor_name: trainer?.name || 'Trainer Tushar',
      actor_id: trainerId,
      previous_score: attempt.total_score,
      new_score: newScore,
      notes: data.audit_reason
    });

    db.prepare(`
      UPDATE exam_attempts
      SET total_score = ?,
          percentage = ?,
          total_correct = ?,
          total_incorrect = ?,
          total_unattempted = ?,
          is_published = 1,
          evaluation_status = 'published',
          published_at = ?,
          published_by = ?,
          trainer_feedback = ?,
          evaluation_history = ?
      WHERE id = ?
    `).run(
      newScore,
      percentage,
      totalCorrect,
      totalIncorrect,
      totalUnattempted,
      new Date().toISOString(),
      trainerId,
      data.trainer_feedback ?? attempt.trainer_feedback,
      JSON.stringify(history),
      attemptId
    );

    this.createNotification({
      user_id: attempt.student_id,
      title: 'Exam Evaluation Revised',
      message: `Your evaluation for "${exam.title}" has been updated. Reason: ${data.audit_reason}. Revised Score: ${newScore}/${exam.max_marks}.`,
      type: 'exam',
      link: `/student/exams/${exam.id}/result`
    });

    return db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as ExamAttempt;
  },

  getStudentExamSubmissions(studentId: string) {
    const student = this.getUserById(studentId) || this.getUserByStudentId(studentId) || this.getUserByEmail(studentId);
    if (!student) return [];

    // Auto-process deadlines first so absent students get their fail score cards
    try {
      this.processExamDeadlines();
    } catch {}

    const studentAttempts = db.prepare(`
      SELECT * FROM exam_attempts 
      WHERE (student_id = ? OR student_id = ?)
      ORDER BY submitted_at DESC, started_at DESC
    `).all(student.id, student.student_id || '') as any[];

    const seenExamIds = new Set<string>();
    const results: any[] = [];

    for (const att of studentAttempts) {
      seenExamIds.add(att.exam_id);
      let exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(att.exam_id) as Exam | undefined;
      const passPct = Number(exam?.passing_percentage ?? (att.exam_passing_percentage || 40.0));

      if (!exam) {
        exam = {
          id: att.exam_id,
          title: att.exam_title || 'Examination',
          max_marks: att.exam_max_marks || 20,
          total_questions: (att.total_unattempted || 0) + (att.total_correct || 0) + (att.total_incorrect || 0) || 10,
          duration_minutes: att.exam_duration_minutes || 20,
          marks_per_question: 1,
          negative_marking: 0,
          unattempted_deduction: 0,
          allow_pausing: false,
          max_pauses: 0,
          status: 'archived',
          result_release_policy: 'immediate',
          created_at: att.started_at,
          updated_at: att.submitted_at || att.started_at,
          passing_percentage: passPct
        };
      }

      const isPublished = Boolean(att.is_published);
      const isAbsent = Boolean(att.is_absent);
      const isPass = !isAbsent && (Number(att.percentage || 0) >= passPct);
      const resultStatus = isAbsent ? 'absent_fail' : (isPass ? 'pass' : 'fail');

      results.push({
        exam: {
          ...exam,
          passing_percentage: passPct
        },
        submission_state: att.status === 'in_progress'
          ? ('in_progress' as const)
          : isPublished
          ? ('published' as const)
          : ('awaiting_evaluation' as const),
        attempt: {
          id: att.id,
          status: att.status,
          submitted_at: att.submitted_at,
          evaluation_status: att.evaluation_status || 'pending_evaluation',
          is_published: isPublished,
          is_absent: isAbsent,
          result_status: resultStatus,
          passing_percentage: passPct,
          total_score: isPublished ? att.total_score : null,
          percentage: isPublished ? att.percentage : null,
          trainer_feedback: isPublished ? att.trainer_feedback : null,
          published_at: isPublished ? att.published_at : null
        }
      });
    }

    // Also include any active assigned exams that have not been attempted yet
    const assignedExams = this.getExamsForStudent(student.id);
    for (const ex of assignedExams) {
      if (!seenExamIds.has(ex.id)) {
        results.push({
          exam: ex,
          submission_state: 'not_started' as const,
          attempt: null
        });
      }
    }

    return results;
  },

  // Trainer Activity Calendar Events
  getAdminCalendarEvents(options?: { batch_id?: string }): {
    events: CalendarEvent[];
    batches: (Batch & { student_count: number })[];
  } {
    const batches = this.getAllBatches() || [];
    const filterBatchId = options?.batch_id && options.batch_id !== 'all' ? options.batch_id : null;

    const events: CalendarEvent[] = [];

    const parseDateTime = (raw: string | null | undefined) => {
      if (!raw) return { date: '', time: '' };
      try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) {
          const parts = String(raw).split(/[T ]/);
          return { date: parts[0] || '', time: parts[1] ? parts[1].slice(0, 5) : '' };
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const date = `${year}-${month}-${day}`;
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return { date, time };
      } catch {
        const parts = String(raw).split(/[T ]/);
        return { date: parts[0] || '', time: '' };
      }
    };

    // 1. Batches Created
    for (const b of batches) {
      if (filterBatchId && b.id !== filterBatchId) continue;
      const { date, time } = parseDateTime(b.created_at);
      if (date) {
        events.push({
          id: `batch-${b.id}`,
          type: 'batch_created',
          title: `Created Batch: ${b.name}`,
          subtitle: `${b.student_count || 0} enrolled students`,
          date,
          time,
          timestamp: b.created_at,
          batch_ids: [b.id],
          batch_names: [b.name],
          link_url: '/admin/batches',
          badge_color: 'purple',
          metadata: {
            batch_id: b.id,
            student_count: b.student_count || 0,
            status: b.status
          }
        });
      }
    }

    // 2. Homework Tasks Assigned & Deadlines
    const assignments = (db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all() || []) as Assignment[];
    const getAsgBatchesStmt = db.prepare(`
      SELECT b.id, b.name FROM batches b
      JOIN assignment_recipients ar ON b.id = ar.batch_id
      WHERE ar.assignment_id = ?
    `);

    for (const a of assignments) {
      const assignedBatches = (getAsgBatchesStmt.all(a.id) || []) as { id: string; name: string }[];
      const bIds = assignedBatches.map(b => b.id);
      const bNames = assignedBatches.map(b => b.name);

      if (filterBatchId && !bIds.includes(filterBatchId)) continue;

      const { date: createDate, time: createTime } = parseDateTime(a.created_at);
      if (createDate) {
        events.push({
          id: `asg-assign-${a.id}`,
          type: 'assignment_assigned',
          title: `Assigned Task: ${a.title}`,
          subtitle: `Target: ${bNames.length > 0 ? bNames.join(', ') : 'All Batches'} • Max ${a.max_score} marks`,
          date: createDate,
          time: createTime,
          timestamp: a.created_at,
          batch_ids: bIds,
          batch_names: bNames,
          link_url: '/admin/assignments',
          badge_color: 'indigo',
          metadata: {
            assignment_id: a.id,
            subject: a.subject,
            max_score: a.max_score,
            status: a.status
          }
        });
      }

      if (a.deadline) {
        const { date: dueDates, time: dueTime } = parseDateTime(a.deadline);
        if (dueDates) {
          events.push({
            id: `asg-due-${a.id}`,
            type: 'assignment_deadline',
            title: `Task Due: ${a.title}`,
            subtitle: `Submission deadline for ${bNames.length > 0 ? bNames.join(', ') : 'All Batches'}`,
            date: dueDates,
            time: dueTime,
            timestamp: a.deadline,
            batch_ids: bIds,
            batch_names: bNames,
            link_url: `/admin/submissions?assignment_id=${a.id}`,
            badge_color: 'rose',
            metadata: {
              assignment_id: a.id,
              subject: a.subject,
              max_score: a.max_score
            }
          });
        }
      }
    }

    // 3. Exams Scheduled & Conducted
    const exams = (db.prepare('SELECT * FROM exams ORDER BY created_at DESC').all() || []) as Exam[];
    const getExamBatchesStmt = db.prepare(`
      SELECT b.id, b.name FROM batches b
      JOIN exam_batches eb ON b.id = eb.batch_id
      WHERE eb.exam_id = ?
    `);

    for (const e of exams) {
      const examBatches = (getExamBatchesStmt.all(e.id) || []) as { id: string; name: string }[];
      const bIds = examBatches.map(b => b.id);
      const bNames = examBatches.map(b => b.name);

      if (filterBatchId && !bIds.includes(filterBatchId)) continue;

      const { date: createDate, time: createTime } = parseDateTime(e.created_at);
      if (createDate) {
        events.push({
          id: `exam-schedule-${e.id}`,
          type: 'exam_scheduled',
          title: `Scheduled Exam: ${e.title}`,
          subtitle: `Batches: ${bNames.length > 0 ? bNames.join(', ') : 'All Batches'} • ${e.duration_minutes}m • ${e.total_questions} Questions`,
          date: createDate,
          time: createTime,
          timestamp: e.created_at,
          batch_ids: bIds,
          batch_names: bNames,
          link_url: '/admin/exams',
          badge_color: 'amber',
          metadata: {
            exam_id: e.id,
            duration_minutes: e.duration_minutes,
            total_questions: e.total_questions,
            max_marks: e.max_marks,
            status: e.status
          }
        });
      }

      if (e.start_window) {
        const { date: winDate, time: winTime } = parseDateTime(e.start_window);
        if (winDate) {
          events.push({
            id: `exam-window-${e.id}`,
            type: 'exam_window',
            title: `Exam Window: ${e.title}`,
            subtitle: `Exam opens for ${bNames.length > 0 ? bNames.join(', ') : 'Target Batches'}`,
            date: winDate,
            time: winTime,
            timestamp: e.start_window,
            batch_ids: bIds,
            batch_names: bNames,
            link_url: `/admin/exam-evaluations?exam_id=${e.id}`,
            badge_color: 'teal',
            metadata: {
              exam_id: e.id,
              duration_minutes: e.duration_minutes,
              max_marks: e.max_marks
            }
          });
        }
      }
    }

    // Sort all events by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      events,
      batches
    };
  },

  // Portal System Settings
  getSetting(key: string): string | null {
    try {
      const row = db.prepare('SELECT value FROM portal_settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : null;
    } catch {
      return null;
    }
  },

  setSetting(key: string, value: string): void {
    try {
      db.prepare(`
        INSERT INTO portal_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(key, value);
    } catch (err) {
      console.error('[DB SETTING SAVE ERROR]:', err);
    }
  },

  getGoogleSheetWebhookUrl(): string | null {
    const dbUrl = this.getSetting('google_sheet_webhook_url');
    if (dbUrl && dbUrl.trim()) return dbUrl.trim();
    if (process.env.GOOGLE_SHEET_WEBHOOK_URL && process.env.GOOGLE_SHEET_WEBHOOK_URL.trim()) {
      return process.env.GOOGLE_SHEET_WEBHOOK_URL.trim();
    }
    return null;
  },

  createFeedback(data: {
    user_id: string;
    category: string;
    title: string;
    description: string;
    device_info?: string;
    page_url?: string;
  }): { id: string; success: boolean } {
    const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
      INSERT INTO student_feedback (id, user_id, category, title, description, device_info, page_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.user_id,
      data.category,
      data.title,
      data.description,
      data.device_info || null,
      data.page_url || null
    );

    // Automatically trigger notification to all Trainer/Admin users
    try {
      const admins = db.prepare(`SELECT id FROM profiles WHERE role = 'admin'`).all() as { id: string }[];
      const user = this.getUserById(data.user_id);
      const studentName = user?.name || 'A student';
      const categoryIcon = data.category === 'bug' ? '🐛' : data.category === 'suggestion' ? '💡' : '📝';

      for (const admin of admins) {
        this.createNotification({
          user_id: admin.id,
          title: `${categoryIcon} Student Report: ${data.title.slice(0, 35)}`,
          message: `${studentName} reported: "${data.description.slice(0, 100)}"`,
          type: 'system',
          link: '/admin/dashboard'
        });
      }
    } catch (notifErr) {
      console.warn('[FEEDBACK ADMIN NOTIFICATION WARN]:', notifErr);
    }

    return { id, success: true };
  },

  getStudentFeedbacks(userId: string) {
    try {
      return db.prepare(`
        SELECT * FROM student_feedback 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 25
      `).all(userId);
    } catch {
      return [];
    }
  },

  getAllFeedbacks(limit = 50) {
    try {
      return db.prepare(`
        SELECT f.*, p.name as student_name, p.student_id, p.email as student_email
        FROM student_feedback f
        LEFT JOIN profiles p ON f.user_id = p.id
        ORDER BY f.created_at DESC
        LIMIT ?
      `).all(limit);
    } catch {
      return [];
    }
  },

  updateFeedbackStatus(id: string, status: string, admin_note?: string): boolean {
    const res = db.prepare(`
      UPDATE student_feedback 
      SET status = ?, admin_note = coalesce(?, admin_note), updated_at = datetime('now')
      WHERE id = ?
    `).run(status, admin_note || null, id);
    return res.changes > 0;
  }
};
