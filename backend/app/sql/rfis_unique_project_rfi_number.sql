-- 005 invariant: rfi_number assigned only on first submit.
-- Multiple drafts (NULL) are allowed. Do not invent numbers here.

CREATE UNIQUE INDEX IF NOT EXISTS uq_rfis_project_rfi_number
  ON rfis (project_id, rfi_number)
  WHERE rfi_number IS NOT NULL;
