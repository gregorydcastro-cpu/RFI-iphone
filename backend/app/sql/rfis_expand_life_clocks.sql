-- 002 expand only. ADD COLUMN is retry-safe. Backfill is a later revision.

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS first_submitted_at timestamp;

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS cycle_due_at timestamp;
