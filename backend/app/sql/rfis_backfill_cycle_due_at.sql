-- 004 batched hole-fill. Restart continues. Never add intervals onto due_at.

UPDATE rfis
SET cycle_due_at = due_at
WHERE id IN (
  SELECT id FROM rfis
  WHERE cycle_due_at IS NULL
    AND due_at IS NOT NULL
  LIMIT 1000
);
