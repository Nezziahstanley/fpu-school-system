-- Weekly teaching plan topics scoped to a lecturer's course allocation.
CREATE TABLE IF NOT EXISTS course_teaching_topics (
  id SERIAL PRIMARY KEY,
  lecturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  semester semester NOT NULL,
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 52),
  topic VARCHAR(200) NOT NULL,
  learning_outcomes TEXT,
  teaching_method VARCHAR(120),
  planned_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','completed','deferred')),
  covered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_lecturer_course_week_plan UNIQUE (lecturer_id,course_id,session_id,semester,week_number)
);
CREATE INDEX IF NOT EXISTS idx_teaching_topics_allocation
  ON course_teaching_topics (lecturer_id,course_id,session_id,semester);
