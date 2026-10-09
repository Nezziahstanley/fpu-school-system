// ============================================================
// FPU School Management System — Drizzle schema
// ------------------------------------------------------------
// PostgreSQL 16. Every table maps to snake_case in the DB.
// This file is the single source of truth for:
//   - db/migrate.js (schema introspection)
//   - db/queries/* (typed query builders)
//   - scripts/seed-*.js
//   - drizzle-kit generate / push
// ============================================================

'use strict';

const {
  pgTable, serial, bigserial, integer, smallint, varchar, text,
  boolean, timestamp, date, time, numeric, jsonb, pgEnum,
  uniqueIndex, index,
} = require('drizzle-orm/pg-core');

// ============================================================
// ENUMS
// ============================================================
const userRoleEnum = pgEnum('user_role', [
  'student', 'lecturer', 'hod', 'bursar', 'registrar', 'rector',
  'librarian', 'exam_officer', 'academic_officer', 'admission_officer', 'admin',
]);

const levelEnum = pgEnum('level', ['ND', 'HND', 'CERT']);
const semesterEnum = pgEnum('semester', ['first', 'second']);

const appStatusEnum = pgEnum('application_status', [
  'pending', 'under_review', 'approved', 'rejected', 'registered',
]);

const resultStatusEnum = pgEnum('result_status', [
  'draft', 'submitted', 'hod_verified', 'approved', 'published',
  'hod_rejected', 'admin_rejected',
]);

const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'verified', 'rejected', 'refunded',
]);

const clearanceStatusEnum = pgEnum('clearance_status', [
  'pending', 'cleared', 'rejected',
]);

const borrowStatusEnum = pgEnum('borrow_status', [
  'borrowed', 'returned', 'overdue', 'lost',
]);

const reservationStatusEnum = pgEnum('reservation_status', [
  'pending', 'ready', 'fulfilled', 'cancelled', 'expired',
]);

const documentStatusEnum = pgEnum('document_status', [
  'pending', 'approved', 'issued', 'rejected',
]);

const graduationStatusEnum = pgEnum('graduation_status', [
  'pending', 'approved', 'rejected', 'graduated',
]);

const attendanceStatusEnum = pgEnum('attendance_status', [
  'present', 'absent', 'late', 'excused',
]);

const complaintStatusEnum = pgEnum('complaint_status', [
  'open', 'in_review', 'resolved', 'closed',
]);

const announcementPriorityEnum = pgEnum('announcement_priority', [
  'low', 'normal', 'high',
]);

const announcementAudienceEnum = pgEnum('announcement_audience', [
  'all', 'student', 'staff', 'lecturer', 'hod',
]);

const notifTypeEnum = pgEnum('notification_type', [
  'info', 'warning', 'success', 'complaint', 'fee',
]);

const registrationStatusEnum = pgEnum('registration_status', [
  'pending', 'approved', 'rejected',
]);

// ============================================================
// 1. USERS
// ============================================================
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('student'),

  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  middleName: varchar('middle_name', { length: 100 }),

  phone: varchar('phone', { length: 30 }),
  gender: varchar('gender', { length: 10 }),
  dateOfBirth: date('date_of_birth'),
  stateOfOrigin: varchar('state_of_origin', { length: 60 }),
  nationality: varchar('nationality', { length: 60 }).default('Nigerian'),
  address: text('address'),

  photoUrl: text('photo_url'),
  // Permanent photo used on the ID card — set once on first upload,
  // never overwritten even if the student later changes their profile photo.
  idCardPhotoUrl: text('id_card_photo_url'),

  matricNumber: varchar('matric_number', { length: 40 }).unique(),
  level: levelEnum('level'),

  programmeId: integer('programme_id'),
  departmentId: integer('department_id'),
  schoolId: integer('school_id'),
  currentSessionId: integer('current_session_id'),

  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),

  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  roleIdx: index('idx_users_role').on(t.role),
  deptIdx: index('idx_users_department').on(t.departmentId),
  progIdx: index('idx_users_programme').on(t.programmeId),
}));

