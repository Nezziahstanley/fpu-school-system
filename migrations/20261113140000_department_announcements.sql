-- Announcements use a VARCHAR audience column in the initial schema.
-- Add department ownership so HOD notices can be scoped to one department.
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS department_id integer
  REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_department
  ON announcements(department_id);
