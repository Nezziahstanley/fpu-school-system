-- Allow HODs to publish notices only to users in their own department.
ALTER TYPE announcement_audience ADD VALUE IF NOT EXISTS 'department';

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS department_id integer
  REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_department
  ON announcements(department_id);