// ============================================================
// 2. ADMIN SESSIONS
// ============================================================
const adminSessions = pgTable('admin_sessions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 60 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  userIdx: index('idx_admin_sessions_user').on(t.userId),
}));

// ============================================================
// 3. USER SESSIONS
// ============================================================
const userSessions = pgTable('user_sessions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 60 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  userIdx: index('idx_user_sessions_user').on(t.userId),
}));

// ============================================================
// 4. ACADEMIC SESSIONS
// ============================================================
const academicSessions = pgTable('academic_sessions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 20 }).notNull().unique(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 5. SCHOOLS
// ============================================================
const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 6. DEPARTMENTS
// ============================================================
const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  schoolId: integer('school_id').notNull(),
  hodUserId: integer('hod_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  schoolIdx: index('idx_departments_school').on(t.schoolId),
}));

// ============================================================
// 7. PROGRAMMES
// ============================================================
const programmes = pgTable('programmes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  departmentId: integer('department_id').notNull(),
  level: levelEnum('level').notNull().default('ND'),
  durationYears: smallint('duration_years').notNull().default(2),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  deptIdx: index('idx_programmes_department').on(t.departmentId),
}));

// ============================================================
// 8. COURSES
// ============================================================
const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  unit: smallint('unit').notNull().default(2),

  level: levelEnum('level').notNull().default('ND'),
  semesterName: varchar('semester_name', { length: 20 }).notNull().default('First'),
  yearOfStudy: integer('year_of_study').notNull().default(1),

  programmeId: integer('programme_id').notNull(),
  departmentId: integer('department_id').notNull(),

  description: text('description'),
  isElective: boolean('is_elective').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueCourse: uniqueIndex('uniq_courses_code_prog_level_sem')
    .on(t.code, t.programmeId, t.level, t.semesterName),
  codeIdx: index('idx_courses_programme').on(t.programmeId),
  deptIdx: index('idx_courses_department').on(t.departmentId),
  yearIdx: index('idx_courses_year_of_study').on(t.yearOfStudy),
}));

// ============================================================
// 9. COURSE ALLOCATIONS
// ============================================================
const courseAllocations = pgTable('course_allocations', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  lecturerId: integer('lecturer_id').notNull(),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueAlloc: uniqueIndex('uniq_course_allocation')
    .on(t.courseId, t.lecturerId, t.sessionId, t.semester),
  courseIdx: index('idx_allocations_course').on(t.courseId),
  lecturerIdx: index('idx_allocations_lecturer').on(t.lecturerId),
}));

// ============================================================
// 10. COURSE REGISTRATIONS
// ============================================================
const courseRegistrations = pgTable('course_registrations', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  courseId: integer('course_id').notNull(),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),
  status: registrationStatusEnum('status').notNull().default('pending'),
  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  studentIdx: index('idx_registrations_student').on(t.studentId),
  courseIdx: index('idx_registrations_course').on(t.courseId),
  sessionIdx: index('idx_registrations_session').on(t.sessionId),
}));

// ============================================================
// 11. RESULTS
// ============================================================
const results = pgTable('results', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  courseId: integer('course_id').notNull(),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),

  score: numeric('score', { precision: 5, scale: 2 }).notNull().default('0'),
  grade: varchar('grade', { length: 3 }),
  points: numeric('points', { precision: 4, scale: 2 }),

  status: resultStatusEnum('status').notNull().default('draft'),

  submittedBy: integer('submitted_by'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),

  hodVerifiedBy: integer('hod_verified_by'),
  hodVerifiedAt: timestamp('hod_verified_at', { withTimezone: true }),

  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  publishedAt: timestamp('published_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueResult: uniqueIndex('uniq_result')
    .on(t.studentId, t.courseId, t.sessionId, t.semester),
  studentIdx: index('idx_results_student').on(t.studentId),
  courseIdx: index('idx_results_course').on(t.courseId),
  statusIdx: index('idx_results_status').on(t.status),
}));

