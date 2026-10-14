# Production-Ready Trainer-Student Assignment & Exam System

## Executive Summary  
This report outlines a comprehensive design for a web-based *Trainer-Student Assignment & Online Examination* platform. We define **user roles** (Admin/Trainer and Student) with secure authentication and role-based access. A robust **batch management** system groups students for targeted assignments/exams. The **assignment module** supports creating, scheduling, and grading tasks, with file upload and deadline handling. The **exam engine** features a question bank, timed exams with server-controlled timers, autosave, question navigation (palette), mark-for-review, and end-to-end submission with server-side grading (including negative marking). We propose a normalized **data model** (ER diagram and schema) and an API design (endpoints table). The **tech stack** recommendation is Next.js/React/TypeScript with Tailwind CSS for the frontend, Prisma ORM with PostgreSQL for the database (potentially via Supabase), secure file storage (e.g., S3 or Supabase Storage), and server-side session or JWT-based auth (NextAuth). We include security measures such as Postgres Row-Level Security (RLS) policies, CSRF tokens, input/file validation, and password hashing. Reliability features like autosave, session recovery, and offline support are addressed. The UI/UX will be responsive and leverage *claymorphism* style for dashboards (soft pastel 3D elements) combined with a Testbook-like exam interface. We list testing strategies (unit/E2E), acceptance criteria, and a phased implementation plan with effort estimates. Finally, we cover deployment/dev best practices (local development, migrations, .env management) and explicitly note not to push code to GitHub. All major points are backed by primary sources (NextAuth, Supabase, Postgres docs, etc.) with citations. **Assumptions**: Hosting is unspecified (assume cloud or local), number of batches is flexible, email/SMS is optional, and code must remain local (no Git pushes). 

## User Roles & Authentication  
- **Roles**: The system will have two main roles: *Trainer/Admin* and *Student*. Admin/Trainers can create batches, assignments, and exams; Students can view and complete tasks/exams. Role is stored in each user’s profile (e.g. a `role` field in the Users table).  
- **Auth Flow**: On first login, students receive unique IDs and temporary passwords. They must change passwords on first login. Passwords are **bcrypt-hashed** on the server. We enforce secure practices: use HTTPS for all communication, and secure, HTTP-only cookies or JWTs for sessions.  
- **Password Reset**: Support “forgot password” via tokenized email. After login, session management can be done via NextAuth or similar library which provides signed, server-only cookies and built-in CSRF protection. For example, NextAuth.js automatically secures cookies and CSRF tokens on API routes.  
- **Access Control**: Use server-side authorization on each request. For example, each API route checks `req.user.role`. Combine this with PostgreSQL Row-Level Security (RLS) policies so that even if a Student gains direct DB access, they only see their own rows. A typical RLS policy could be:  
  ```
  CREATE POLICY "students_only_see_their_data"
    ON assignments FOR SELECT
    USING ((auth.uid() = student_id));
  ```  
  This ensures queries implicitly include `WHERE auth.uid() = assignments.student_id`.  

## Batch Management  
- **Batch Entity**: A *Batch* groups students (e.g. “Morning Batch”, “Evening Batch”). The database has a `batches` table and a join table `batch_memberships(user_id, batch_id)`. This allows many-to-many: a student can be in multiple batches if needed.  
- **CRUD & Assignment Targeting**: Admin can *Create/Edit/Delete* batches, and assign/unassign students to batches. When creating an assignment or exam, the trainer specifies either individual students or entire batches. If targeting a batch, the backend automatically grants access to all students in that batch (e.g., by linking the assignment to `batch_id`).  
- **Scope Enforcement**: Batch-scoping is enforced in queries. For example, when assigning a task to batch 5, only students whose `batch_memberships` include batch 5 receive it. Similarly, exam listings show only exams targeted at the student’s batches or assigned individually.  
- **Historical Records**: Maintain history by timestamping batch assignments. Even if a student leaves a batch, records of past submissions/exams remain associated via the join table. Delete operations are “soft” (flag as inactive) where appropriate to preserve history.  

## Assignment Module  
- **Create/Schedule/Publish**: The trainer UI allows creating an assignment with title, description, instructions, due date/time, allowed file types (e.g. PDF, DOCX), and optional total points. Assignments can be drafted and then published to selected batches or students.  
- **File Uploads**: Students submit attachments (the completed work). Use a secure file storage service (e.g. AWS S3 or Supabase Storage) with HTTPS upload endpoints. Enforce client-side and server-side **file type/size validation** and **virus scanning** on upload. All uploads occur over HTTPS to ensure encryption in transit. Files are stored with encryption at rest (modern cloud storage provides this by default).  
- **Timestamps & Late Policy**: Store a server timestamp on each submission. The due date enforces lateness: submissions after the deadline are marked “late”. Allow a configurable late submission window or re-submission limit (e.g. accept late with penalty or deny after final deadline).  
- **Resubmission**: Optionally, permit resubmissions before the deadline. Each new submission overwrites the previous for simplicity, or you can version with history if needed. Flag the latest submission.  
- **Evaluation Workflow**: Once submitted, the trainer can view submissions and grade them. The trainer UI lists each student’s file, time, and status. The trainer enters scores/feedback per submission. These grades are saved, and students are notified of evaluation (email or in-app).  
- **Notifications**: Implement optional notifications. For example, use a job queue or background process to email students when an assignment is created, when due date approaches, and when graded. Integrate with an email API (e.g. SendGrid or SES). If SMS is required, integrate Twilio. Notifications are not mandatory but recommended for usability.  

## Exam Engine  
- **Exam Builder**: Admins can create exams comprising multiple questions. Maintain a **question bank**: questions have fields like text, type (MCQ single/multiple answer, true-false, short answer), options (for MCQ) and correct answer(s)/points.  
- **Question Bank**: A relational design is used:  
  - `questions` table (id, text, type, points)  
  - `choices` table (id, question_id, text, is_correct) for MCQs.  
  - Optionally, allow multiple correct choices if type=“multiple-select”.  
