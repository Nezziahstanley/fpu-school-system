-- ============================================================
-- Migration: 0004 allocation_status
-- Adds acceptance workflow to course_allocations
-- ============================================================

DO $$ BEGIN
  CREATE TYPE allocation_status AS ENUM ('assigned', 'accepted', 'flagged', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE course_allocations
  ADD COLUMN IF NOT EXISTS status allocation_status NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS assigned_by integer,
  ADD COLUMN IF NOT EXISTS flag_reason varchar(80),
  ADD COLUMN IF NOT EXISTS flag_note text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- Backfill: existing rows are treated as already accepted
UPDATE course_allocations
   SET status = 'accepted', responded_at = created_at
 WHERE status = 'assigned';

CREATE INDEX IF NOT EXISTS idx_allocations_status ON course_allocations(status);