// ============================================================
// 12. GRADE SCALES
// ============================================================
const gradeScales = pgTable('grade_scales', {
  id: serial('id').primaryKey(),
  grade: varchar('grade', { length: 3 }).notNull().unique(),
  minScore: smallint('min_score').notNull(),
  maxScore: smallint('max_score').notNull(),
  points: numeric('points', { precision: 4, scale: 2 }).notNull(),
  remark: varchar('remark', { length: 60 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 13. FEE STRUCTURES
// ============================================================
const feeStructures = pgTable('fee_structures', {
  id: serial('id').primaryKey(),
  programmeId: integer('programme_id').notNull(),
  level: levelEnum('level').notNull(),
  sessionId: integer('session_id').notNull(),

  tuition: numeric('tuition', { precision: 12, scale: 2 }).notNull().default('0'),
  acceptance: numeric('acceptance', { precision: 12, scale: 2 }).notNull().default('0'),
  medical: numeric('medical', { precision: 12, scale: 2 }).notNull().default('0'),
  library: numeric('library', { precision: 12, scale: 2 }).notNull().default('0'),
  ict: numeric('ict', { precision: 12, scale: 2 }).notNull().default('0'),
  sports: numeric('sports', { precision: 12, scale: 2 }).notNull().default('0'),
  other: numeric('other', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueFee: uniqueIndex('uniq_fee_structure')
    .on(t.programmeId, t.level, t.sessionId),
}));

// ============================================================
// 14. PAYMENTS
// ============================================================
const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  sessionId: integer('session_id').notNull(),
  feeStructureId: integer('fee_structure_id'),

  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 80 }).notNull().unique(),
  bankName: varchar('bank_name', { length: 120 }),
  depositorName: varchar('depositor_name', { length: 200 }),
  depositDate: date('deposit_date'),
  receiptUrl: text('receipt_url'),

  status: paymentStatusEnum('status').notNull().default('pending'),
  verifiedBy: integer('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  studentIdx: index('idx_payments_student').on(t.studentId),
  statusIdx: index('idx_payments_status').on(t.status),
}));

// ============================================================
// 15. CLEARANCES
// ============================================================
const clearances = pgTable('clearances', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  sessionId: integer('session_id').notNull(),
  type: varchar('type', { length: 40 }).notNull().default('semester'),
  status: clearanceStatusEnum('status').notNull().default('pending'),
  clearedBy: integer('cleared_by'),
  clearedAt: timestamp('cleared_at', { withTimezone: true }),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueClearance: uniqueIndex('uniq_clearance')
    .on(t.studentId, t.sessionId, t.type),
}));

// ============================================================
// 16. APPLICATIONS
// ============================================================
const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  applicationNumber: varchar('application_number', { length: 40 }).notNull().unique(),
  type: varchar('type', { length: 10 }).notNull().default('ND'),

  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  middleName: varchar('middle_name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  gender: varchar('gender', { length: 10 }),
  dateOfBirth: date('date_of_birth'),

  country: varchar('country', { length: 60 }).default('Nigeria'),
  stateOfOrigin: varchar('state_of_origin', { length: 60 }),
  lga: varchar('lga', { length: 120 }),
  address: text('address'),

  programmeId: integer('programme_id'),
  schoolId: integer('school_id'),
  departmentId: integer('department_id'),
  level: levelEnum('level').notNull().default('ND'),

  oLevelResult: jsonb('o_level_result'),
  jambScore: smallint('jamb_score'),
  jambRegNo: varchar('jamb_reg_no', { length: 40 }),
  passportUrl: text('passport_url'),

  status: appStatusEnum('status').notNull().default('pending'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  admittedAt: timestamp('admitted_at', { withTimezone: true }),

  matricNumber: varchar('matric_number', { length: 40 }),
  userId: integer('user_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index('idx_applications_email').on(t.email),
  statusIdx: index('idx_applications_status').on(t.status),
  stateIdx: index('idx_applications_state').on(t.stateOfOrigin),
  lgaIdx: index('idx_applications_lga').on(t.lga),
}));