- **Exam Definition**: An `exams` table stores exam metadata: title, description/instructions (shown before start), start time window (optional), end time (deadline), duration (minutes), negative marking rule (e.g. 0.25 points deduction per wrong answer), and target batches. A join table `exam_batches(exam_id, batch_id)` assigns batches to the exam.  
- **Pre-Exam Instructions**: Students see instructions (rules, allowed materials, etc.) before starting. Display a countdown (exam start time vs current time). Enforce exams to start only within the allowed window.  
- **Server-Authoritative Timer**: When a student starts an exam, record the server timestamp (`start_time`) and compute `end_time = start_time + duration`. The client displays the remaining time based on server time sync. Even if the user’s clock is wrong or disconnected, only the server’s `end_time` determines timeout. On each autosave or action, the client can ping the server to fetch the remaining time if needed.  
- **Full-Screen Mode & Anti-Cheating**: Require full-screen mode on desktop (using the Fullscreen API). Warn or pause if the user exits full-screen. Optionally disable right-click or cut/paste. *Note*: True cheating prevention requires specialized browsers (beyond scope), but at minimum, we ensure the exam UI is fullscreen locked as much as possible.  
- **Autosave**: Every *N* seconds (e.g. 15s) or upon each answer navigation, the client sends an autosave request with current answers to server via a REST or WebSocket endpoint. This guards against data loss. Also maintain answers locally (e.g. in `localStorage` or IndexedDB) in case of network drop, then sync back when online. The payload can be JSON (see *Sample payload* below).  
- **Question Navigation & Palette**: The UI shows one question at a time with controls: *Save & Next*, *Previous*, *Clear Response*, *Mark for Review*. A sidebar or palette shows all question numbers, color-coded by status (unseen, answered, flagged). Clicking a number jumps to that question.  
- **Question States**: Track status for each question: Answered, Unanswered, Marked (flagged) for review. The palette updates color accordingly. E.g., blue=marked, green=answered, grey=unanswered.  
- **Pause/Pause Timer**: Optionally allow pause (if unsupervised), though this can be abused. If allowed, it would halt timer until resume. The UI must confirm resume. All pauses are recorded. Alternatively, skip pause to avoid complexity.  
- **Submission Confirmation**: When the student clicks “Submit Exam”, show a confirmation modal: “You have X answered, Y unanswered, Z marked questions. Confirm submission.” Prevent accidental submits.  
- **Atomic Finalization**: On confirm, the client calls an API endpoint `/api/exams/submit` that finalizes the attempt. The server should lock further changes and ignore late answers. It then triggers grading. The finalization should be atomic to avoid double-submits (use DB transaction or a unique submission flag).  
- **Server-Side Grading**: On submission, the server grades immediately. For MCQs, check each chosen option against `is_correct` flags. Apply scoring rules: +points for correct, -negative for wrong if applicable (configurable). Compute total. For multi-select, score only if all correct options chosen (or partial credit if desired). For short-answer, manual grading is needed (mark all short answers as “Pending” and let trainer grade later). The example algorithm could be:
  ```sql
  -- Example pseudocode for MCQ scoring with negative marking
  score = 0;
  for each answer in submitted_answers:
      if answer.selected_option.is_correct:
          score += question.points;
      else if negative_marking:
          score -= negative_value; 
  ```
  Also consider edge cases: unanswered questions get 0, flagged answers count as is, multiple attempts not allowed.  
- **Results Publication**: After grading, mark the attempt as completed with final score. Notify the student (in-app or email) that results are available. Keep attempts historical (one row per attempt). Show result details: score, correct answers (after exam window closes), and any feedback.  
- **Sample JSON Payload (Autosave/Submit)**: A partial example of an autosave or submit payload from client:
  ```json
  {
    "attemptId": 123,
    "answers": [
      {"questionId": 1, "selectedOption": 10, "marked": false},
      {"questionId": 2, "selectedOption": 14, "marked": true},
      ...
    ],
    "currentTime": "2026-10-14T10:05:00Z"
  }
  ```

```mermaid
sequenceDiagram
  participant Student
  participant ClientApp as WebApp
  participant Server
  Student->>ClientApp: Clicks "Start Exam"
  ClientApp->>Server: GET /api/exams/{id}/start
  Server-->>ClientApp: { questions, startTime, duration }
  ClientApp->>Student: Render first question, start timer
  loop During Exam
    Student->>ClientApp: Navigate/Answer question
    ClientApp->>Server: POST /api/exams/autosave (answer payload)
    Server-->>ClientApp: 200 OK
  end
  Student->>ClientApp: Clicks "Submit"
  ClientApp->>Server: POST /api/exams/{attempt}/submit
  Server->>Server: Grade attempt, compute score
  Server-->>ClientApp: { score, status: completed }
  ClientApp->>Student: Show results confirmation
```

## Data Model (Schema)  
We propose a relational schema with these core entities (see the Mermaid ER diagram below). Each table lists key fields (PK=primary key, FK=foreign key):

