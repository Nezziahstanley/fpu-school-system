// ============================================================
// FPU — API router
// Mounted in server.js as: app.use('/api', require('./routes'))
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

// ------------------------------------------------------------
// Health & public
// ------------------------------------------------------------
router.use('/',           require('./health'));
router.use('/admin/auth', require('./adminAuth'));       // /api/admin/auth/login
router.use('/admin',      require('./adminAuth'));       // /api/admin/login  (alias)
router.use('/admin/seed', require('./adminSeed'));       // /api/admin/seed/* (guarded)
router.use('/', require('./public'));                    // /api/apply, /api/contact, etc.

// ------------------------------------------------------------
// Admin — lookups (dropdown data)
// ------------------------------------------------------------
router.use('/admin/lookups',        require('./adminLookups'));

// ------------------------------------------------------------
// Admin — core resources
// ------------------------------------------------------------
router.use('/admin/applications',   require('./applications'));
router.use('/admin/students',       require('./students'));
router.use('/admin/users',          require('./adminUsers'));   // MUST be before users.js
router.use('/admin/user-list',      require('./users'));
router.use('/admin/login-history',  require('./loginHistory'));
router.use('/admin/sessions',       require('./sessions'));
router.use('/admin/programmes',     require('./programmes'));
router.use('/admin/courses',        require('./courses'));
router.use('/admin/schools',        require('./schools'));
router.use('/admin/departments',    require('./departments'));
router.use('/admin/allocations',    require('./allocations'));
router.use('/admin/registrations',  require('./registrations'));
router.use('/admin/grade-scales',   require('./gradeScales'));
router.use('/admin/results',        require('./results'));
router.use('/admin/transcript',     require('./transcript'));
router.use('/admin/staff',          require('./staff'));
router.use('/admin/hods',           require('./hods'));
router.use('/admin/lecturers',      require('./lecturers'));
router.use('/admin/fees',           require('./fees'));
router.use('/admin/payments',       require('./payments'));
router.use('/admin/clearances',     require('./clearances'));
router.use('/admin/timetable',      require('./timetable'));
router.use('/admin/exams',          require('./exams'));
router.use('/admin/notifications',  require('./notifications'));
router.use('/admin/documents',      require('./documents'));
router.use('/admin/attendance',     require('./attendance'));
router.use('/admin/complaints',     require('./complaints'));
router.use('/admin/graduation',     require('./graduation'));
router.use('/admin/library',        require('./library'));
router.use('/admin/security',       require('./security'));
router.use('/admin/settings',       require('./settings'));
router.use('/admin/reports',        require('./reports'));
router.use('/admin/audit',          require('./audit'));
router.use('/admin/announcements',  require('./announcements'));

// ------------------------------------------------------------
// Portal — per-role APIs
// ------------------------------------------------------------
router.use('/student',          require('./portal/student'));
router.use('/lecturer',         require('./portal/lecturer'));
router.use('/hod',              require('./portal/hod'));
router.use('/bursar',           require('./portal/bursar'));
router.use('/rector',           require('./portal/rector'));
router.use('/registrar',        require('./portal/registrar'));
router.use('/librarian',        require('./portal/librarian'));
router.use('/exam-officer',     require('./portal/examOfficer'));
router.use('/academic-officer', require('./portal/academicOfficer'));
router.use('/admission-officer',require('./portal/admissionOfficer'));

// ------------------------------------------------------------
// Portal — shared (profile, photo upload, etc.)
// ------------------------------------------------------------
router.use('/portal',           require('./portal/shared'));
router.use('/portal',           require('./portal/profile'));   // NEW: photo upload

module.exports = router;