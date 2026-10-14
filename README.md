# Trainer Classroom & Online Examination Portal
> Complete, production-grade Classroom Management and Online Examination Platform built for **Trainer Tushar Shukla** and his students.

---

## 1. System Overview

This web application provides a full-featured, database-backed platform for managing student batches, daily homework assignments, file submissions, submission evaluation with draft/release controls, an assignment monitoring matrix, question banks, and a high-stakes online examination system.

### Key Highlights
- **Two Distinct Experiences**:
  - **Admin / Trainer Portal**: Dashboard with real database-calculated metrics, Batch Management (9:00 AM, 1:00 PM, 5:00 PM cohorts), Student Account Management (with temporary passwords and batch rosters), Daily Homework Manager (batch targeting, pre-publish review), Evaluation Queue (with file preview and marks release), Assignment Monitoring Matrix (spreadsheet-like tracking with CSV export), Question Bank (20+ thermodynamics AE/JE questions), Exam Manager, and Exam Analytics (rankings and score breakdowns).
  - **Student Portal**: Student Dashboard, Homework List, File & Text Submission workflow with version history, Examination Instructions (Reference Screenshots 1 & 2), Full-Screen Distraction-Free Exam Interface (Reference Screenshot 3), Question Palette with 5 status states, Autosave with retry states, Authoritative Server Timer, Submission Confirmation Breakdown Modal (Reference Screenshot 4), and Post-Exam Review with explanations.
- **UI Design Philosophy**:
  - **Claymorphism** for Dashboards: Soft pastel surfaces, layered depth, rounded cards, comfortable spacing, and gentle tactile feedback.
  - **Clean Exam Workspace**: High-contrast, distraction-free examination interface mirroring actual professional examination portals (Testbook AE/JE mock style).
- **Security & Authorization**:
  - Strict Batch-Level Isolation: Students in Batch A cannot view or access assignments/exams assigned exclusively to Batch B.
  - Authoritative Server Clock: Exam deadlines and timers cannot be manipulated by client clock changes or tab refreshes.
  - Answer Key Isolation: Answer keys and explanations are omitted from student exam payloads and only evaluated server-side.
  - Password Security: `bcryptjs` salted hashing; JWT session cookies with `httpOnly` flags.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4 with custom Claymorphism design system
- **Icons**: Lucide React
- **Local Database**: Embedded SQLite via `better-sqlite3` (`data/portal.db`) with zero-config auto-initialization and auto-seeding
- **Remote Database (Optional)**: Supabase PostgreSQL (`supabase/migrations/20261014000000_schema_and_rls.sql`)
- **Authentication**: JWT session tokens signed with `jose` (HS256) and `bcryptjs` password hashing
- **File Storage**: Local private storage (`data/uploads/`) with authorized stream endpoints and optional Supabase Storage bucket integration
- **Testing**: Vitest with unit, isolation, and 12-step end-to-end lifecycle test suites
- **Timezone**: Asia/Kolkata (IST)

---

## 3. Prerequisites & Installation

### Required Software
- **Node.js**: v18.17.0 or higher (v20+ recommended)
- **npm**: v9 or higher (or equivalent package manager)
- **OS**: Windows, macOS, or Linux

### Installation Steps

1. **Clone or navigate to the workspace directory**:
   ```bash
   cd "Test Window"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   copy .env.example .env.local
   # On macOS/Linux: cp .env.example .env.local
   ```

---

## 4. Default Seeded Credentials

The database automatically initializes upon first start with the following demonstration accounts:

### Trainer / Administrator
- **Admin ID**: `Tushar1234`
- **Email**: `tushar@cybrom.com`
- **Password**: `Tushar@0963`
- **Role**: Admin / Trainer

### Sample Students
| Student ID | Name | Enrolled Cohorts | Password |
| :--- | :--- | :--- | :--- |
| `STU-2026-001` | Rahul Verma | 9:00 AM Batch, 5:00 PM Batch | `Password@123` |
| `STU-2026-002` | Priya Patel | 9:00 AM Batch | `Password@123` |
| `STU-2026-003` | Amit Kumar | 1:00 PM Batch | `Password@123` |
| `STU-2026-004` | Sneha Singh | 1:00 PM Batch, 5:00 PM Batch | `Password@123` |
| `STU-2026-005` | Vikram Rao | 5:00 PM Batch | `Password@123` |

> [!NOTE]
> For quick testing, the `/login` page provides **1-Click Quick Fill buttons** for Trainer Tushar and Student Rahul Verma.

---

## 5. Running the Application Locally

### Development Server
Run the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. It automatically redirects to `/login`.

### Production Build & Start
To test the production build locally:
```bash
npm run build
npm run start
```

---

## 6. Running Automated Tests

The application includes automated unit, isolation, and full end-to-end lifecycle test suites:

Run all tests once:
```bash
npm test
```

Watch mode for active development:
```bash
npm run test:watch
```

### Test Suites Included (29 Automated Tests)
1. **`tests/grading.test.ts`**:
   - MCQ single-choice grading with positive (+1.0) and negative marking (-0.25)
   - Zero penalty for unattempted questions
   - Decimal rounding and accuracy percentage calculations
2. **`tests/isolation.test.ts`**:
   - Student cohort batch membership verification
   - Exam eligibility restriction to enrolled batches
   - Assignment visibility isolation between 9:00 AM and 1:00 PM batches
3. **`tests/manual-evaluation-publishing.test.ts`**: Trainer-controlled manual evaluation & batch publishing:
   - Student submission confirmation without score leak
   - Protected API preventing devtools/direct URL score retrieval
   - Trainer inspection and question-wise manual marks adjustment
   - Draft evaluation saving (`in_progress`, `evaluated`)
   - Batch-wise result publication to cohort
   - Student scorecard release with teacher remarks & solutions
   - Audit trail on evaluation revision and republishing
   - Cross-cohort isolation verification