| Entity            | Key Fields & Relations                                              | Description                                     |
|-------------------|---------------------------------------------------------------------|-------------------------------------------------|
| **User**          | `id` (PK), `name`, `email`, `password_hash`, `role`                | Users (Students/Trainers). `role` ∈ {student, trainer, admin}.  |
| **Batch**         | `id` (PK), `name`, `description`                                    | Group of students (e.g. batch name).            |
| **BatchMembership** | `user_id` (FK → User.id), `batch_id` (FK → Batch.id)              | Many-to-many linking users to batches.          |
| **Assignment**    | `id` (PK), `title`, `description`, `due_date`, `created_at`, `batch_id` (FK) | Assignment tasks. Linked to one batch (or null for all). |
| **AssignmentSubmission** | `id` (PK), `assignment_id` (FK), `user_id` (FK), `file_url`, `submitted_at`, `status`, `score` | Student submissions (file URL, timestamp, status, grade).  |
| **Exam**          | `id` (PK), `title`, `description`, `start_time`, `end_time`, `duration`, `negative_mark`, `created_by` (FK User.id) | Exam metadata. Linked to batches via ExamBatch table. |
| **ExamBatch**     | `exam_id` (FK), `batch_id` (FK)                                     | Many-to-many linking exams to batches.           |
| **Question**      | `id` (PK), `exam_id` (FK), `text`, `type` (e.g. mcq/short), `points`| Questions linked to an exam.                    |
| **Choice**        | `id` (PK), `question_id` (FK), `text`, `is_correct`                | MCQ options. `is_correct` flags the right answer. |
| **ExamAttempt**   | `id` (PK), `exam_id` (FK), `user_id` (FK), `start_time`, `end_time`, `score`, `status` | One per student per exam attempt.               |
| **ExamAnswer**    | `id` (PK), `attempt_id` (FK), `question_id` (FK), `chosen_option_id` (FK Choice.id, nullable), `answer_text`, `marked_review` (bool) | Student’s answers in an attempt. |

```mermaid
erDiagram
    USER {
        int id PK
        string name
        string email
        string password_hash
        enum role
    }
    BATCH {
        int id PK
        string name
        string description
    }
    BATCH_MEMBERSHIP {
        int user_id FK
        int batch_id FK
    }
    ASSIGNMENT {
        int id PK
        string title
        string description
        datetime due_date
        datetime created_at
        int batch_id FK
    }
    ASSIGNMENT_SUBMISSION {
        int id PK
        int assignment_id FK
        int user_id FK
        string file_url
        datetime submitted_at
        string status
        int score
    }
    EXAM {
        int id PK
        string title
        string description
        datetime start_time
        datetime end_time
        int duration
        int negative_mark
        int created_by FK
    }
    EXAM_BATCH {
        int exam_id FK
        int batch_id FK
    }
    QUESTION {
        int id PK
        int exam_id FK
        string text
        string type
        int points
    }
    CHOICE {
        int id PK
        int question_id FK
        string text
        bool is_correct
    }
    EXAM_ATTEMPT {
        int id PK
        int exam_id FK
        int user_id FK
        datetime start_time
        datetime end_time
        int score
        string status
    }
    EXAM_ANSWER {
        int id PK
        int attempt_id FK
        int question_id FK
        int chosen_option_id FK
        string answer_text
        bool marked_review
    }
    %% Relationships
    USER }|..|| BATCH_MEMBERSHIP : belongs_to
    BATCH }|..|| BATCH_MEMBERSHIP : has_member
    BATCH ||--|{ ASSIGNMENT : assigns
    USER ||--|{ ASSIGNMENT_SUBMISSION : submits
    ASSIGNMENT ||--|{ ASSIGNMENT_SUBMISSION : has
    EXAM ||--o{ EXAM_BATCH : targets
    BATCH ||--o{ EXAM_BATCH : contains
    EXAM ||--|{ QUESTION : contains
    QUESTION ||--|{ CHOICE : offers
    EXAM ||--|{ EXAM_ATTEMPT : attempts
    USER ||--|{ EXAM_ATTEMPT : takes
    EXAM_ATTEMPT ||--|{ EXAM_ANSWER : has_answer
    QUESTION ||--|{ EXAM_ANSWER : answered_in
```

## Tech Stack Recommendations  
- **Frontend**: **Next.js** (React framework) with **TypeScript** for safety. Next.js allows both server-side and client-side logic, with built-in support for API routes. Use **Tailwind CSS** for styling – a utility-first framework that enables rapid UI development. This combination fits well with responsive, component-driven UI.  
- **Backend/API**: Next.js API routes (or App Router handlers) serve as the backend endpoints. These run on Node.js. We will use **Prisma ORM** connected to **PostgreSQL** (via Supabase or a managed DB) for data access. Prisma provides type-safe database schemas and migrations. Authentication can use **NextAuth.js** (or Auth.js) for standardized secure auth in Next.js.  
- **Database**: **PostgreSQL** is recommended, especially with Supabase which adds easy Auth/Storage and RLS support. Supabase is essentially PostgreSQL with extra features (real-time, storage). RLS (Row-Level Security) in Postgres ensures users only see rows they own. All sensitive data (passwords, answers) go into Postgres tables as designed above.  
- **File Storage**: Use a secure cloud storage bucket (AWS S3, Supabase Storage, or similar). It should support direct browser upload and server-side access controls. Files are stored outside the database, with references (URLs/keys) in the DB. Ensure at-rest encryption. The application will sign upload/download URLs and validate file metadata.  
- **Auth & Sessions**: Either use **NextAuth.js** (renamed Auth.js) for email/password auth, or custom JWTs. NextAuth is convenient: it handles email sign-ins, password resets, session cookies (with CSRF protection) out-of-the-box. It integrates with PostgreSQL or Supabase for user data.  
- **State Management/Fetch**: For frontend data fetching, Next.js data fetching (getServerSideProps or use of SWR/React Query) can be used. Offline/autosave could use **IndexedDB/Service Workers** or just local storage with synchronization.  
- **Notifications/Emails**: Use an external service (e.g., SendGrid) triggered via serverless function or backend logic. Not provided by core stack.  
- **Testing Tools**: Jest + React Testing Library for unit/component tests, and Cypress or Playwright for E2E tests.

