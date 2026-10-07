-- ============================================================
-- FPU School Management System — Initial schema
-- PostgreSQL 16
-- Generated from db/schema.js, plus the raw partial unique
-- index that Drizzle can't express.
--
-- v2 — includes fixes for:
--   * courses.semester_name (was "semester")
--   * courses.is_active
--   * courses unique index now keys on (code, programme_id, level, semester_name)
--   * programmes unique index is (code) only
--   * settings PK is (key)
--   * grade_scales.points is NUMERIC(4,2)
--   * timetable_slots / exam_schedules times are TIME
-- ============================================================

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'student','lecturer','hod','bursar','rector','registrar',
    'librarian','exam_officer','academic_officer','admission_officer','admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE level AS ENUM ('ND','HND','CERT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE semester AS ENUM ('first','second');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE result_status AS ENUM (
    'draft','submitted','hod_verified','approved','published','hod_rejected','admin_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending','verified','rejected','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'pending','under_review','approved','rejected','registered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE registration_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clearance_status AS ENUM ('pending','cleared','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending','approved','rejected','issued');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE borrow_status AS ENUM ('borrowed','returned','overdue','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('pending','ready','fulfilled','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE graduation_status AS ENUM ('pending','approved','rejected','graduated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('open','in_review','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1. users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  user_role NOT NULL DEFAULT 'student',
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  middle_name           VARCHAR(100),
  phone                 VARCHAR(30),
  gender                VARCHAR(10),
  date_of_birth         DATE,
  address               TEXT,
  state_of_origin       VARCHAR(60),
  nationality           VARCHAR(60) DEFAULT 'Nigerian',
  photo_url             TEXT,
  matric_number         VARCHAR(40),
  level                 level,
  programme_id          INTEGER,
  department_id         INTEGER,
  school_id             INTEGER,
  current_session_id    INTEGER,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_matric ON users(matric_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_programme ON users(programme_id);

-- ------------------------------------------------------------
-- 2. admin_sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  token        VARCHAR(128) NOT NULL,
  user_agent   TEXT,
  ip_address   VARCHAR(60),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);

-- ------------------------------------------------------------
-- 3. user_sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  token        VARCHAR(128) NOT NULL,
  user_agent   TEXT,
  ip_address   VARCHAR(60),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

-- ------------------------------------------------------------
-- 4. academic_sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_sessions (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(20) NOT NULL,
  start_date   DATE,
  end_date     DATE,
  is_current   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_academic_sessions_name ON academic_sessions(name);

-- ------------------------------------------------------------
-- 5. schools
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(10) NOT NULL,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schools_code ON schools(code);

-- ------------------------------------------------------------
-- 6. departments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(10) NOT NULL,
  name         VARCHAR(200) NOT NULL,
  school_id    INTEGER NOT NULL,
  hod_user_id  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_school ON departments(school_id);

-- ------------------------------------------------------------
-- 7. programmes
-- FIX 4: unique key is (code) only
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programmes (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(10) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  department_id   INTEGER NOT NULL,
  level           level NOT NULL DEFAULT 'ND',
  duration_years  SMALLINT NOT NULL DEFAULT 2,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_programmes_code ON programmes(code);
CREATE INDEX IF NOT EXISTS idx_programmes_department ON programmes(department_id);

-- ------------------------------------------------------------
-- 8. courses
-- FIX 1: semester_name (was semester)
-- FIX 2: is_active column
-- FIX 3: unique index includes programme_id, keys on semester_name
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  unit            SMALLINT NOT NULL DEFAULT 2,
  level           level NOT NULL DEFAULT 'ND',
  semester_name   VARCHAR(20) NOT NULL DEFAULT 'First',
  year_of_study   INTEGER NOT NULL DEFAULT 1,
  programme_id    INTEGER NOT NULL,
  department_id   INTEGER NOT NULL,
  description     TEXT,
  is_elective     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_courses_code_prog_level_sem
  ON courses(code, programme_id, level, semester_name);
CREATE INDEX IF NOT EXISTS idx_courses_programme ON courses(programme_id);
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_year_of_study ON courses(year_of_study);

-- ------------------------------------------------------------
-- 9. course_allocations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_allocations (
  id           SERIAL PRIMARY KEY,
  course_id    INTEGER NOT NULL,
  lecturer_id  INTEGER NOT NULL,
  session_id   INTEGER NOT NULL,
  semester     semester NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_course_allocation
  ON course_allocations(course_id, lecturer_id, session_id, semester);
CREATE INDEX IF NOT EXISTS idx_allocations_course ON course_allocations(course_id);
CREATE INDEX IF NOT EXISTS idx_allocations_lecturer ON course_allocations(lecturer_id);

-- ------------------------------------------------------------
-- 10. course_registrations  (+ PARTIAL UNIQUE INDEX)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_registrations (
  id                SERIAL PRIMARY KEY,
  student_id        INTEGER NOT NULL,
  course_id         INTEGER NOT NULL,
  session_id        INTEGER NOT NULL,
  semester          semester NOT NULL,
  status            registration_status NOT NULL DEFAULT 'pending',
  approved_by       INTEGER,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registrations_student ON course_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_course ON course_registrations(course_id);
CREATE INDEX IF NOT EXISTS idx_registrations_session ON course_registrations(session_id);

-- *** THE PARTIAL UNIQUE INDEX — required by master prompt ***
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_registration
  ON course_registrations (student_id, course_id, session_id, semester)
  WHERE status IN ('pending','approved','rejected');

-- ------------------------------------------------------------
-- 11. results
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
  id                 SERIAL PRIMARY KEY,
  student_id         INTEGER NOT NULL,
  course_id          INTEGER NOT NULL,
  session_id         INTEGER NOT NULL,
  semester           semester NOT NULL,
  score              NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade              VARCHAR(3),
  points             NUMERIC(4,2),
  status             result_status NOT NULL DEFAULT 'draft',
  submitted_by       INTEGER,
  submitted_at       TIMESTAMPTZ,
  hod_verified_by    INTEGER,
  hod_verified_at    TIMESTAMPTZ,
  approved_by        INTEGER,
  approved_at        TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  rejection_reason   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_result
  ON results(student_id, course_id, session_id, semester);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_course ON results(course_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);

-- ------------------------------------------------------------
-- 12. grade_scales
-- FIX 6: points is NUMERIC(4,2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grade_scales (
  id           SERIAL PRIMARY KEY,
  grade        VARCHAR(3) NOT NULL,
  min_score    SMALLINT NOT NULL,
  max_score    SMALLINT NOT NULL,
  points       NUMERIC(4,2) NOT NULL,
  remark       VARCHAR(60),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_grade_scales_grade ON grade_scales(grade);

-- ------------------------------------------------------------
-- 13. fee_structures
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_structures (
  id             SERIAL PRIMARY KEY,
  programme_id   INTEGER NOT NULL,
  level          level NOT NULL,
  session_id     INTEGER NOT NULL,
  tuition        NUMERIC(12,2) NOT NULL DEFAULT 0,
  acceptance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  medical        NUMERIC(12,2) NOT NULL DEFAULT 0,
  library        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ict            NUMERIC(12,2) NOT NULL DEFAULT 0,
  sports         NUMERIC(12,2) NOT NULL DEFAULT 0,
  other          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fee_structure
  ON fee_structures(programme_id, level, session_id);

-- ------------------------------------------------------------
-- 14. payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  student_id        INTEGER NOT NULL,
  session_id        INTEGER NOT NULL,
  fee_structure_id  INTEGER,
  amount            NUMERIC(12,2) NOT NULL,
  reference         VARCHAR(80) NOT NULL,
  bank_name         VARCHAR(120),
  depositor_name    VARCHAR(200),
  deposit_date      DATE,
  receipt_url       TEXT,
  status            payment_status NOT NULL DEFAULT 'pending',
  verified_by       INTEGER,
  verified_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ------------------------------------------------------------
-- 15. clearances
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clearances (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL,
  session_id   INTEGER NOT NULL,
  type         VARCHAR(40) NOT NULL DEFAULT 'semester',
  status       clearance_status NOT NULL DEFAULT 'pending',
  cleared_by   INTEGER,
  cleared_at   TIMESTAMPTZ,
  remarks      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_clearance
  ON clearances(student_id, session_id, type);

-- ------------------------------------------------------------
-- 16. applications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id                  SERIAL PRIMARY KEY,
  application_number  VARCHAR(40) NOT NULL,
  type                VARCHAR(10) NOT NULL DEFAULT 'ND',
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  middle_name         VARCHAR(100),
  email               VARCHAR(255) NOT NULL,
  phone               VARCHAR(30) NOT NULL,
  gender              VARCHAR(10),
  date_of_birth       DATE,
  country             VARCHAR(60) DEFAULT 'Nigeria',
  state_of_origin     VARCHAR(60),
  lga                 VARCHAR(120),
  address             TEXT,
  programme_id        INTEGER,
  school_id           INTEGER,
  department_id       INTEGER,
  level               level NOT NULL DEFAULT 'ND',
  o_level_result      JSONB,
  jamb_score          SMALLINT,
  jamb_reg_no         VARCHAR(40),
  passport_url        TEXT,
  status              application_status NOT NULL DEFAULT 'pending',
  reviewed_by         INTEGER,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  admitted_at         TIMESTAMPTZ,
  matric_number       VARCHAR(40),
  user_id             INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_applications_number ON applications(application_number);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_state ON applications(state_of_origin);
CREATE INDEX IF NOT EXISTS idx_applications_lga ON applications(lga);

-- ------------------------------------------------------------
-- 17. timetable_slots
-- FIX 7: start_time / end_time are TIME
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable_slots (
  id            SERIAL PRIMARY KEY,
  course_id     INTEGER NOT NULL,
  lecturer_id   INTEGER,
  session_id    INTEGER NOT NULL,
  semester      semester NOT NULL,
  day_of_week   VARCHAR(12) NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  venue         VARCHAR(120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timetable_course ON timetable_slots(course_id);
CREATE INDEX IF NOT EXISTS idx_timetable_session ON timetable_slots(session_id);

-- ------------------------------------------------------------
-- 18. exam_schedules
-- FIX 7: start_time / end_time are TIME
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_schedules (
  id             SERIAL PRIMARY KEY,
  course_id      INTEGER NOT NULL,
  session_id     INTEGER NOT NULL,
  semester       semester NOT NULL,
  exam_date      DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  venue          VARCHAR(120),
  invigilators   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_course ON exam_schedules(course_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_session ON exam_schedules(session_id);

-- ------------------------------------------------------------
-- 19. exam_attendance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_attendance (
  id                SERIAL PRIMARY KEY,
  exam_schedule_id  INTEGER NOT NULL,
  student_id        INTEGER NOT NULL,
  status            attendance_status NOT NULL DEFAULT 'present',
  invigilator_id    INTEGER,
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_exam_attendance
  ON exam_attendance(exam_schedule_id, student_id);

-- ------------------------------------------------------------
-- 20. attendance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id           SERIAL PRIMARY KEY,
  course_id    INTEGER NOT NULL,
  student_id   INTEGER NOT NULL,
  lecturer_id  INTEGER,
  session_id   INTEGER NOT NULL,
  semester     semester NOT NULL,
  date         DATE NOT NULL,
  status       attendance_status NOT NULL DEFAULT 'present',
  remarks      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance
  ON attendance(course_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- ------------------------------------------------------------
-- 21. assignments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id              SERIAL PRIMARY KEY,
  course_id       INTEGER NOT NULL,
  lecturer_id     INTEGER NOT NULL,
  session_id      INTEGER NOT NULL,
  semester        semester NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  due_date        TIMESTAMPTZ,
  max_score       SMALLINT NOT NULL DEFAULT 100,
  attachment_url  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);

-- ------------------------------------------------------------
-- 22. assignment_submissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id               SERIAL PRIMARY KEY,
  assignment_id    INTEGER NOT NULL,
  student_id       INTEGER NOT NULL,
  submission_url   TEXT,
  submission_text  TEXT,
  score            NUMERIC(5,2),
  feedback         TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at        TIMESTAMPTZ,
  graded_by        INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_submission
  ON assignment_submissions(assignment_id, student_id);

-- ------------------------------------------------------------
-- 23. course_materials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_materials (
  id             SERIAL PRIMARY KEY,
  course_id      INTEGER NOT NULL,
  lecturer_id    INTEGER NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  file_url       TEXT,
  material_type  VARCHAR(40) DEFAULT 'note',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_materials_course ON course_materials(course_id);

-- ------------------------------------------------------------
-- 24. books
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(300) NOT NULL,
  author            VARCHAR(200),
  isbn              VARCHAR(30),
  category          VARCHAR(80),
  publisher         VARCHAR(200),
  year              SMALLINT,
  copies_total      SMALLINT NOT NULL DEFAULT 1,
  copies_available  SMALLINT NOT NULL DEFAULT 1,
  shelf             VARCHAR(40),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);

-- ------------------------------------------------------------
-- 25. borrow_records
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS borrow_records (
  id           SERIAL PRIMARY KEY,
  book_id      INTEGER NOT NULL,
  user_id      INTEGER NOT NULL,
  borrowed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at       TIMESTAMPTZ NOT NULL,
  returned_at  TIMESTAMPTZ,
  status       borrow_status NOT NULL DEFAULT 'borrowed',
  issued_by    INTEGER,
  received_by  INTEGER,
  remarks      TEXT
);
CREATE INDEX IF NOT EXISTS idx_borrows_book ON borrow_records(book_id);
CREATE INDEX IF NOT EXISTS idx_borrows_user ON borrow_records(user_id);
CREATE INDEX IF NOT EXISTS idx_borrows_status ON borrow_records(status);

-- ------------------------------------------------------------
-- 26. book_reservations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_reservations (
  id            SERIAL PRIMARY KEY,
  book_id       INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,
  status        reservation_status NOT NULL DEFAULT 'pending',
  reserved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at      TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  fulfilled_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reservations_book ON book_reservations(book_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON book_reservations(user_id);

-- ------------------------------------------------------------
-- 27. library_fines
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_fines (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  borrow_id   INTEGER,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  reason      VARCHAR(200),
  is_paid     BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fines_user ON library_fines(user_id);
CREATE INDEX IF NOT EXISTS idx_fines_paid ON library_fines(is_paid);

-- ------------------------------------------------------------
-- 28. documents
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  type          VARCHAR(60) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  file_url      TEXT,
  status        document_status NOT NULL DEFAULT 'pending',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_at     TIMESTAMPTZ,
  issued_by     INTEGER,
  remarks       TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- ------------------------------------------------------------
-- 29. graduations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS graduations (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER NOT NULL,
  session_id      INTEGER NOT NULL,
  programme_id    INTEGER NOT NULL,
  level           level NOT NULL,
  cgpa            NUMERIC(4,2),
  classification  VARCHAR(40),
  status          graduation_status NOT NULL DEFAULT 'pending',
  approved_by     INTEGER,
  approved_at     TIMESTAMPTZ,
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_graduation
  ON graduations(student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_graduations_status ON graduations(status);

-- ------------------------------------------------------------
-- 30. complaints
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  subject        VARCHAR(200) NOT NULL,
  body           TEXT NOT NULL,
  category       VARCHAR(60),
  status         complaint_status NOT NULL DEFAULT 'open',
  response       TEXT,
  responded_by   INTEGER,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

-- ------------------------------------------------------------
-- 31. messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id            BIGSERIAL PRIMARY KEY,
  sender_id     INTEGER NOT NULL,
  recipient_id  INTEGER NOT NULL,
  subject       VARCHAR(200),
  body          TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  parent_id     BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read);

-- ------------------------------------------------------------
-- 32. notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  type        VARCHAR(60) DEFAULT 'info',
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ------------------------------------------------------------
-- 33. announcements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(200) NOT NULL,
  body           TEXT NOT NULL,
  audience       VARCHAR(40) NOT NULL DEFAULT 'all',
  priority       VARCHAR(20) NOT NULL DEFAULT 'normal',
  author_id      INTEGER NOT NULL,
  is_published   BOOLEAN NOT NULL DEFAULT TRUE,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements(audience);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published);

-- ------------------------------------------------------------
-- 34. staff_profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_profiles (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  staff_number    VARCHAR(40),
  department_id   INTEGER,
  rank            VARCHAR(80),
  specialization  VARCHAR(200),
  qualification   VARCHAR(200),
  employment_date DATE,
  is_hod          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_user ON staff_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_number ON staff_profiles(staff_number);

-- ------------------------------------------------------------
-- 35. login_history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER,
  email       VARCHAR(255),
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address  VARCHAR(60),
  user_agent  TEXT,
  reason      VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email);

-- ------------------------------------------------------------
-- 36. audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER,
  action      VARCHAR(120) NOT NULL,
  entity      VARCHAR(60),
  entity_id   VARCHAR(60),
  before      JSONB,
  after       JSONB,
  ip_address  VARCHAR(60),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);

-- ------------------------------------------------------------
-- 37. security_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER,
  event       VARCHAR(120) NOT NULL,
  severity    VARCHAR(20) NOT NULL DEFAULT 'info',
  details     JSONB,
  ip_address  VARCHAR(60),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_user ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_event ON security_logs(event);
CREATE INDEX IF NOT EXISTS idx_security_severity ON security_logs(severity);

-- ------------------------------------------------------------
-- 38. tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER,
  email       VARCHAR(255),
  token       VARCHAR(128) NOT NULL,
  purpose     VARCHAR(60) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_purpose ON tokens(purpose);

-- ------------------------------------------------------------
-- 39. photo_uploads
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photo_uploads (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  url         TEXT NOT NULL,
  mime_type   VARCHAR(60),
  size_bytes  INTEGER,
  is_current  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photo_uploads_user ON photo_uploads(user_id);

-- ------------------------------------------------------------
-- 40. settings
-- FIX 5: key is the primary key
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(80) PRIMARY KEY,
  value       TEXT,
  category    VARCHAR(60) DEFAULT 'general',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 41. study_levels
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_levels (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(10) NOT NULL,
  name            VARCHAR(60) NOT NULL,
  level           level NOT NULL,
  year_of_study   SMALLINT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_study_levels_code ON study_levels(code);

-- ------------------------------------------------------------
-- DEFAULT SETTINGS (bootstrap)
-- ------------------------------------------------------------
INSERT INTO settings (key, value, category) VALUES
  ('matric_prefix', 'FPU', 'institution'),
  ('max_units', '24', 'academic'),
  ('current_session', '2025/2026', 'academic'),
  ('current_semester', 'first', 'academic'),
  ('pass_mark', '40', 'academic'),
  ('session_ttl_hours', '72', 'auth'),
  ('bcrypt_rounds', '10', 'auth'),
  ('institution_name', 'Federal Polytechnic Ugep', 'institution'),
  ('institution_motto', 'Citadel of Technical Excellence', 'institution'),
  ('institution_state', 'Cross River State', 'institution'),
  ('institution_country', 'Nigeria', 'institution')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- DEFAULT GRADE SCALE (NBTE)
-- ------------------------------------------------------------
INSERT INTO grade_scales (grade, min_score, max_score, points, remark) VALUES
  ('A', 70, 100, 4.00, 'Excellent'),
  ('B', 60,  69, 3.00, 'Very Good'),
  ('C', 50,  59, 2.00, 'Good'),
  ('D', 45,  49, 1.00, 'Fair'),
  ('E', 40,  44, 0.50, 'Pass'),
  ('F',  0,  39, 0.00, 'Fail')
ON CONFLICT (grade) DO NOTHING;

-- ------------------------------------------------------------
-- DEFAULT STUDY LEVELS
-- ------------------------------------------------------------
INSERT INTO study_levels (code, name, level, year_of_study) VALUES
  ('ND1',  'National Diploma Year 1',          'ND',  1),
  ('ND2',  'National Diploma Year 2',          'ND',  2),
  ('HND1', 'Higher National Diploma Year 1',   'HND', 1),
  ('HND2', 'Higher National Diploma Year 2',   'HND', 2),
  ('CERT', 'Certificate',                      'CERT', 1)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- END
-- ------------------------------------------------------------