-- Hole-fill only. Copy into a missing column. Never add onto a live value.
-- Columns are added in 002. These UPDATEs are 003 / 004.
-- Never assign first_submitted_at from the database clock. Never renumber.

UPDATE rfis
SET first_submitted_at = submitted_at
WHERE first_submitted_at IS NULL
  AND submitted_at IS NOT NULL;

UPDATE rfis
SET cycle_due_at = due_at
WHERE id IN (
  SELECT id FROM rfis
  WHERE cycle_due_at IS NULL
    AND due_at IS NOT NULL
  LIMIT 1000
);