## Security Measures  
- **Row-Level Security (RLS)**: Enable RLS on all exposed tables. Each table’s RLS policies ensure that only the owner (or an authorized role) can access rows. For example, a policy like `USING (auth.uid() = user_id)` restricts rows to the logged-in user. Use Supabase Auth’s `auth.uid()` function in policies for ease. Remember to *revoke default grants* on `anon` and `authenticated` roles, then add explicit policies.  
- **Server-Side Authorization**: On each API route, verify `req.user` (or session) and role. Never trust client-sent data to check permissions. For example, a trainer’s ID in a payload cannot be used; always use the server’s session user.  
- **Password Hashing**: Use bcrypt or Argon2 to hash passwords before storing. Use a strong work factor. Compare hashed values on login.  
- **CSRF**: Use built-in CSRF protection on forms/API calls (NextAuth has this for signin/outs). Always send state-changing requests (POST/PUT/DELETE) via POST with CSRF token or SameSite cookies.  
- **Input Validation**: Sanitize and validate all input on the server. Use parameterized queries (Prisma does this automatically) to prevent SQL injection. For any file uploads, strictly check file MIME types and sizes.  
- **File Upload Security**: Aside from encryption and HTTPS, scan uploads for viruses (e.g. ClamAV) if possible. Store uploads in non-web-accessible storage, delivering via signed URLs.  
- **HTTPS Only**: Enforce HTTPS (e.g. via Cloudflare or hosting config) to protect cookies and data-in-transit. Set secure flags on cookies.  
- **Content Security Policy (CSP)**: Define a strict CSP header to prevent XSS, especially since we allow file uploads.  
- **Session Security**: Set cookies as HttpOnly and SameSite. Use short-lived JWTs or rotate session secrets regularly.  
- **Rate Limiting/Brute-Force Protection**: On login endpoints, apply rate-limiting or captchas to prevent password-guessing.  
- **RLS Example (Pseudocode)**:  
  ```sql
  -- Ensure only batch-assigned exams are visible:
  CREATE POLICY exam_batch_policy ON exams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM exam_batches
    WHERE exam_batches.exam_id = exams.id
      AND exam_batches.batch_id IN (
        SELECT batch_id FROM batch_memberships WHERE user_id = auth.uid()
      )
  ));
  ```  
- **Defense in Depth**: As Supabase docs note, RLS protects even if someone bypasses the app layer: “Because RLS is a Postgres primitive, it also protects your data when it is reached through third-party tooling, which is what makes it *defense in depth*.”. Combine RLS with authenticated roles for end-to-end security.

## Reliability & Resilience  
- **Autosave & Recovery**: As mentioned, implement client-side autosave at short intervals. If the browser/tab crashes or network drops, the student can reload the page and resume (the client checks local storage or server-saved state to reconstruct answers).  
- **Offline Handling**: For intermittent connectivity, the UI can use local storage or IndexedDB to cache answers. Use the Service Worker `sync` API to retry submissions. At minimum, warn students when offline and periodically attempt to reconnect.  
- **Session Timeout**: If a student’s session expires mid-exam, allow them a grace period (e.g. 5 minutes) to reauthenticate without losing the exam. This can be done by extending the session cookie or providing a reauth token.  
- **Data Backup**: Regularly back up the database and file storage. Use cloud backup routines.  
- **Testing**: Write automated tests: unit tests for core logic (grading, policy checks), component tests for critical UI, and E2E tests simulating user flows (e.g. signup, taking an exam).  
- **Monitoring**: Instrument the server to log errors and use an APM (e.g. Sentry) to catch issues.  
- **Offline Data Persistence**: Optionally make the app a Progressive Web App (PWA) so that students could load an exam page on flaky networks. The Service Worker can cache the exam shell, enabling note-taking and caching of answers.  

## UI/UX  
- **Responsive Design**: Layouts should adapt to mobile and desktop. Use Tailwind’s responsive classes to build mobile-first components. The exam UI in particular should be usable on tablets/laptops (portrait vs landscape orientation).  
- **Claymorphism Dashboard**: Follow *claymorphism* style for dashboards (soft, pastel, inflated UI). This means: large border-radius cards/buttons, dual soft shadows, pastel backgrounds. For example, use gentle purple or mint cards with an inner glow and outer drop shadow to make elements look like clay blobs. Rounded sans-serif fonts (Nunito, Quicksand) enhance the friendly look.  
- **Assignment UI**: Show a list of assignments with status badges (Pending, Submitted, Graded). A calendar view could highlight upcoming deadlines. Clicking an assignment shows details and submission form.  
- **Exam UI (Testbook-like)**: Mimic modern exam interfaces (e.g. Testbook):  
  - A sidebar or bottom question palette with numbered circles (each colored by status). Hover or tap to preview question status.  
  - The main panel shows the question text and options/inputs. “Mark for Review”, “Clear Answer”, “Save & Next” buttons are prominently placed.  
  - Timer always visible at top. Use a fixed header with remaining time (in minutes:seconds) that counts down.  
  - Full-screen mode on desktop (with a “Go Fullscreen” button).  
  - After submit, a modal overlays confirming submission with stats.  
- **Example Interactions**:  
  - **Mark-for-Review**: Clicking this toggles a flag icon and changes the palette color.  
  - **Clear Response**: Unchecks any selection for current question.  
  - **Save & Next**: Saves current answer (autosave does too) and moves forward.  
  - **Full-Screen**: Request browser fullscreen and add a warning if the user tries to exit (e.g. “Your exam will pause if you leave full-screen”).  
  - **Pause (optional)**: If implemented, a “Pause” button halts timer and greys out UI; clicking again resumes.  
  - **Accessibility**: Ensure high contrast text, keyboard navigation, and screen-reader labels (aria) especially for exam questions.  

```mermaid
flowchart TD
    subgraph Submission_and_Grading
      A[Student confirms submission]
      B{Check if submission valid/time exceeded}
      C[Perform Auto-Grading (MCQs)]
      D[Queue Manual Grading (if needed)]
      E[Calculate Final Score]
      F[Update ExamAttempt record: status=Completed, save score]
      G[Notify student of results]
    end
    A --> B
    B -->|Valid| C
    B -->|Late| C
    C --> D
    C --> E
    D --> E
    E --> F
    F --> G
```

