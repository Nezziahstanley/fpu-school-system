-- ============================================================
-- FPU — Migration 0003
-- Add courses.year_of_study (integer, 1 or 2)
-- ------------------------------------------------------------
-- Backfill rule:
--   ND 100 → 1   ND 200 → 2
--   HND 300 → 1  HND 400 → 2
-- Derived from the first digit of the trailing number in the
-- course code (e.g. "COM 111" → 1, "SWD 421" → 4 → HND year 2).
--
-- Idempotent — safe to re-run.
-- ============================================================

BEGIN;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS year_of_study integer;

COMMENT ON COLUMN courses.year_of_study IS
  'Year within level: 1 or 2. ND1=1, ND2=2, HND1=1, HND2=2.';

-- Backfill from the code suffix. Only rows still NULL are touched.
UPDATE courses
SET year_of_study = CASE
  WHEN code ~ '\s[12]\d{2}$' THEN
    CASE substring(code from '\s(\d)\d{2}$')
      WHEN '1' THEN 1
      WHEN '2' THEN 2
      ELSE 1
    END
  WHEN code ~ '\s[34]\d{2}$' THEN
    CASE substring(code from '\s(\d)\d{2}$')
      WHEN '3' THEN 1
      WHEN '4' THEN 2
      ELSE 1
    END
  ELSE 1
END
WHERE year_of_study IS NULL;

-- Tighten
ALTER TABLE courses
  ALTER COLUMN year_of_study SET DEFAULT 1;

ALTER TABLE courses
  ALTER COLUMN year_of_study SET NOT NULL;

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_year_of_study_range_chk;

ALTER TABLE courses
  ADD CONSTRAINT courses_year_of_study_range_chk
  CHECK (year_of_study IN (1, 2));

CREATE INDEX IF NOT EXISTS courses_year_of_study_idx
  ON courses (year_of_study);

COMMIT;