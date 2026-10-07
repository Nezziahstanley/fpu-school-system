-- ============================================================
-- FPU — Add country and lga to applications
-- ============================================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS country VARCHAR(60) DEFAULT 'Nigeria';

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS lga VARCHAR(120);

-- Index for filtering by LGA/state
CREATE INDEX IF NOT EXISTS idx_applications_state ON applications (state_of_origin);
CREATE INDEX IF NOT EXISTS idx_applications_lga ON applications (lga);