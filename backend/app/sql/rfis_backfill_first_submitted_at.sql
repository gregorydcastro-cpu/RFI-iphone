-- 003 hole-fill. Twice updates zero rows. Never now(). Never overwrite.

UPDATE rfis
SET first_submitted_at = submitted_at
WHERE first_submitted_at IS NULL
  AND submitted_at IS NOT NULL;
