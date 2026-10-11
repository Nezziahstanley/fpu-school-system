-- ============================================================
-- FPU — Migration 0004
-- Admission workflow:
--   * matriculated status
--   * document verification tracking
--   * letter send tracking
--   * matriculation fields
--   * internal notes
-- ============================================================

-- 1. Extend application status enum (non-destructive)
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'matriculated' AFTER 'registered';

-- 2. Document verification tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS documents_verified_at timestamptz;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS documents_verified_by integer;

-- 3. Letter send tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS letter1_sent_at timestamptz;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS letter2_sent_at timestamptz;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS letter3_sent_at timestamptz;

-- 4. Matriculation
ALTER TABLE applications ADD COLUMN IF NOT EXISTS matric_number varchar(40);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS matriculated_at timestamptz;

-- 5. Internal notes
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes text;

-- Done.