## Testing & Acceptance Criteria  
- **Acceptance Tests**: Prepare both manual and automated checks. Key scenarios include:  
  - **Auth Tests**: Student can only see their dashboard; Trainer can create batches. Unauthorized API calls are rejected.  
  - **Batch/Assignment**: Creating a batch, adding students, assigning an assignment to that batch; verify only those students see it. Check late submission behavior.  
  - **Exam Flow**: Student starts exam, navigates questions (mark/unmark), autosave triggers (verify by network logs or DB). Student exits full-screen – ensure a warning/pause triggers.  
  - **Timer**: Simulate clock skew: if client machine time is changed, ensure server-controlled timer still ends exam at correct time. (Can test by mocking server timestamps.)  
  - **Submission**: After submit, verify that answers are locked (cannot change) and score is calculated correctly (including negative marks). For MCQs, set up a known pattern of correct/wrong and check score.  
  - **Security**: Try SQL injection or unauthorized data access (should fail). Also test direct URL manipulation (student accessing another student’s exam attempt ID).  
  - **Resilience**: Simulate losing network during exam, then reconnect: answers should not be lost (test caching).  
  - **UI Tests**: On different device widths (mobile/tablet/desktop), the UI should scale and elements remain legible.  
  - **Edge Cases**: No attempts (test 0 questions exam), maximum file upload size, invalid file types, repeated fast clicking of submit (should only accept first).  
- **Automated Tests**:  
  - **Unit Tests** (Jest): Test grading logic (e.g. grading function returns correct score given various answer combinations), assignment due date logic, RLS policy SQL if possible.  
  - **Component Tests** (React Testing Library): Render key components (Login form, Assignment list, Question component) and assert correct behavior on interactions (e.g., clicking “Clear” clears selection).  
  - **E2E Tests** (Cypress/Playwright): Automate a full workflow: Admin logs in, creates batch, signup students, assigns exam, student logs in and completes exam, verify score on result page. Use fixtures for data.  
  - **Regression Tests**: After key changes (e.g., altering schema), run critical path flows automatically.  

As Next.js documentation notes, cover unit/component tests as well as E2E. Tools like Jest, React Testing Library, and Cypress are commonly recommended.

## Deployment & Dev Workflow  
- **Local-Only Development**: Emphasize no remote repository push. Code lives on local or private network. Use `.gitignore` to exclude sensitive files; maintain an `.env.example` with placeholders (DATABASE_URL, NEXTAUTH_SECRET, etc.).  
- **Environment Setup**: In the README, include steps: install Node 18+, `npm install`, configure `.env`, run database (e.g. Docker-Compose with Postgres), then `npx prisma migrate dev`, `npm run dev`. Document database seed commands if any.  
- **Database Migrations**: Use Prisma Migrate for schema changes. Encourage small incremental migrations. Keep `prisma/schema.prisma` and migration history under version control (locally).  
- **Secrets Management**: Do not hardcode secrets. Use `.env` file for dev, and document env variables.  
- **.env.example**: Provide sample keys:  
  ```
  DATABASE_URL=postgres://user:pass@localhost:5432/mydb
  NEXTAUTH_SECRET=some-long-random-string
  EMAIL_SERVER=smtp://user:pass@smtp.mailtrap.io:2525
  ```
- **Scripts**: Include `npm run dev`, `npm run build`, `npm run start`, `npm run migrate`, `npm run test`.  
- **Monitoring**: Even in local/dev, consider logs. For production, one would push to a server, but assumption is local only, so skip CI/CD.  
- **Backups**: If using local Postgres, script daily `pg_dump`. For file storage, have a backup job.  
- **No GitHub Push**: Clearly instruct not to set up any remote repo. Use local versioning (e.g. local git repo without remote). The README should specifically say **“Ensure code remains local; do not push to GitHub or any public repo.”** to comply with the mandate.  

## Implementation Plan (Phased with Estimates)  

1. **Phase 1 – Core Framework & Auth (20h)**: Set up Next.js + TypeScript, configure NextAuth with email/password (or custom) auth, and Postgres/Prisma schema for Users & Sessions. Implement user signup/login, password reset, and first-login password change. Create basic UI scaffolding (Login, Dashboard layout).  
2. **Phase 2 – Batch & Roles (16h)**: Implement User roles (Admin vs Student) and batch management: tables `batches`, `batch_memberships`, and UI to create/edit batches and assign students. Enforce RLS policies for user/batch scope.  
3. **Phase 3 – Assignment Module (24h)**: Build assignment CRUD: schema, UI for teacher to create, student to list/submit. Implement file upload to cloud storage with restrictions. Add submission listing and grading UI for trainer. Notifications via email (if needed).  
4. **Phase 4 – Question Bank & Exam Builder (24h)**: Schema for questions/choices/exams. UI for trainer to create questions and assemble an exam with settings (time, negative marks). RLS to restrict exams to appropriate batches.  
5. **Phase 5 – Exam Taking UI & Timer (30h)**: Develop the exam-taking interface: preload questions, implement full-screen mode, timer sync (fetch server time), autosave. Sidebar palette, mark-review, navigation. Use claymorphic styles for buttons/cards.  
6. **Phase 6 – Grading Engine & Reporting (20h)**: Implement grading logic on server (MCQs auto, manual for others). UI to grade short answers if applicable. Show results to students post-exam.  
7. **Phase 7 – Reliability & Offline (20h)**: Add autosave recovery, local storage fallback, reconnect logic. Create E2E tests (Cypress/Playwright) for all flows.  
8. **Phase 8 – Testing & Hardening (16h)**: Write unit/component tests (Jest, RTL). Perform security reviews: ensure all RLS policies, CSRF. Pen-test for auth.  
9. **Phase 9 – UI Polish & UX (20h)**: Refine UI with Tailwind, claymorphism elements (Shadows, pastel theme). Mobile responsiveness. Add animations (e.g. button squash on click).  
10. **Phase 10 – Deployment Prep (8h)**: Document setup (README, env), finalize migrations, backups, and .env handling. Beta test internally. 