4. **`tests/auth.test.ts`**:
   - Password hashing and verification via bcrypt
   - Session JWT issuance, signing, and cryptographic verification
5. **`tests/e2e-workflow.test.ts`**: Complete 12-step lifecycle simulation:
   1. Admin creates a student account
   2. Admin enrolls student in a batch
   3. Admin assigns homework to that batch
   4. Student submits homework (text response + file attachment)
   5. Admin evaluates submission, enters marks (48/50), and releases feedback
   6. Admin creates an online examination and assigns it to the cohort
   7. Student reads instructions and begins the exam (receiving server-authoritative deadline)
   8. Student navigates, answers questions, marks for review, and verifies autosave
   9. Student reviews submission confirmation breakdown modal
   10. Backend atomically finalizes attempt in pending_evaluation without score leak
   11. Trainer evaluates, adjusts marks, and officially publishes result to student
   12. Student from an unrelated batch is denied access to the private examination

---

## 7. Database Architecture & Schema

The application uses an embedded relational database model (compatible with PostgreSQL and SQLite) with foreign key constraints, unique constraints, and transaction safety:

### Core Tables
- `profiles`: User accounts (Trainer and Students) with Student IDs, hashed passwords, roles, and account status.
- `batches`: Student cohorts (9:00 AM, 1:00 PM, 5:00 PM) with active/archived status.
- `batch_memberships`: Many-to-many relationship linking students to batches.
- `assignments`: Daily homework tasks with deadline, submission type (`file`, `text`, `both`), allowed formats, and rubrics.
- `assignment_recipients`: Cohort batch targeting records for assignments.
- `assignment_submissions`: Student submission records with versioning, file metadata, text response, and draft/released evaluation marks.
- `questions`: Question bank with subject, topic, difficulty, JSON options, correct answer keys, and explanations.
- `exams`: Online examinations with duration, marking scheme (+1, -0.25), availability window, and pause settings.
- `exam_batches`: Cohort batch targeting records for examinations.
- `exam_questions`: Ordered question associations for an exam.
- `exam_attempts`: Student attempt sessions with server-authoritative start time, deadline, status, total score, and rank.
- `exam_attempt_responses`: Per-question answer selections, review flags, and visit status.
- `notifications`: In-app notification records for assignments, deadlines, evaluations, and exam results.

---

## 8. Optional Supabase PostgreSQL & Storage Setup

If connecting to a Supabase project (hosted or local via Supabase CLI):

1. **Create a Supabase Project**:
   Create a new project at [supabase.com](https://supabase.com).

2. **Apply SQL Migration**:
   Navigate to the SQL Editor in your Supabase dashboard and run the migration file:
   [supabase/migrations/20261014000000_schema_and_rls.sql](file:///c:/Users/HP/Desktop/Cybrom%20work/Projects/Test%20Window/supabase/migrations/20261014000000_schema_and_rls.sql)

   This script creates all tables, foreign keys, triggers, and comprehensive **Row Level Security (RLS)** policies for:
   - Student read isolation (`auth.uid() = student_id`)
   - Cohort batch eligibility
   - Answer key hiding during active examinations
   - Trainer-only evaluation and publishing controls

3. **Seed Demonstration Data (Optional)**:
   Run the seed script in the SQL editor:
   [supabase/seed.sql](file:///c:/Users/HP/Desktop/Cybrom%20work/Projects/Test%20Window/supabase/seed.sql)

4. **Configure Private Storage Buckets**:
   In the Supabase Storage console:
   - Create private bucket: `assignments` (Max file size: 25 MB, Allowed MIME: `pdf, docx, xlsx, txt, png, jpg`)
   - Create private bucket: `submissions` (Max file size: 25 MB)
   - Enable RLS on storage objects allowing upload and download only to authorized users.

5. **Update Environment Variables**:
   In `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

---

## 9. Creating Additional Administrators

To create an additional administrator account or reset the Trainer password:
- The initial administrator is seeded as `tushar@cybrom.com`.
- To provision a new administrator via script, use `src/lib/db/database.ts` or call `dbService.createStudent` with role `'admin'`.
- All password updates utilize 12-round bcrypt hashing.

---

## 10. Troubleshooting & Common Questions

- **Port Conflict (3000 in use)**:
  Run `PORT=3001 npm run dev` or change the port in `package.json`.
- **Database Location**:
  The SQLite database file is located at `data/portal.db`. Deleting this file will cause the database to re-initialize and re-seed clean demonstration data upon server restart.
- **File Upload Directory**:
  Uploaded assignment reference files and student submissions are safely stored under `data/uploads/` with UUID-prefixed filenames to prevent directory traversal and overwrite attacks.

---

## 11. Security & Compliance Checklist

- [x] **No Remote Push**: No code is pushed to GitHub or remote repositories; application runs strictly local.
- [x] **No Fake Data**: All dashboard counts, completion rates, matrix statuses, and exam scores are dynamically queried from the database.
- [x] **Server-Authoritative Timing**: Exam timers are calculated from `authoritative_deadline` on the server; client refreshes cannot extend time.
- [x] **Answer Key Protection**: Student exam API responses explicitly omit `correct_option_id` and `explanation` until results are released.
- [x] **Atomic Exam Submission**: Exactly-once finalization prevents duplicate grading or submission replay attacks.
- [x] **File Download Authorization**: File streaming validates session tokens before releasing private attachments.
