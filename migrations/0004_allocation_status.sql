DROP TYPE IF EXISTS allocation_status CASCADE;
CREATE TYPE allocation_status AS ENUM ('assigned', 'accepted', 'flagged', 'cancelled');

ALTER TABLE course_allocations ADD COLUMN IF NOT EXISTS status allocation_status NOT NULL DEFAULT 'assigned';
ALTER TABLE course_allocations ADD COLUMN IF NOT EXISTS assigned_by integer;
ALTER TABLE course_allocations ADD COLUMN IF NOT EXISTS flag_reason varchar(80);
ALTER TABLE course_allocations ADD COLUMN IF NOT EXISTS flag_note text;
ALTER TABLE course_allocations ADD COLUMN IF NOT EXISTS responded_at timestamptz;

UPDATE course_allocations SET status = 'accepted', responded_at = created_at WHERE status = 'assigned';

CREATE INDEX IF NOT EXISTS idx_allocations_status ON course_allocations(status);
