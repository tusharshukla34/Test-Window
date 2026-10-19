# Strict User Rule: Never Delete or Overwrite Existing Data

1. **CRITICAL REQUIREMENT**:
   - **STRICTLY DO NOT DELETE** any existing student, batch, assignment, or exam.
   - All student profiles, batches, assignments, exams, and attempt responses must be preserved at all times.

2. **PROHIBITED ACTIONS**:
   - NEVER execute destructive SQL statements (`DROP TABLE`, `DELETE FROM profiles`, `DELETE FROM batches`, `DELETE FROM exams`, `DELETE FROM assignments`, etc.).
   - NEVER overwrite or upload a local SQLite database file to cloud storage (Supabase / Google Drive) without explicit user confirmation, as this can wipe out records created on production.
   - Schema modifications must ALWAYS be non-destructive (`ALTER TABLE ADD COLUMN` or additive migrations only).
