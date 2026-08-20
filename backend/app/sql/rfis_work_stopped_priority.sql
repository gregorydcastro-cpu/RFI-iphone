-- rfis work_stopped ↔ priority biconditional. NOT VALID: do not scan existing rows.
-- Do not VALIDATE in this pass. Only set_priority writes the pair.

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS work_stopped boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS rfis_project_status_idx
  ON rfis (project_id, status);

ALTER TABLE rfis
  ADD CONSTRAINT rfis_work_stopped_priority_chk
  CHECK (
    (work_stopped AND priority = 'work_stopped')
    OR (NOT work_stopped AND priority IS DISTINCT FROM 'work_stopped')
  ) NOT VALID;