// ============================================================
// 17. TIMETABLE SLOTS
// ============================================================
const timetableSlots = pgTable('timetable_slots', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  lecturerId: integer('lecturer_id'),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),
  dayOfWeek: varchar('day_of_week', { length: 12 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  venue: varchar('venue', { length: 120 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  courseIdx: index('idx_timetable_course').on(t.courseId),
  sessionIdx: index('idx_timetable_session').on(t.sessionId),
}));

// ============================================================
// 18. EXAM SCHEDULES
// ============================================================
const examSchedules = pgTable('exam_schedules', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),
  examDate: date('exam_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  venue: varchar('venue', { length: 120 }),
  invigilators: text('invigilators'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  courseIdx: index('idx_exam_schedules_course').on(t.courseId),
  sessionIdx: index('idx_exam_schedules_session').on(t.sessionId),
}));

// ============================================================
// 19. EXAM ATTENDANCE
// ============================================================
const examAttendance = pgTable('exam_attendance', {
  id: serial('id').primaryKey(),
  examScheduleId: integer('exam_schedule_id').notNull(),
  studentId: integer('student_id').notNull(),
  status: attendanceStatusEnum('status').notNull().default('present'),
  invigilatorId: integer('invigilator_id'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueExamAtt: uniqueIndex('uniq_exam_attendance')
    .on(t.examScheduleId, t.studentId),
}));

// ============================================================
// 20. ATTENDANCE
// ============================================================
const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  studentId: integer('student_id').notNull(),
  lecturerId: integer('lecturer_id'),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),
  date: date('date').notNull(),
  status: attendanceStatusEnum('status').notNull().default('present'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueAtt: uniqueIndex('uniq_attendance').on(t.courseId, t.studentId, t.date),
  courseIdx: index('idx_attendance_course').on(t.courseId),
  studentIdx: index('idx_attendance_student').on(t.studentId),
}));

// ============================================================
// 21. ASSIGNMENTS
// ============================================================
const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  lecturerId: integer('lecturer_id').notNull(),
  sessionId: integer('session_id').notNull(),
  semester: semesterEnum('semester').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  maxScore: smallint('max_score').notNull().default(100),
  attachmentUrl: text('attachment_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  courseIdx: index('idx_assignments_course').on(t.courseId),
}));

// ============================================================
// 22. ASSIGNMENT SUBMISSIONS
// ============================================================
const assignmentSubmissions = pgTable('assignment_submissions', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id').notNull(),
  studentId: integer('student_id').notNull(),
  submissionUrl: text('submission_url'),
  submissionText: text('submission_text'),
  score: numeric('score', { precision: 5, scale: 2 }),
  feedback: text('feedback'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  gradedBy: integer('graded_by'),
}, (t) => ({
  uniqueSub: uniqueIndex('uniq_assignment_submission')
    .on(t.assignmentId, t.studentId),
}));

// ============================================================
// 23. COURSE MATERIALS
// ============================================================
const courseMaterials = pgTable('course_materials', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  lecturerId: integer('lecturer_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  fileUrl: text('file_url'),
  materialType: varchar('material_type', { length: 40 }).default('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  courseIdx: index('idx_materials_course').on(t.courseId),
}));

// ============================================================
// 24. BOOKS
// ============================================================
const books = pgTable('books', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 300 }).notNull(),
  author: varchar('author', { length: 200 }),
  isbn: varchar('isbn', { length: 30 }),
  category: varchar('category', { length: 80 }),
  publisher: varchar('publisher', { length: 200 }),
  year: smallint('year'),
  copiesTotal: smallint('copies_total').notNull().default(1),
  copiesAvailable: smallint('copies_available').notNull().default(1),
  shelf: varchar('shelf', { length: 40 }),
  departmentId: integer('department_id'),
  isGeneral: boolean('is_general').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  titleIdx: index('idx_books_title').on(t.title),
  isbnIdx: index('idx_books_isbn').on(t.isbn),
  deptIdx: index('idx_books_department').on(t.departmentId),
}));