*Effort totals ~178 hours (roughly 9 person-weeks), allocated by priority (Auth→Batch→Assignment→Exam core→UI/UX→Testing).*

## API Endpoints  
Below is a summary table of key RESTful endpoints. All require authentication; Trainer/Admin role is noted where necessary.

| Method | Path                         | Purpose                                       | Auth Required       |
|--------|------------------------------|-----------------------------------------------|---------------------|
| POST   | `/api/auth/signup`           | Create new user (Admin only or open?)         | None (public)       |
| POST   | `/api/auth/login`            | User login (NextAuth/session)                 | None                |
| POST   | `/api/auth/forgot-password`  | Request password reset email                  | None                |
| GET    | `/api/users/me`              | Get current user profile                      | Any logged-in user  |
| PUT    | `/api/users/me/password`     | Change password (old + new)                   | Any logged-in user  |
| **Batches** |  |  |  |
| GET    | `/api/batches`              | List all batches (Admin)                      | Admin/Trainer       |
| POST   | `/api/batches`              | Create batch                                  | Admin               |
| PUT    | `/api/batches/{id}`         | Update batch                                  | Admin               |
| DELETE | `/api/batches/{id}`         | Delete batch                                  | Admin               |
| POST   | `/api/batches/{id}/users`   | Add users to batch (body: user IDs)           | Admin               |
| DELETE | `/api/batches/{id}/users`   | Remove users from batch                       | Admin               |
| **Assignments** |  |  |  |
| GET    | `/api/assignments`         | List assignments (for Admin: all; for Student: theirs/batch) | Auth  |
| POST   | `/api/assignments`         | Create new assignment (specify batch_id)       | Trainer             |
| PUT    | `/api/assignments/{id}`    | Update (before due)                            | Trainer             |
| GET    | `/api/assignments/{id}`    | Get assignment details                         | Auth (owner only)   |
| POST   | `/api/assignments/{id}/submit` | Student submits file (multipart upload)    | Student             |
| GET    | `/api/assignments/{id}/submissions` | List submissions (Trainer view)       | Trainer             |
| PUT    | `/api/assignments/{id}/grade` | Submit grades for assignment             | Trainer             |
| **Exams** |  |  |  |
| GET    | `/api/exams`               | List exams (filtered by user role/batch)       | Auth                |
| POST   | `/api/exams`               | Create exam (specify questions, batches, settings) | Trainer         |
| PUT    | `/api/exams/{id}`          | Update exam details (before start)            | Trainer             |
| GET    | `/api/exams/{id}`          | Get exam info (for student: see instructions or if open) | Auth     |
| POST   | `/api/exams/{id}/start`    | Initialize attempt (records start_time)        | Student (eligible)  |
| POST   | `/api/exams/autosave`      | Autosave answers (payload with attemptId)      | Student             |
| POST   | `/api/exams/{attemptId}/submit` | Final submission of exam                | Student             |
| GET    | `/api/exams/attempts/{id}` | Get attempt results/answers                    | Student (own)       |
| **Questions** |  |  |  |
| POST   | `/api/questions`           | Create a question (trainer)                    | Trainer             |
| PUT    | `/api/questions/{id}`      | Update question                                | Trainer             |
| DELETE | `/api/questions/{id}`      | Delete question                                | Trainer             |
| GET    | `/api/questions`           | List question bank (trainer view)              | Trainer             |
| **Misc/Utility** |  |  |  |
| GET    | `/api/notifications`       | List user notifications                        | Auth                |
| POST   | `/api/upload`              | Generic file upload (returns URL)              | Auth                |

Each endpoint should check role and ownership in middleware. For example, `/api/exams/{id}/start` verifies the student belongs to one of the exam’s batches.

## UI Wireframes & Key Interactions  
Below is a high-level list of UI screens and behaviors. Detailed wireframes would be needed in practice, but we outline core pages:

1. **Login / Signup**: Email/password form; “forgot password” link. After login, redirect to appropriate dashboard.  
2. **Admin Dashboard**: Clay-style cards showing stats (Total Students, Pending Assignments, Upcoming Exams). Navigation menu: Batches, Assignments, Exams, Reports, Settings. Cards have soft shadows and pastel backgrounds.  
3. **Batch Management**: List of batches. Each batch entry has edit/delete buttons. “Add Batch” button opens modal with name/desc. A batch detail page shows member list and an “Add Students” button. Implement a claymorphism form (rounded fields, soft button).  
4. **User/Student List**: Page to view/add students (admin). Could be a modal listing users to add to batch. Use table with filters.  
5. **Assignment List**: Two views:
   - *Trainer view*: Table of assignments, filter by batch, buttons for Create, Edit, Grade.  
   - *Student view*: Cards or list of assignments (with status: pending, submitted, graded). Deadline countdown for each. Clay cards or Material-like chips.  
6. **Create Assignment Form**: Fields for title, description (rich text), due date/time (datetime picker), batch selector. File type checklist. Submit button with clay style.  
7. **Assignment Detail/Submit** (Student): Show assignment info and “Upload File” control. After upload, show preview of file name and “Submit” button.  
8. **Assignment Grading** (Trainer): List of student submissions with uploaded file link. A modal or inline fields to enter score/comments. “Save” button.  
9. **Exam Creation**: Multi-step form or wizard: Step 1: exam meta (title, instructions, time, negative). Step 2: select target batches. Step 3: add questions (via linking existing questions or creating new). Use drag/drop ordering.  
10. **Question Bank UI**: List of questions, filter by type, search, tags. Each question card shows text and options (for quick review). Buttons for Edit/Delete. Option to mark as favorite for an exam.  
11. **Pre-Exam Instruction Page** (Student): Show exam title, description, start time, duration, instructions in a modal or dedicated page. Button “Start Exam”.  
12. **Exam Interface**: Core exam-taking screen:  
    - Top bar: Exam title, timer (mm:ss), “Pause” or “Go Fullscreen” button.  
    - Main panel: current question text and choices/inputs. “Previous” and “Next” buttons.  
    - Sidebar (or bottom bar on mobile): question palette with circles 1...N.  
    - Footer (mobile): Save/Next, Mark for Review, Clear.  
    This UI is inspired by Testbook; ensure colors indicate status. Use pastel color highlights. The question box can be a light-colored clay card.  
