-- ============================================================================
-- EXAM DEADLINES, ABSENT AUTO-FAIL, AND PERMANENT SCORECARD LEDGER MIGRATION
-- Author: Tushar Shukla Portal Architect
-- Description: Adds deadline columns, pass/fail status, and snapshot metadata to ensure
--              permanent scorecard retention even after exam removal.
-- ============================================================================

-- Ensure exams table exists and has deadline and soft-delete fields
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  total_questions INTEGER NOT NULL DEFAULT 0,
  marks_per_question NUMERIC NOT NULL DEFAULT 1.0,
  negative_marking NUMERIC NOT NULL DEFAULT 0.0,
  max_marks NUMERIC NOT NULL DEFAULT 0.0,
  passing_percentage NUMERIC NOT NULL DEFAULT 40.0,
  start_window TIMESTAMPTZ,
  end_window TIMESTAMPTZ,
  allow_pausing BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if exams table already existed
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_window TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_window TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS passing_percentage NUMERIC DEFAULT 40.0;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Ensure exam_attempts table exists and has evaluation status and snapshot fields
CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  batch_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  evaluation_status TEXT NOT NULL DEFAULT 'evaluated',
  is_published INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  total_score NUMERIC DEFAULT 0.0,
  percentage NUMERIC DEFAULT 0.0,
  rank INTEGER,
  total_correct INTEGER DEFAULT 0,
  total_incorrect INTEGER DEFAULT 0,
  total_unattempted INTEGER DEFAULT 0,
  trainer_feedback TEXT,
  is_absent INTEGER NOT NULL DEFAULT 0,
  result_status TEXT NOT NULL DEFAULT 'pending',
  exam_title TEXT,
  exam_max_marks NUMERIC,
  exam_duration_minutes INTEGER,
  exam_passing_percentage NUMERIC,
  batch_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns to exam_attempts if table already existed
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS is_absent INTEGER DEFAULT 0;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS result_status TEXT DEFAULT 'pending';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS exam_title TEXT;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS exam_max_marks NUMERIC;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS exam_duration_minutes INTEGER;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS exam_passing_percentage NUMERIC;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS batch_name TEXT;

-- Create indexes for ultra-fast query performance
CREATE INDEX IF NOT EXISTS idx_exams_end_window ON exams(end_window);
CREATE INDEX IF NOT EXISTS idx_exams_is_deleted ON exams(is_deleted);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_exam ON exam_attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_result_status ON exam_attempts(result_status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_is_absent ON exam_attempts(is_absent);