// ============================================================
// 25. BORROW RECORDS
// ============================================================
const borrowRecords = pgTable('borrow_records', {
  id: serial('id').primaryKey(),
  bookId: integer('book_id').notNull(),
  userId: integer('user_id').notNull(),
  borrowedAt: timestamp('borrowed_at', { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  status: borrowStatusEnum('status').notNull().default('borrowed'),
  issuedBy: integer('issued_by'),
  receivedBy: integer('received_by'),
  remarks: text('remarks'),
}, (t) => ({
  bookIdx: index('idx_borrows_book').on(t.bookId),
  userIdx: index('idx_borrows_user').on(t.userId),
  statusIdx: index('idx_borrows_status').on(t.status),
}));

// ============================================================
// 26. BOOK RESERVATIONS
// ============================================================
const bookReservations = pgTable('book_reservations', {
  id: serial('id').primaryKey(),
  bookId: integer('book_id').notNull(),
  userId: integer('user_id').notNull(),
  status: reservationStatusEnum('status').notNull().default('pending'),
  reservedAt: timestamp('reserved_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
}, (t) => ({
  bookIdx: index('idx_reservations_book').on(t.bookId),
  userIdx: index('idx_reservations_user').on(t.userId),
}));

// ============================================================
// 27. LIBRARY FINES
// ============================================================
const libraryFines = pgTable('library_fines', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  borrowId: integer('borrow_id'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  reason: varchar('reason', { length: 200 }),
  isPaid: boolean('is_paid').notNull().default(false),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_fines_user').on(t.userId),
  paidIdx: index('idx_fines_paid').on(t.isPaid),
}));

// ============================================================
// 28. DOCUMENTS
// ============================================================
const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  type: varchar('type', { length: 60 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  fileUrl: text('file_url'),
  status: documentStatusEnum('status').notNull().default('pending'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  issuedBy: integer('issued_by'),
  remarks: text('remarks'),
}, (t) => ({
  userIdx: index('idx_documents_user').on(t.userId),
  statusIdx: index('idx_documents_status').on(t.status),
}));

// ============================================================
// 29. GRADUATIONS
// ============================================================
const graduations = pgTable('graduations', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  sessionId: integer('session_id').notNull(),
  programmeId: integer('programme_id').notNull(),
  level: levelEnum('level').notNull(),
  cgpa: numeric('cgpa', { precision: 4, scale: 2 }),
  classification: varchar('classification', { length: 40 }),
  status: graduationStatusEnum('status').notNull().default('pending'),
  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueGrad: uniqueIndex('uniq_graduation').on(t.studentId, t.sessionId),
  statusIdx: index('idx_graduations_status').on(t.status),
}));

// ============================================================
// 30. COMPLAINTS
// ============================================================
const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  body: text('body').notNull(),
  category: varchar('category', { length: 60 }),
  status: complaintStatusEnum('status').notNull().default('open'),
  response: text('response'),
  respondedBy: integer('responded_by'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_complaints_user').on(t.userId),
  statusIdx: index('idx_complaints_status').on(t.status),
}));

// ============================================================
// 31. MESSAGES
// ============================================================
const messages = pgTable('messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  senderId: integer('sender_id').notNull(),
  recipientId: integer('recipient_id').notNull(),
  subject: varchar('subject', { length: 200 }),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  parentId: integer('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  senderIdx: index('idx_messages_sender').on(t.senderId),
  recipientIdx: index('idx_messages_recipient').on(t.recipientId),
  readIdx: index('idx_messages_read').on(t.isRead),
}));

// ============================================================
// 32. NOTIFICATIONS
// ============================================================
const notifications = pgTable('notifications', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),
  type: notifTypeEnum('type').default('info'),
  link: text('link'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_notifications_user').on(t.userId),
  readIdx: index('idx_notifications_read').on(t.isRead),
}));

// ============================================================
// 33. ANNOUNCEMENTS
// ============================================================
const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  audience: announcementAudienceEnum('audience').notNull().default('all'),
  priority: announcementPriorityEnum('priority').notNull().default('normal'),
  authorId: integer('author_id').notNull(),
  isPublished: boolean('is_published').notNull().default(true),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  audienceIdx: index('idx_announcements_audience').on(t.audience),
  publishedIdx: index('idx_announcements_published').on(t.isPublished),
}));

