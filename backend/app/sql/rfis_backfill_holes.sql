-- Fill-holes only. Copy into a missing column. Never add onto a live value.
-- Never assign first_submitted_at from now(). Never renumber.

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS first_submitted_at timestamp;

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS cycle_due_at timestamp;

-- Sticky original PE submit clock. submitted_at may move later.
UPDATE rfis
SET first_submitted_at = submitted_at
WHERE first_submitted_at IS NULL
  AND submitted_at IS NOT NULL;

-- Current cycle clock. due_at is the source for the first fill only.
-- Batch 1000. Safe to run again: remaining NULLs only.
-- due_at IS NOT NULL is the source-present guard (same as submitted_at):
-- no source means leave the hole. Without it a NULL=NULL batch never drains.
UPDATE rfis
SET cycle_due_at = due_at
WHERE id IN (
  SELECT id FROM rfis
  WHERE cycle_due_at IS NULL
    AND due_at IS NOT NULL
  LIMIT 1000
);
