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
  if (isServerless) {
    db.pragma('journal_mode = DELETE');
  } else {
    db.pragma('journal_mode = WAL');
  }
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

export async function ensureCloudSyncReady(force = false): Promise<void> {
  if (!isServerless && !process.env.FORCE_CLOUD_SYNC) return;

  if (syncLock) {
    await syncLock;
    return;
  }

  const now = Date.now();
  if (!force && localVersionTag && now - lastCheckedAt < 2500) {
    return;
  }
  lastCheckedAt = now;

  syncLock = (async () => {
    try {
      const { getCloudDatabaseMetadata, pullDatabaseFromCloud } = await import('./cloudSync');
      const meta = await getCloudDatabaseMetadata();
      if (!meta) return;

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
        }
      }
    } catch (err) {
      console.warn('[CLOUD SYNC]: ensureCloudSyncReady warning:', err);
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
      allowed_formats TEXT NOT NULL DEFAULT 'pdf,docx,xlsx,csv,txt,png,jpg',
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
  `);

  // Dynamic schema migrations for manual evaluation & publishing
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluation_status TEXT NOT NULL DEFAULT 'pending_evaluation'`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN published_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN published_by TEXT`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluated_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluated_by TEXT`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN trainer_feedback TEXT`); } catch {}
  try { db.exec(`ALTER TABLE exam_attempts ADD COLUMN evaluation_history TEXT DEFAULT '[]'`); } catch {}

  try { db.exec(`ALTER TABLE attempt_responses ADD COLUMN manual_marks REAL`); } catch {}
  try { db.exec(`ALTER TABLE attempt_responses ADD COLUMN teacher_remarks TEXT`); } catch {}
  try { db.exec(`ALTER TABLE attempt_responses ADD COLUMN descriptive_answer TEXT`); } catch {}

  // Ensure Admin credentials (ID: Tushar1234, Password: Tushar@0963)
  try {
    const adminPassHash = bcrypt.hashSync('Tushar@0963', 10);
    db.prepare(`
      UPDATE profiles 
      SET student_id = 'Tushar1234', 
          password_hash = ?
      WHERE role = 'admin' AND (email = 'tushar@cybrom.com' OR id = 'usr-admin-tushar')
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
    'tushar@cybrom.com',
    adminPasswordHash,
    'admin',
    'active'
  );

  // Question Bank: 20 Questions (matching AE/JE Mechanical mock test)
  const insertQuestion = db.prepare(`
    INSERT OR IGNORE INTO question_bank (id, subject, topic, difficulty, question_text, options, correct_option_id, explanation, marks, negative_penalty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const questionsData = [
    {
      id: 'q-01',
      subject: 'Mechanical Engineering',
      topic: 'Laws of Thermodynamics',
      difficulty: 'easy',
      question_text: 'The third law of thermodynamics is all about',
      options: [
        { id: 'opt1', text: 'The entropy of a perfect crystal at absolute zero temperature' },
        { id: 'opt2', text: 'The relation between work and heat' },
        { id: 'opt3', text: 'Evolution of entropy of a system with time' },
        { id: 'opt4', text: 'Conservation of mass' }
      ],
      correct_option_id: 'opt1',
      explanation: 'The third law of thermodynamics states that the entropy of a system approaches a constant value as the temperature approaches absolute zero. For a perfect crystalline structure, entropy reaches zero.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-02',
      subject: 'Mechanical Engineering',
      topic: 'Thermometry',
      difficulty: 'easy',
      question_text: 'The Zeroth Law of Thermodynamics forms the scientific basis for the measurement of',
      options: [
        { id: 'opt1', text: 'Pressure' },
        { id: 'opt2', text: 'Temperature' },
        { id: 'opt3', text: 'Work output' },
        { id: 'opt4', text: 'Entropy' }
      ],
      correct_option_id: 'opt2',
      explanation: 'The Zeroth Law defines thermal equilibrium and introduces temperature as an objective property common to all systems in thermal balance.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-03',
      subject: 'Mechanical Engineering',
      topic: 'Carnot Engine',
      difficulty: 'medium',
      question_text: 'An ideal Carnot engine operating between thermal reservoirs at temperatures 600 K and 300 K has a thermal efficiency of',
      options: [
        { id: 'opt1', text: '25%' },
        { id: 'opt2', text: '50%' },
        { id: 'opt3', text: '75%' },
        { id: 'opt4', text: '100%' }
      ],
      correct_option_id: 'opt2',
      explanation: 'Efficiency = 1 - (T_sink / T_source) = 1 - (300 / 600) = 1 - 0.5 = 0.5 or 50%.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-04',
      subject: 'Mechanical Engineering',
      topic: 'First Law of Thermodynamics',
      difficulty: 'easy',
      question_text: 'The First Law of Thermodynamics is a direct consequence of the law of conservation of',
      options: [
        { id: 'opt1', text: 'Mass' },
        { id: 'opt2', text: 'Momentum' },
        { id: 'opt3', text: 'Energy' },
        { id: 'opt4', text: 'Entropy' }
      ],
      correct_option_id: 'opt3',
      explanation: 'The First Law states that energy cannot be created or destroyed, only transformed: dQ = dU + dW.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-05',
      subject: 'Mechanical Engineering',
      topic: 'Entropy Principle',
      difficulty: 'medium',
      question_text: 'For an irreversible process occurring in an isolated thermodynamic system, the total entropy',
      options: [
        { id: 'opt1', text: 'Always decreases' },
        { id: 'opt2', text: 'Remains unchanged' },
        { id: 'opt3', text: 'Always increases' },
        { id: 'opt4', text: 'Becomes negative' }
      ],
      correct_option_id: 'opt3',
      explanation: 'According to the Second Law, the entropy of an isolated system always increases during irreversible spontaneous processes: (dS)isolated > 0.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-06',
      subject: 'Mechanical Engineering',
      topic: 'Thermodynamic Cycles',
      difficulty: 'medium',
      question_text: 'The Otto cycle consists of which four thermodynamic processes?',
      options: [
        { id: 'opt1', text: 'Two reversible isobars and two reversible isochors' },
        { id: 'opt2', text: 'Two reversible adiabatics and two reversible constant-volume processes' },
        { id: 'opt3', text: 'Two reversible isotherms and two reversible constant-pressure processes' },
        { id: 'opt4', text: 'Two reversible polytropics and two reversible isotherms' }
      ],
      correct_option_id: 'opt2',
      explanation: 'The standard air Otto cycle consists of two isentropic (reversible adiabatic) processes and two isochoric (constant volume) processes.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-07',
      subject: 'Mechanical Engineering',
      topic: 'Properties of Pure Substances',
      difficulty: 'hard',
      question_text: 'At the critical point of water, the latent heat of vaporization becomes',
      options: [
        { id: 'opt1', text: 'Maximum' },
        { id: 'opt2', text: 'Zero' },
        { id: 'opt3', text: 'Infinity' },
        { id: 'opt4', text: 'Equal to sensible heat' }
      ],
      correct_option_id: 'opt2',
      explanation: 'At the critical point (374.14°C, 22.09 MPa for water), saturated liquid and saturated vapor states are identical, and the latent heat of vaporization vanishes (0 kJ/kg).',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-08',
      subject: 'Mechanical Engineering',
      topic: 'Gas Power Cycles',
      difficulty: 'medium',
      question_text: 'The Brayton cycle is the theoretical cycle for which power generating plant?',
      options: [
        { id: 'opt1', text: 'Steam turbine power plant' },
        { id: 'opt2', text: 'Gas turbine power plant' },
        { id: 'opt3', text: 'Hydroelectric power plant' },
        { id: 'opt4', text: 'Reciprocating diesel plant' }
      ],
      correct_option_id: 'opt2',
      explanation: 'The Brayton cycle (Joule cycle) is the ideal cycle for gas turbine power plants and jet propulsion units.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-09',
      subject: 'Mechanical Engineering',
      topic: 'Heat Transfer Mechanisms',
      difficulty: 'easy',
      question_text: 'Thermal conduction through a flat homogeneous solid wall is governed by which physical law?',
      options: [
        { id: 'opt1', text: 'Newton Law of Cooling' },
        { id: 'opt2', text: 'Fourier Law of Heat Conduction' },
        { id: 'opt3', text: 'Stefan-Boltzmann Law' },
        { id: 'opt4', text: 'Planck Radiation Law' }
      ],
      correct_option_id: 'opt2',
      explanation: 'Fourier Law states that the rate of heat transfer through conduction is proportional to the negative temperature gradient: Q = -k * A * (dT/dx).',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-10',
      subject: 'Mechanical Engineering',
      topic: 'Nozzle Flow',
      difficulty: 'hard',
      question_text: 'For a convergent-divergent nozzle discharging gas from a reservoir, sonic conditions (Mach = 1) occur at the',
      options: [
        { id: 'opt1', text: 'Inlet of nozzle' },
        { id: 'opt2', text: 'Exit plane of divergence' },
        { id: 'opt3', text: 'Throat' },
        { id: 'opt4', text: 'Boundary layer detachment point' }
      ],
      correct_option_id: 'opt3',
      explanation: 'In isentropic compressible flow through a convergent-divergent duct, sonic velocity (M = 1) is reached strictly at the minimum cross-sectional area (throat) under choked conditions.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-11',
      subject: 'Mechanical Engineering',
      topic: 'Applied Thermodynamics',
      difficulty: 'medium',
      question_text: 'The ratio of actual specific volume to ideal gas specific volume at identical temperature and pressure is called',
      options: [
        { id: 'opt1', text: 'Prandtl number' },
        { id: 'opt2', text: 'Compressibility factor (Z)' },
        { id: 'opt3', text: 'Specific heat ratio (gamma)' },
        { id: 'opt4', text: 'Adiabatic index' }
      ],
      correct_option_id: 'opt2',
      explanation: 'The compressibility factor Z = (P*v) / (R*T) measures deviation from ideal gas behavior; for an ideal gas Z = 1.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-12',
      subject: 'Mechanical Engineering',
      topic: 'Refrigeration',
      difficulty: 'medium',
      question_text: 'The Coefficient of Performance (COP) of a reversible heat pump is related to the COP of a reversible refrigerator by',
      options: [
        { id: 'opt1', text: 'COP(HP) = COP(Ref) - 1' },
        { id: 'opt2', text: 'COP(HP) = COP(Ref) + 1' },
        { id: 'opt3', text: 'COP(HP) = 1 / COP(Ref)' },
        { id: 'opt4', text: 'COP(HP) = COP(Ref) * 2' }
      ],
      correct_option_id: 'opt2',
      explanation: 'By definition: COP_HP = Q_high / W = (Q_low + W) / W = COP_Ref + 1.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-13',
      subject: 'Mechanical Engineering',
      topic: 'Psychrometry',
      difficulty: 'medium',
      question_text: 'When the relative humidity of moist air is 100%, which of the following temperatures are identical?',
      options: [
        { id: 'opt1', text: 'Dry bulb, wet bulb, and dew point temperature' },
        { id: 'opt2', text: 'Dry bulb and wet bulb only' },
        { id: 'opt3', text: 'Wet bulb and dew point only' },
        { id: 'opt4', text: 'Dry bulb and saturation temperature only' }
      ],
      correct_option_id: 'opt1',
      explanation: 'At 100% relative humidity (saturated air), the dry bulb, wet bulb, and dew point temperatures coincide: DBT = WBT = DPT.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-14',
      subject: 'Mechanical Engineering',
      topic: 'Steady Flow Energy Equation',
      difficulty: 'easy',
      question_text: 'In an insulated horizontal throttling device (Joule-Thomson valve), which parameter remains constant?',
      options: [
        { id: 'opt1', text: 'Internal energy' },
        { id: 'opt2', text: 'Entropy' },
        { id: 'opt3', text: 'Enthalpy' },
        { id: 'opt4', text: 'Temperature' }
      ],
      correct_option_id: 'opt3',
      explanation: 'A throttling process is characterized by isenthalpic expansion (h1 = h2) since work transfer is zero and heat transfer is negligible.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-15',
      subject: 'Mechanical Engineering',
      topic: 'IC Engines',
      difficulty: 'medium',
      question_text: 'For the same maximum pressure and temperature limits, the most efficient air-standard cycle is',
      options: [
        { id: 'opt1', text: 'Otto cycle' },
        { id: 'opt2', text: 'Diesel cycle' },
        { id: 'opt3', text: 'Dual cycle' },
        { id: 'opt4', text: 'Carnot cycle' }
      ],
      correct_option_id: 'opt2',
      explanation: 'For the same maximum pressure and temperature, the Diesel cycle is more efficient than the Otto cycle because it achieves a larger expansion ratio.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-16',
      subject: 'Mechanical Engineering',
      topic: 'Steam Turbines',
      difficulty: 'easy',
      question_text: 'The dryness fraction (x) of saturated dry vapor is equal to',
      options: [
        { id: 'opt1', text: '0' },
        { id: 'opt2', text: '0.5' },
        { id: 'opt3', text: '1.0' },
        { id: 'opt4', text: 'Infinity' }
      ],
      correct_option_id: 'opt3',
      explanation: 'Dryness fraction x = mass of dry steam / total mass. For saturated dry vapor, there is no liquid moisture, so x = 1.0.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-17',
      subject: 'Mechanical Engineering',
      topic: 'Thermodynamic Relations',
      difficulty: 'hard',
      question_text: 'The Maxwell relation derived from Helmholtz free energy function (F = U - TS) is',
      options: [
        { id: 'opt1', text: '(dT/dP)s = (dv/ds)p' },
        { id: 'opt2', text: '(dP/dT)v = (ds/dv)t' },
        { id: 'opt3', text: '(dT/dv)s = -(dP/ds)v' },
        { id: 'opt4', text: '(dv/dT)p = -(ds/dP)t' }
      ],
      correct_option_id: 'opt2',
      explanation: 'From dF = -S*dT - P*dV, the exact differential condition yields (dP/dT)v = (ds/dv)t.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-18',
      subject: 'Mechanical Engineering',
      topic: 'Heat Exchangers',
      difficulty: 'medium',
      question_text: 'For the same inlet and outlet fluid temperatures, the Logarithmic Mean Temperature Difference (LMTD) of a counter-flow heat exchanger compared to a parallel-flow heat exchanger is',
      options: [
        { id: 'opt1', text: 'Smaller' },
        { id: 'opt2', text: 'Equal' },
        { id: 'opt3', text: 'Larger' },
        { id: 'opt4', text: 'Zero' }
      ],
      correct_option_id: 'opt3',
      explanation: 'Counter-flow heat exchangers maintain a higher and more uniform temperature difference throughout, resulting in a strictly larger LMTD and requiring less surface area.',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-19',
      subject: 'Mechanical Engineering',
      topic: 'Radiation Heat Transfer',
      difficulty: 'easy',
      question_text: 'According to Stefan-Boltzmann law, the total emissive power of a blackbody is directly proportional to',
      options: [
        { id: 'opt1', text: 'Absolute temperature (T)' },
        { id: 'opt2', text: 'Square of absolute temperature (T^2)' },
        { id: 'opt3', text: 'Cube of absolute temperature (T^3)' },
        { id: 'opt4', text: 'Fourth power of absolute temperature (T^4)' }
      ],
      correct_option_id: 'opt4',
      explanation: 'The emissive power of an ideal black body is Eb = sigma * T^4, where sigma is 5.67 x 10^-8 W/(m^2 * K^4).',
      marks: 1.0,
      negative_penalty: 0.25
    },
    {
      id: 'q-20',
      subject: 'Mechanical Engineering',
      topic: 'Compressible Fluid Dynamics',
      difficulty: 'hard',
      question_text: 'Across a normal shock wave in supersonic gas flow, the stagnation pressure (total pressure)',
      options: [
        { id: 'opt1', text: 'Increases' },
        { id: 'opt2', text: 'Remains strictly constant' },
        { id: 'opt3', text: 'Decreases due to entropy generation' },
        { id: 'opt4', text: 'Becomes negative' }
      ],
      correct_option_id: 'opt3',
      explanation: 'A shock wave is an extremely rapid irreversible compression process. Irreversibility generates entropy (s2 > s1), which causes a loss in stagnation pressure (P02 < P01).',
      marks: 1.0,
      negative_penalty: 0.25
    }
  ];

  for (const q of questionsData) {
    insertQuestion.run(
      q.id,
      q.subject,
      q.topic,
      q.difficulty,
      q.question_text,
      JSON.stringify(q.options),
      q.correct_option_id,
      q.explanation,
      q.marks,
      q.negative_penalty
    );
  }

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
    const row = db.prepare('SELECT id, student_id, name, email, role, avatar_url, phone, status, created_at, updated_at FROM profiles WHERE id = ?').get(id) as UserProfile;
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
    if (!existing || existing.role !== 'student') return null;

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
    const res = db.prepare('UPDATE profiles SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(newHash, userId);
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
      .run(`mem-${Date.now().toString(36)}`, batchId, studentId);
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
      SELECT b.name FROM batches b
      JOIN assignment_recipients ar ON b.id = ar.batch_id
      WHERE ar.assignment_id = ?
    `);
    const countSubs = db.prepare('SELECT count(*) as count FROM assignment_submissions WHERE assignment_id = ?');

    return assignments.map(a => {
      const bNames = (getBatches.all(a.id) as { name: string }[]).map(r => r.name);
      const subCount = (countSubs.get(a.id) as { count: number }).count;
      return {
        ...a,
        allowed_formats: typeof a.allowed_formats === 'string' ? (a.allowed_formats as string).split(',') : a.allowed_formats,
        recipient_batch_names: bNames,
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
    question_text: string;
    options: { id: string; text: string }[];
    correct_option_id: string;
    explanation?: string;
    marks: number;
    negative_penalty: number;
    created_by?: string;
  }): QuestionBankItem {
    const id = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO question_bank (
        id, subject, topic, difficulty, question_text, options,
        correct_option_id, explanation, marks, negative_penalty, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.subject,
      data.topic,
      data.difficulty,
      data.question_text,
      JSON.stringify(data.options),
      data.correct_option_id,
      data.explanation || null,
      data.marks,
      data.negative_penalty,
      data.created_by || null
    );

    return this.getQuestionById(id)!;
  },

  deleteQuestion(id: string): boolean {
    const res = db.prepare('DELETE FROM question_bank WHERE id = ?').run(id);
    return res.changes > 0;
  },

  // Exams
  getAllExams(): (Exam & { recipient_batch_names: string[]; attempt_count: number })[] {
    const exams = db.prepare('SELECT * FROM exams ORDER BY created_at DESC').all() as Exam[];
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

    const exams = db.prepare(`SELECT * FROM exams WHERE status = 'published' ORDER BY created_at DESC`).all() as Exam[];
    const getExamBatchesStmt = db.prepare('SELECT batch_id FROM exam_batches WHERE exam_id = ?');
    const getAttemptStmt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?');

    return exams.map(exam => {
      const eBatchIds = (getExamBatchesStmt.all(exam.id) as { batch_id: string }[]).map(r => r.batch_id);
      const isEligible = eBatchIds.some(bId => studentBatchIds.has(bId));
      const attempt = getAttemptStmt.get(exam.id, studentId) as ExamAttempt | undefined;

      return {
        ...exam,
        is_eligible: isEligible,
        attempt: attempt || null
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
  }): Exam {
    const id = `exam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const totalQ = data.question_ids.length;
    const maxMarks = totalQ * 1.0;

    db.prepare(`
      INSERT INTO exams (
        id, title, description, instructions, duration_minutes, total_questions,
        max_marks, marks_per_question, negative_marking, unattempted_deduction,
        allow_pausing, max_pauses, status, result_release_policy, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, ?, 0.0, ?, 0, 'published', 'immediate', ?)
    `).run(
      id,
      data.title,
      data.description || null,
      data.instructions || null,
      data.duration_minutes,
      totalQ,
      maxMarks,
      data.negative_marking,
      data.allow_pausing ? 1 : 0,
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

  deleteExam(id: string): boolean {
    const attempts = db.prepare('SELECT id FROM exam_attempts WHERE exam_id = ?').all(id) as { id: string }[];
    for (const att of attempts) {
      db.prepare('DELETE FROM attempt_responses WHERE attempt_id = ?').run(att.id);
    }
    db.prepare('DELETE FROM exam_attempts WHERE exam_id = ?').run(id);
    db.prepare('DELETE FROM exam_batches WHERE exam_id = ?').run(id);
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(id);
    const res = db.prepare('DELETE FROM exams WHERE id = ?').run(id);
    return res.changes > 0;
  },

  // ============================================================================
  // EXAMINATION ENGINE METHODS (Server-Authoritative, Bulletproof)
  // ============================================================================

  getStudentExamEligibility(examId: string, studentId: string): { is_eligible: boolean; reason?: string; attempt?: ExamAttempt } {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam;
    if (!exam) return { is_eligible: false, reason: 'Examination not found' };
    if (exam.status !== 'published') return { is_eligible: false, reason: 'Examination is not currently published' };

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
          authoritative_deadline, time_spent_seconds, is_paused, pause_count
        ) VALUES (?, ?, ?, ?, 'in_progress', ?, ?, 0, 0, 0)
      `).run(attemptId, examId, studentId, matchedBatch?.id || null, serverTimeStr, deadline);

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
    const rawQuestions = db.prepare(`
      SELECT q.id, eq.question_order, q.subject, q.topic, q.question_text, q.question_image_url, q.options, q.marks, q.negative_penalty
      FROM question_bank q
      JOIN exam_questions eq ON q.id = eq.question_id
      WHERE eq.exam_id = ?
      ORDER BY eq.question_order ASC
    `).all(examId) as (Omit<ExamQuestionClient, 'options'> & { options: string })[];

    const clientQuestions: ExamQuestionClient[] = rawQuestions.map(q => ({
      id: q.id,
      question_order: q.question_order,
      subject: q.subject,
      topic: q.topic,
      question_text: q.question_text,
      question_image_url: q.question_image_url,
      options: JSON.parse(q.options),
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
            is_marked_for_review = coalesce(?, is_marked_for_review),
            is_visited = coalesce(?, is_visited),
            time_spent_seconds = time_spent_seconds + coalesce(?, 0),
            updated_at = datetime('now')
        WHERE attempt_id = ? AND question_id = ?
      `).run(
        payload.selected_option_id !== undefined ? payload.selected_option_id : null,
        payload.is_marked_for_review !== undefined ? (payload.is_marked_for_review ? 1 : 0) : null,
        payload.is_visited !== undefined ? (payload.is_visited ? 1 : 0) : null,
        payload.time_spent_seconds || 0,
        attemptId,
        questionId
      );
    } else {
      db.prepare(`
        INSERT INTO attempt_responses (
          id, attempt_id, question_id, selected_option_id, is_marked_for_review, is_visited, time_spent_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `resp-${Date.now().toString(36)}`,
        attemptId,
        questionId,
        payload.selected_option_id || null,
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
      const hasAnswer = r.selected_option_id !== null && r.selected_option_id !== '';
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
      SELECT q.id, q.correct_option_id, q.marks, q.negative_penalty
      FROM question_bank q
      JOIN exam_questions eq ON q.id = eq.question_id
      WHERE eq.exam_id = ?
    `).all(exam.id) as { id: string; correct_option_id: string; marks: number; negative_penalty: number }[];

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
    this.createNotification({
      user_id: studentId,
      title: 'Exam Submitted Successfully',
      message: `Your examination "${exam.title}" has been submitted successfully. Your trainer will evaluate your answers and publish the results when they are ready.`,
      type: 'exam',
      link: `/student/exams/${exam.id}/result`
    });

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
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam;
    if (!exam) throw new Error('Exam not found');

    let attempt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(examId, studentId) as ExamAttempt | undefined;
    if (!attempt) {
      attempt = db.prepare(`
        SELECT ea.* FROM exam_attempts ea
        JOIN profiles p ON (p.id = ? OR p.student_id = ?)
        WHERE ea.exam_id = ? AND (ea.student_id = p.id OR ea.student_id = p.student_id)
      `).get(studentId, studentId, examId) as ExamAttempt | undefined;
    }
    if (!attempt) throw new Error('Attempt not found');

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
          id: exam.id,
          title: exam.title,
          total_questions: exam.total_questions,
          max_marks: exam.max_marks,
          instructions: exam.instructions
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
    const reviewQuestions = db.prepare(`
      SELECT q.id, eq.question_order, q.subject, q.topic, q.question_text, q.question_image_url,
             q.options, q.marks, q.negative_penalty, q.correct_option_id, q.explanation,
             ar.selected_option_id, ar.is_correct, ar.manual_marks, ar.teacher_remarks
      FROM question_bank q
      JOIN exam_questions eq ON q.id = eq.question_id
      LEFT JOIN attempt_responses ar ON q.id = ar.question_id AND ar.attempt_id = ?
      WHERE eq.exam_id = ?
      ORDER BY eq.question_order ASC
    `).all(attempt.id, examId) as any[];

    return {
      exam,
      attempt,
      is_published: true,
      status_message: 'Result Published',
      questions_review: reviewQuestions.map(q => ({
        ...q,
        options: JSON.parse(q.options)
      }))
    };
  },

  getExamAnalytics(examId: string): {
    exam: Exam;
    attempts: (ExamAttempt & { student_name: string; student_id_code: string; batch_name: string })[];
    stats: {
      total_students_eligible: number;
      total_attempted: number;
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
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as Exam;
    if (!exam) throw new Error('Exam not found');

    const attempts = db.prepare(`
      SELECT att.*, p.name as student_name, p.student_id as student_id_code, coalesce(b.name, 'Default Batch') as batch_name
      FROM exam_attempts att
      JOIN profiles p ON att.student_id = p.id
      LEFT JOIN batches b ON att.batch_id = b.id
      WHERE att.exam_id = ?
      ORDER BY att.total_score DESC, att.time_spent_seconds ASC
    `).all(examId) as (ExamAttempt & { student_name: string; student_id_code: string; batch_name: string })[];

    // Eligible students count
    const eligibleCount = (db.prepare(`
      SELECT count(DISTINCT bm.user_id) as count
      FROM batch_memberships bm
      JOIN exam_batches eb ON bm.batch_id = eb.batch_id
      WHERE eb.exam_id = ?
    `).get(examId) as { count: number }).count;

    const scores = attempts.filter(a => a.total_score !== null).map(a => a.total_score!);
    const avgScore = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const avgTime = attempts.length > 0 ? Math.floor(attempts.reduce((a, b) => a + b.time_spent_seconds, 0) / attempts.length) : 0;

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
        total_attempted: attempts.length,
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
    upcoming_exams: number;
    exams_in_progress: number;
    recent_submissions: (AssignmentSubmission & { student_name: string; assignment_title: string; batch_name: string })[];
    recent_results: (ExamAttempt & { student_name: string; exam_title: string })[];
    batch_completion_rates: { batch_name: string; completion_pct: number; student_count: number }[];
  } {
    const totalStudents = (db.prepare(`SELECT count(*) as count FROM profiles WHERE role = 'student' AND status = 'active'`).get() as { count: number } | undefined)?.count || 0;
    const activeBatches = (db.prepare(`SELECT count(*) as count FROM batches WHERE status = 'active'`).get() as { count: number } | undefined)?.count || 0;

    const awaitingEvaluations = (db.prepare(`SELECT count(*) as count FROM assignment_submissions WHERE status = 'submitted'`).get() as { count: number } | undefined)?.count || 0;
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
      JOIN profiles p ON sub.student_id = p.id
      JOIN assignments a ON sub.assignment_id = a.id
      LEFT JOIN batches b ON sub.batch_id = b.id
      ORDER BY sub.submitted_at DESC LIMIT 5
    `).all() as (AssignmentSubmission & { student_name: string; assignment_title: string; batch_name: string })[]) || []);

    const recentResults = ((db.prepare(`
      SELECT att.*, p.name as student_name, e.title as exam_title
      FROM exam_attempts att
      JOIN profiles p ON att.student_id = p.id
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

    return {
      total_students: totalStudents,
      active_batches: activeBatches,
      pending_assignments: pendingAssignments,
      completed_assignments: completedAssignments,
      overdue_assignments: overdueAssignments,
      awaiting_evaluations: awaitingEvaluations,
      upcoming_exams: upcomingExams,
      exams_in_progress: examsInProgress,
      recent_submissions: recentSubmissions,
      recent_results: recentResults,
      batch_completion_rates: batchCompletionRates
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
    const student = this.getUserById(studentId)!;
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
      if (e.attempt?.status === 'completed') completedEx++;
      else upcomingEx++;
    }

    const recentSubs = db.prepare(`
      SELECT sub.*, a.title as assignment_title
      FROM assignment_submissions sub
      JOIN assignments a ON sub.assignment_id = a.id
      WHERE sub.student_id = ?
      ORDER BY sub.submitted_at DESC LIMIT 5
    `).all(studentId) as (AssignmentSubmission & { assignment_title: string })[];

    const recentExams = db.prepare(`
      SELECT att.*, e.title as exam_title, e.max_marks
      FROM exam_attempts att
      JOIN exams e ON att.exam_id = e.id
      WHERE att.student_id = ? AND att.status = 'completed' AND att.is_published = 1
      ORDER BY att.submitted_at DESC LIMIT 5
    `).all(studentId) as (ExamAttempt & { exam_title: string; max_marks: number })[];

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
        att.evaluation_history
      FROM exam_attempts att
      JOIN exams e ON att.exam_id = e.id
      JOIN profiles p ON att.student_id = p.id
      LEFT JOIN batches b ON att.batch_id = b.id
      WHERE att.status = 'completed'
    `;
    const params: any[] = [];

    if (filter?.batch_id && filter.batch_id !== 'all') {
      query += ` AND att.batch_id = ?`;
      params.push(filter.batch_id);
    }
    if (filter?.exam_id && filter.exam_id !== 'all') {
      query += ` AND att.exam_id = ?`;
      params.push(filter.exam_id);
    }
    if (filter?.status && filter.status !== 'all') {
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

    const allCompletedAttempts = db.prepare(`SELECT * FROM exam_attempts WHERE status = 'completed'`).all() as any[];
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

    const student = this.getUserById(attempt.student_id);
    const exam = this.getExamById(attempt.exam_id);
    if (!student || !exam) throw new Error('Student or exam not found');

    const batch = attempt.batch_id ? this.getBatchById(attempt.batch_id) : null;

    // Fetch all questions for this exam and student's responses
    const questions = db.prepare(`
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

    let history: any[] = [];
    try {
      if (attempt.evaluation_history) {
        history = JSON.parse(attempt.evaluation_history);
      }
    } catch {}

    return {
      attempt: {
        ...attempt,
        is_published: Boolean(attempt.is_published)
      },
      student,
      batch,
      exam,
      questions: questions.map(q => ({
        ...q,
        options: JSON.parse(q.options),
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
          evaluation_status = ?,
          evaluated_at = ?,
          evaluated_by = ?,
          trainer_feedback = ?,
          evaluation_history = ?
      WHERE id = ?
    `).run(
      newScore,
      percentage,
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
    const student = this.getUserById(studentId);
    if (!student) return [];

    const assignedExams = this.getExamsForStudent(studentId);

    return assignedExams.map(ex => {
      const att = db.prepare(`
        SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?
      `).get(ex.id, studentId) as any;

      if (!att) {
        return {
          exam: ex,
          submission_state: 'not_started' as const,
          attempt: null
        };
      }

      const isPublished = Boolean(att.is_published);

      return {
        exam: ex,
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
          // Only reveal score when published!
          total_score: isPublished ? att.total_score : null,
          percentage: isPublished ? att.percentage : null,
          trainer_feedback: isPublished ? att.trainer_feedback : null,
          published_at: isPublished ? att.published_at : null
        }
      };
    });
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
  }
};
