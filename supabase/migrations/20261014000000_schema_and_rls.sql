-- ============================================================================
-- TRAINER CLASSROOM & ONLINE EXAMINATION PORTAL - POSTGRESQL / SUPABASE SCHEMA
-- Author: Tushar Shukla Portal Architect
-- Description: Complete Relational Schema with Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES / USERS TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE, -- null for admin/trainer, formatted e.g. 'STU-2026-001'
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  avatar_url TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BATCHES TABLE
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g. '9:00 AM Batch', '1:00 PM Batch', '5:00 PM Batch'
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. BATCH MEMBERSHIPS (Many-to-Many: Students to Batches)
CREATE TABLE IF NOT EXISTS batch_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_batch UNIQUE (batch_id, user_id)
);

-- 4. ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  instructions TEXT NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('file_upload', 'text_response', 'both')),
  allowed_formats TEXT[] NOT NULL DEFAULT ARRAY['pdf', 'docx', 'xlsx', 'csv', 'txt', 'png', 'jpg'],
  max_file_size_mb INTEGER NOT NULL DEFAULT 10,
  max_score NUMERIC NOT NULL DEFAULT 100,
  rubric JSONB,
  reference_file_url TEXT,
  reference_file_name TEXT,
  allow_late_submissions BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ASSIGNMENT RECIPIENTS (Explicit batch and student targeting)
CREATE TABLE IF NOT EXISTS assignment_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ASSIGNMENT SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  text_response TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_mime TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'evaluated')),
  marks_awarded NUMERIC,
  feedback TEXT,
  feedback_released BOOLEAN NOT NULL DEFAULT false,
  evaluated_at TIMESTAMPTZ,
  evaluated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT unique_student_assignment_version UNIQUE (assignment_id, student_id, version)
);

-- 7. EXAMS TABLE
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  total_questions INTEGER NOT NULL DEFAULT 20,
  max_marks NUMERIC NOT NULL DEFAULT 20,
  marks_per_question NUMERIC NOT NULL DEFAULT 1.0,
  negative_marking NUMERIC NOT NULL DEFAULT 0.25,
  unattempted_deduction NUMERIC NOT NULL DEFAULT 0.0,
  allow_pausing BOOLEAN NOT NULL DEFAULT false,
  max_pauses INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  result_release_policy TEXT NOT NULL DEFAULT 'immediate' CHECK (result_release_policy IN ('immediate', 'manual', 'after_deadline')),
  start_window TIMESTAMPTZ,
  end_window TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. EXAM BATCHES
CREATE TABLE IF NOT EXISTS exam_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  CONSTRAINT unique_exam_batch UNIQUE (exam_id, batch_id)
);

-- 9. QUESTION BANK TABLE
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text TEXT NOT NULL,
  question_image_url TEXT,
  options JSONB NOT NULL, -- Array of { id: string, text: string }
  correct_option_id TEXT NOT NULL, -- Shielded from students!
  explanation TEXT, -- Shielded from students until results release!
  marks NUMERIC NOT NULL DEFAULT 1.0,
  negative_penalty NUMERIC NOT NULL DEFAULT 0.25,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. EXAM QUESTIONS (Association between Exam & Question Bank)
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  CONSTRAINT unique_exam_question UNIQUE (exam_id, question_id)
);

-- 11. EXAM ATTEMPTS TABLE (Authoritative Server-Enforced State)
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authoritative_deadline TIMESTAMPTZ NOT NULL, -- Calculated by server: started_at + duration
  submitted_at TIMESTAMPTZ,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  pause_count INTEGER NOT NULL DEFAULT 0,
  total_score NUMERIC,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_incorrect INTEGER NOT NULL DEFAULT 0,
  total_unattempted INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC,
  accuracy NUMERIC,
  rank INTEGER,
  feedback TEXT,
  CONSTRAINT unique_exam_student_attempt UNIQUE (exam_id, student_id)
);

-- 12. ATTEMPT RESPONSES TABLE
CREATE TABLE IF NOT EXISTS attempt_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  selected_option_id TEXT, -- Null if unattempted
  is_marked_for_review BOOLEAN NOT NULL DEFAULT false,
  is_visited BOOLEAN NOT NULL DEFAULT true,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  is_correct BOOLEAN,
  score_awarded NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

-- 13. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'assignment', 'exam', 'grade', 'system')),
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR MAXIMUM QUERY EFFICIENCY
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_batch_memberships_user ON batch_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_memberships_batch ON batch_memberships(batch_id);
CREATE INDEX IF NOT EXISTS idx_assignment_recipients_batch ON assignment_recipients(batch_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_exam_batches_batch ON exam_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempt_responses_attempt ON attempt_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PROFILES POLICIES
CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Students can update their own permitted fields"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. BATCHES & MEMBERSHIP POLICIES
CREATE POLICY "Admins have full access to batches"
  ON batches FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view batches they belong to"
  ON batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM batch_memberships
      WHERE batch_memberships.batch_id = batches.id
        AND batch_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to batch_memberships"
  ON batch_memberships FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view their own batch_memberships"
  ON batch_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. ASSIGNMENTS POLICIES
CREATE POLICY "Admins have full access to assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view assigned published assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND (
      EXISTS (
        SELECT 1 FROM assignment_recipients ar
        JOIN batch_memberships bm ON ar.batch_id = bm.batch_id
        WHERE ar.assignment_id = assignments.id AND bm.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM assignment_recipients ar
        WHERE ar.assignment_id = assignments.id AND ar.student_id = auth.uid()
      )
    )
  );

-- 4. ASSIGNMENT SUBMISSIONS POLICIES
CREATE POLICY "Admins have full access to submissions"
  ON assignment_submissions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view their own submissions"
  ON assignment_submissions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own submissions"
  ON assignment_submissions FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their submissions before evaluation"
  ON assignment_submissions FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() AND status != 'evaluated')
  WITH CHECK (student_id = auth.uid() AND status != 'evaluated');

-- 5. EXAMS & QUESTION BANK POLICIES
CREATE POLICY "Admins have full access to exams"
  ON exams FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view exams assigned to their batch"
  ON exams FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND
    EXISTS (
      SELECT 1 FROM exam_batches eb
      JOIN batch_memberships bm ON eb.batch_id = bm.batch_id
      WHERE eb.exam_id = exams.id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to question bank"
  ON question_bank FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Students should NEVER see the question_bank table directly with correct_option_id
-- Exam questions for students are served through sanitized views or server functions!

-- 6. EXAM ATTEMPTS & RESPONSES POLICIES
CREATE POLICY "Admins have full access to exam_attempts"
  ON exam_attempts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can view their own attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create their own attempt"
  ON exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their attempt before deadline and submission"
  ON exam_attempts FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() AND status = 'in_progress')
  WITH CHECK (student_id = auth.uid() AND status = 'in_progress');

CREATE POLICY "Admins have full access to attempt_responses"
  ON attempt_responses FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can manage responses for their active attempt"
  ON attempt_responses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_attempts ea
      WHERE ea.id = attempt_responses.attempt_id
        AND ea.student_id = auth.uid()
        AND ea.status = 'in_progress'
        AND now() <= ea.authoritative_deadline
    )
  );

-- 7. NOTIFICATIONS POLICIES
CREATE POLICY "Users can view and manage their own notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