13. **Review & Submit**: After “Submit”, show a summary modal (how many answered vs unanswered). Confirm or cancel.  
14. **Results Page**: After grading, show student their score, correct answers (optional), and feedback. Use charts or tables to breakdown performance by section.  
15. **Notifications Panel**: Bell icon in navbar; dropdown list of recent notifications (e.g., “Assignment X graded”).  

The claymorphic style will be applied to cards and buttons across these screens for a consistent friendly look. Ensure responsive grids for mobile.

## Acceptance Test Checklist (Manual & Automated)  

- **Authentication & Roles**:  
  - [ ] Valid user signup/login flows; invalid credentials rejected.  
  - [ ] Student sees only their own assignments/exams; cannot access trainer endpoints.  
  - [ ] Trainer (admin) can create batches/users. Unauthenticated user cannot access protected endpoints.  
- **Batch Functionality**:  
  - [ ] Creating/editing a batch correctly updates DB.  
  - [ ] Adding/removing users to a batch restricts visibility of assignments/exams accordingly.  
  - [ ] Deleting a batch retains past data (no loss of assignment submissions).  
- **Assignment Module**:  
  - [ ] Trainer can create assignment and select allowed file types. Attempt to upload disallowed type should be blocked.  
  - [ ] Student sees assignment in dashboard when in relevant batch.  
  - [ ] File upload works over HTTPS; file appears in storage with encrypted URL.  
  - [ ] Submission timestamp is recorded; late submissions flagged.  
  - [ ] Trainer grading updates student’s view.  
- **Exam Engine**:  
  - [ ] Exam can be started only by eligible students and only once.  
  - [ ] Timer reflects server time and expires correctly. (Test by manipulating client clock.)  
  - [ ] Autosave sends data; if network disconnected, answers are recovered from local storage.  
  - [ ] “Mark for Review” toggles flag and color.  
  - [ ] Fullscreen mode triggers as expected; warning shown on exit.  
  - [ ] Submission modal shows correct counts (answered/unanswered).  
  - [ ] Submission locks the exam; further edits ignored.  
  - [ ] Scoring logic applies negative marking accurately. E.g. for an exam of 5 MCQ (1 pt each, -0.5 negative): all wrong -> score -2.5.  
  - [ ] Partial submission: early submit still calculates based on provided answers. Unanswered treated as zero.  
- **Security Checks**:  
  - [ ] RLS policies: verify that a student cannot query another student’s records (try API with different `auth.uid()`).  
  - [ ] CSRF token required on state-changing requests.  
  - [ ] Upload validation rejects executables or huge files.  
  - [ ] Passwords are hashed in DB.  
- **UI/UX**:  
  - [ ] Layout works on mobile and desktop (resize window). Buttons and text are legible.  
  - [ ] Clay UI elements render with correct shadows and colors (sanity check).  
  - [ ] Interactive elements (buttons, palette) have hover/focus states.  
- **Notifications**:  
  - [ ] (If implemented) Students receive an email or visible message when assignment is due soon or graded.  

### Sample Automated Test Case (Jest):
```javascript
test('grading function computes score with negative marking', () => {
  const questions = [
    {id:1, points:2}, {id:2, points:3}
  ];
  const answers = [
    {questionId:1, isCorrect:false},
    {questionId:2, isCorrect:true}
  ];
  const negativeMark = 1; // one wrong answer deducts 1
  const score = calculateScore(questions, answers, negativeMark);
  expect(score).toBe(3*1 + 0*2 - 1); // = 2
});
```

## Recommended Libraries & Tools  
- **NextAuth (Auth.js)**: For authentication flows, session management, CSRF, and secure cookies.  
- **Prisma ORM**: Type-safe database client with migration support. It pairs well with TypeScript and Postgres.  
- **Tailwind CSS**: As discussed, to implement claymorphism and responsive layouts rapidly. Its utility classes simplify adding shadows, colors, etc., needed for clay style.  
- **React Hook Form or Formik**: For handling form inputs (Assignments, Exams) with validation.  
- **React Query or SWR**: For data fetching with caching and revalidation (especially for periodic autosave/sync).  
- **Zod or Yup**: For schema validation of API request payloads on the server (avoid bad data).  
- **Cypress / Playwright**: For end-to-end tests of the exam flow and user journeys (Next.js docs specifically mention Cypress and Playwright).  
- **Jest + React Testing Library**: For unit/component tests of core logic (grading, policies) and UI components. Next.js official guides recommend Jest/RTL for unit tests.  
- **Next.js Router UI**: Possibly use a component library for claymorphism (though none are mainstream). Custom-tailwind should suffice.  
- **Supabase CLI/Studio** (if using Supabase): For managing RLS, functions, and storage easily.  

Each choice is made to streamline development: NextAuth for out-of-the-box security, Tailwind for theming, Prisma for safe DB access, and established test frameworks for reliability.

## Security Checklist & RLS Examples  
- [ ] **HTTPS everywhere** (production must enforce SSL).  
- [ ] **Passwords hashed** (bcrypt/Argon).  
- [ ] **CSRF protection** on all forms (NextAuth provides it).  
- [ ] **Input sanitization/validation** (especially exam answers and file names).  
- [ ] **Role checks** on each backend endpoint.  
- [ ] **RLS enabled on all tables** with policies: e.g. for `exams` table:
  ```sql
  ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
  CREATE POLICY exam_view ON exams
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM exam_batches WHERE exam_batches.exam_id = exams.id
          AND exam_batches.batch_id IN (
            SELECT batch_id FROM batch_memberships WHERE user_id = auth.uid()
          )
      )
    );
  ```  