// ============================================================
// 34. STAFF PROFILES
// ============================================================
const staffProfiles = pgTable('staff_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique(),
  staffNumber: varchar('staff_number', { length: 40 }).unique(),
  departmentId: integer('department_id'),
  rank: varchar('rank', { length: 80 }),
  specialization: varchar('specialization', { length: 200 }),
  qualification: varchar('qualification', { length: 200 }),
  employmentDate: date('employment_date'),
  isHod: boolean('is_hod').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 35. LOGIN HISTORY
// ============================================================
const loginHistory = pgTable('login_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id'),
  email: varchar('email', { length: 255 }),
  success: boolean('success').notNull().default(true),
  ipAddress: varchar('ip_address', { length: 60 }),
  userAgent: text('user_agent'),
  reason: varchar('reason', { length: 120 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_login_history_user').on(t.userId),
  emailIdx: index('idx_login_history_email').on(t.email),
}));

// ============================================================
// 36. AUDIT LOGS
// ============================================================
const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id'),
  action: varchar('action', { length: 120 }).notNull(),
  entity: varchar('entity', { length: 60 }),
  entityId: varchar('entity_id', { length: 60 }),
  before: jsonb('before'),
  after: jsonb('after'),
  ipAddress: varchar('ip_address', { length: 60 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_audit_user').on(t.userId),
  actionIdx: index('idx_audit_action').on(t.action),
  entityIdx: index('idx_audit_entity').on(t.entity),
}));

// ============================================================
// 37. SECURITY LOGS
// ============================================================
const securityLogs = pgTable('security_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id'),
  event: varchar('event', { length: 120 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('info'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 60 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_security_user').on(t.userId),
  eventIdx: index('idx_security_event').on(t.event),
  severityIdx: index('idx_security_severity').on(t.severity),
}));

// ============================================================
// 38. TOKENS
// ============================================================
const tokens = pgTable('tokens', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id'),
  email: varchar('email', { length: 255 }),
  token: varchar('token', { length: 128 }).notNull().unique(),
  purpose: varchar('purpose', { length: 60 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  purposeIdx: index('idx_tokens_purpose').on(t.purpose),
}));

// ============================================================
// 39. PHOTO UPLOADS
// ============================================================
const photoUploads = pgTable('photo_uploads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  url: text('url').notNull(),
  mimeType: varchar('mime_type', { length: 60 }),
  sizeBytes: integer('size_bytes'),
  isCurrent: boolean('is_current').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_photo_uploads_user').on(t.userId),
}));

// ============================================================
// 40. SETTINGS
// ============================================================
const settings = pgTable('settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: text('value'),
  category: varchar('category', { length: 60 }).default('general'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 41. STUDY LEVELS
// ============================================================
const studyLevels = pgTable('study_levels', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 60 }).notNull(),
  level: levelEnum('level').notNull(),
  yearOfStudy: smallint('year_of_study').notNull().default(1),
});

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // enums
  userRoleEnum,
  levelEnum,
  semesterEnum,
  appStatusEnum,
  resultStatusEnum,
  paymentStatusEnum,
  clearanceStatusEnum,
  borrowStatusEnum,
  reservationStatusEnum,
  documentStatusEnum,
  graduationStatusEnum,
  attendanceStatusEnum,
  complaintStatusEnum,
  announcementPriorityEnum,
  announcementAudienceEnum,
  notifTypeEnum,
  registrationStatusEnum,

  // tables
  users,
  adminSessions,
  userSessions,
  academicSessions,
  schools,
  departments,
  programmes,
  courses,
  courseAllocations,
  courseRegistrations,
  results,
  gradeScales,
  feeStructures,
  payments,
  clearances,
  applications,
  timetableSlots,
  examSchedules,
  examAttendance,
  attendance,
  assignments,
  assignmentSubmissions,
  courseMaterials,
  books,
  borrowRecords,
  bookReservations,
  libraryFines,
  documents,
  graduations,
  complaints,
  messages,
  notifications,
  announcements,
  staffProfiles,
  loginHistory,
  auditLogs,
  securityLogs,
  tokens,
  photoUploads,
  settings,
  studyLevels,
};