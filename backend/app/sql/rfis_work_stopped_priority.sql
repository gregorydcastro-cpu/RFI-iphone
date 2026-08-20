-- 001 expand only. Retry: IF NOT EXISTS / check constraint name before ADD.
-- Leave the pair CHECK not valid. Do not DROP. Runner stamps once.

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS work_stopped boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS rfis_project_status_idx
  ON rfis (project_id, status);

-- If VALIDATE died later, this name already exists. Runner must not ADD again.
ALTER TABLE rfis
  ADD CONSTRAINT rfis_work_stopped_priority_chk
  CHECK (
    (work_stopped AND priority = 'work_stopped')
    OR (NOT work_stopped AND priority IS DISTINCT FROM 'work_stopped')
  ) NOT VALID;