- [ ] **RLS for submissions**: Only allow students to see their own submissions:
  ```sql
  CREATE POLICY submission_owner ON exam_attempts
    FOR SELECT, UPDATE
    USING (user_id = auth.uid());
  ```  
- [ ] **Encrypt sensitive data at rest** (DB encryption via cloud or file system).  
- [ ] **Review CORS**: Only allow known origins.  
- [ ] **Secure file permissions**: Public file links expire.  
- [ ] **Session timeouts**: Invalidate idle sessions after a limit.  
- [ ] **Logging**: Log auth failures and suspicious actions.  

## Grading Algorithm (Server-Side)  
Below is a pseudocode for computing exam scores, handling MCQs with negative marking and multi-select. It would run transactionally on submit:

```pseudo
function gradeExamAttempt(attemptId):
    answers = fetch answers for attemptId
    exam = fetch exam details (negative_mark)
    totalScore = 0
    for each answer in answers:
        question = fetch question by answer.questionId
        if question.type == "MCQ" or "multi": 
            // For single-choice MCQ:
            if answer.chosen_option_id is not null:
                option = fetch choice(answer.chosen_option_id)
                if option.is_correct:
                    totalScore += question.points
                else if exam.negative_mark:
                    totalScore -= exam.negative_mark
        else if question.type == "short":
            // To be graded manually
            continue 
    // Prevent negative total
    totalScore = max(totalScore, 0)
    save totalScore to exam_attempt.score
    set attempt.status = "Completed"
```

**Edge Cases:**  
- Unanswered: No chosen option → no change (score unchanged).  
- Multiple-select: If multiple correct options, require all correct to get points, or adjust logic to allow partial credit.  
- Negative Marking: Deduct per wrong answer. If total goes below 0, floor at 0.  
- Rounding: Use consistent rounding (e.g. to 2 decimals) if fractions involved.  
- Concurrent submissions: Use a DB transaction or `UPDATE ... WHERE status!='Completed'` to ensure one final submission.  
- Manual Questions: For non-automatic types (e.g. essay), set score blank and status “Pending Review” until trainer grades.  

## Local Setup Instructions (No GitHub)  
1. **Prereqs**: Install Node.js (v18+), Docker (for local Postgres).  
2. **Clone/Copy Code**: Copy the project folder to your local dev machine via USB or private network. Do *not* push to any public repo.  
3. **.env Setup**: Create a `.env` file from `.env.example`, filling in real credentials. Do not share this file.  
4. **Database**: Run `docker-compose up -d` with a provided `docker-compose.yml` that includes Postgres (listening on default port). Check it starts.  
5. **Install Dependencies**: `npm install`.  
6. **Prisma Migrations**: `npx prisma migrate dev --name init` to apply the schema.  
7. **Seed Data** (optional): Run `npm run seed` if a seed script is provided (it might create an admin user, sample batch, etc.).  
8. **Start Dev Server**: `npm run dev`. The app runs on http://localhost:3000.  
9. **Access Dashboard**: Visit `/signup` or login (seeded admin) and start using the app.  
10. **Running Tests**: `npm run test` for Jest. `npm run e2e` (if set) for Cypress tests.  
11. **Environment**: By default, everything is local. To keep it that way, do not configure any remote databases or push code to a remote Git. All state lives on your machine.  
12. **.env.example** should contain placeholders for (at least): `DATABASE_URL`, `NEXTAUTH_SECRET`, `EMAIL_SERVER`, and any storage keys (e.g. `STORAGE_URL`, `STORAGE_KEY`) with dummy values.  

_Remember: The codebase should remain on your machine. Treat it as private IP-based deployment rather than a public code repo. Collaboration can be done by sharing zip or internal network drives, not via Git._

## Prioritized Risks & Mitigations  
- **Security Breach**: *Risk*: Student data or exam content leaks. *Mitigation*: Strict RLS policies, HTTPS everywhere, strong auth, regular audits. Use OWASP guidelines.  
- **Data Loss (Exam Answers)**: *Risk*: Lost answers if client crashes. *Mitigation*: Robust autosave + local cache. Frequent server sync. Provide a warning if connection lost.  
- **High Load (Exam Peak)**: *Risk*: Performance degradation if many students start an exam simultaneously (e.g. 1000 students). *Mitigation*: Use efficient queries, indexes on attempt tables. Possibly use DB connection pooling and horizontal scaling (increase Node instances). Offload static file delivery to CDN.  
- **Exam Timer Tampering**: *Risk*: Client clock changes. *Mitigation*: Server authoritative timer (discussed). The client’s JS only displays; server enforces end-time.  
- **Cheating Attempts**: *Risk*: Students trying to open other tabs. *Mitigation*: Fullscreen lock, discourage switching (but cannot fully prevent). Design exam questions to be challenging (not fully curb production exam cheating). Logging suspicious events.  
- **Incorrect Grading Logic**: *Risk*: Bugs in scoring can miscalculate results. *Mitigation*: Thorough unit tests for grading. Manual spot-checks. Allow for regrading if errors found.  
- **File Storage Compromise**: *Risk*: Exposed attachments. *Mitigation*: Use signed, time-limited URLs for file access. Do not store files in publicly writable buckets. Scan for malware.  
- **Dependency Vulnerabilities**: *Risk*: Outdated libs. *Mitigation*: Keep npm packages updated, use `npm audit`.  
- **Incomplete Requirements**: *Risk*: Missing features (e.g. no email server). *Mitigation*: Note assumptions (e.g. optional email via SMTP). Begin with MVP and iterate based on feedback.  

By adhering to this comprehensive plan—grounded in best practices and primary documentation—we can build a secure, reliable, and user-friendly Trainer-Student platform without shortcuts. The phased approach and thorough testing ensure quality, and strict guidelines (e.g. “no GitHub”) are maintained. All key points are documented above with traceable references for further reading.