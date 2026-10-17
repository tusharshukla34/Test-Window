export type UserRole = 'admin' | 'student';
export type AccountStatus = 'active' | 'inactive';

export interface FeedbackRecord {
  id: string;
  user_id: string;
  category: 'bug' | 'dashboard' | 'assignment' | 'exam' | 'suggestion' | 'other';
  title: string;
  description: string;
  device_info?: string | null;
  page_url?: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  student_id?: string | null;
  student_email?: string;
}

export interface UserProfile {
  id: string;
  student_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string | null;
  phone?: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface UserWithPassword extends UserProfile {
  password_hash: string;
}

export interface Batch {
  id: string;
  name: string; // e.g. "9:00 AM Batch", "1:00 PM Batch", "5:00 PM Batch"
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export interface BatchMembership {
  id: string;
  batch_id: string;
  user_id: string;
  enrolled_at: string;
  student?: UserProfile;
  batch?: Batch;
}

export type SubmissionType = 'file_upload' | 'text_response' | 'both';
export type AssignmentStatus = 'draft' | 'published' | 'archived';

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  instructions: string;
  submission_type: SubmissionType;
  allowed_formats: string[]; // ['pdf', 'docx', 'png', etc.]
  max_file_size_mb: number;
  max_score: number;
  rubric?: string | null;
  reference_file_url?: string | null;
  reference_file_name?: string | null;
  allow_late_submissions: boolean;
  status: AssignmentStatus;
  start_date: string;
  deadline: string; // ISO string in UTC, displayed in Asia/Kolkata
  created_by: string | null;
  created_at: string;
  updated_at: string;
  target_batches?: string[]; // array of batch_ids
}

export type SubmissionReviewStatus = 'submitted' | 'under_review' | 'evaluated';

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  batch_id: string | null;
  version: number;
  text_response?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  submitted_at: string;
  is_late: boolean;
  status: SubmissionReviewStatus;
  marks_awarded?: number | null;
  feedback?: string | null;
  feedback_released: boolean;
  evaluated_at?: string | null;
  evaluated_by?: string | null;
  student?: UserProfile;
  assignment?: Assignment;
  batch?: Batch;
}

export interface QuestionOption {
  id: string; // e.g. "opt1", "opt2", "opt3", "opt4"
  text: string;
}

export interface QuestionBankItem {
  id: string;
  subject: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  question_image_url?: string | null;
  options: QuestionOption[];
  correct_option_id: string; // Kept private on server!
  explanation?: string | null; // Kept private until results release!
  marks: number;
  negative_penalty: number;
  created_by?: string | null;
  created_at: string;
}

// Client-sanitized question for exam-taking student (NO correct_option_id or explanation!)
export interface ExamQuestionClient {
  id: string;
  question_order: number;
  subject: string;
  topic: string;
  question_text: string;
  question_image_url?: string | null;
  options: QuestionOption[];
  marks: number;
  negative_penalty: number;
}

export interface Exam {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  duration_minutes: number;
  total_questions: number;
  max_marks: number;
  marks_per_question: number;
  negative_marking: number;
  unattempted_deduction: number;
  allow_pausing: boolean;
  max_pauses: number;
  status: 'draft' | 'published' | 'archived';
  result_release_policy: 'immediate' | 'manual' | 'after_deadline';
  start_window?: string | null;
  end_window?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  target_batches?: string[];
  question_count?: number;
}

export type AttemptStatus = 'in_progress' | 'completed' | 'expired';
export type ExamEvaluationStatus = 'pending_evaluation' | 'in_progress' | 'evaluated' | 'published';

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  batch_id?: string | null;
  status: AttemptStatus;
  started_at: string;
  authoritative_deadline: string; // Server calculated
  submitted_at?: string | null;
  time_spent_seconds: number;
  is_paused: boolean;
  pause_count: number;
  total_score?: number | null;
  total_correct?: number;
  total_incorrect?: number;
  total_unattempted?: number;
  percentage?: number | null;
  accuracy?: number | null;
  rank?: number | null;
  feedback?: string | null;
  evaluation_status: ExamEvaluationStatus;
  is_published: boolean;
  published_at?: string | null;
  published_by?: string | null;
  evaluated_at?: string | null;
  evaluated_by?: string | null;
  trainer_feedback?: string | null;
  evaluation_history?: string | null;
  exam?: Exam;
  student?: UserProfile;
}

export interface AttemptResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id?: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  time_spent_seconds: number;
  is_correct?: boolean | null;
  score_awarded?: number | null;
  manual_marks?: number | null;
  teacher_remarks?: string | null;
  descriptive_answer?: string | null;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'assignment' | 'exam' | 'grade' | 'system';
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface MatrixStudentRow {
  student: UserProfile;
  batch_names: string[];
  assignments: Record<string, {
    status: 'Not Assigned' | 'Pending' | 'Submitted' | 'Late' | 'Under Review' | 'Evaluated' | 'Overdue';
    marks?: number | null;
    max_score?: number;
    submission_id?: string;
    submitted_at?: string;
  }>;
}

export interface StudentBatchBreakdown {
  batch_id: string;
  batch_name: string;
  batch_description: string | null;
  total_assignments: number;
  pending_assignments: number;
  submitted_assignments: number;
  evaluated_assignments: number;
  overdue_assignments: number;
  upcoming_exams: number;
  completed_exams: number;
  assignments: {
    id: string;
    title: string;
    subject: string;
    deadline: string;
    status: 'pending' | 'submitted' | 'evaluated' | 'overdue';
    marks_awarded?: number | null;
    max_score: number;
  }[];
  exams: {
    id: string;
    title: string;
    duration_minutes: number;
    max_marks: number;
    status: 'available' | 'in_progress' | 'completed';
    total_score?: number | null;
  }[];
}

export type CalendarEventType =
  | 'batch_created'
  | 'assignment_assigned'
  | 'assignment_deadline'
  | 'exam_scheduled'
  | 'exam_window';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  subtitle?: string;
  date: string; // "YYYY-MM-DD"
  time?: string; // "10:30 AM"
  timestamp: string; // ISO string
  batch_ids: string[];
  batch_names: string[];
  link_url?: string;
  badge_color?: 'indigo' | 'purple' | 'amber' | 'emerald' | 'rose' | 'teal';
  metadata?: Record<string, any>;
}
