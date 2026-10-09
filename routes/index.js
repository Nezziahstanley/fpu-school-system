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
// Public — ID card lookup (barcode / QR scan target)
// ------------------------------------------------------------
router.use('/public/id-lookup', require('./idLookup'));

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
router.use('/admin/login-history',  require('./loginHistory'));
router.use('/admin/sessions',       require('./sessions'));
router.use('/admin/programmes',     require('./programmes'));
router.use('/admin/courses',        require('./courses'));
router.use('/admin/schools',        require('./schools'));
router.use('/admin/departments',    require('./departments'));
router.use('/admin/allocations',    require('./allocations'));
router.use('/admin/registrations',  require('./registrations'));
router.use('/admin/grade-scales',   require('./gradeScales'));

// ------------------------------------------------------------
// Admin — academic operations
// ------------------------------------------------------------
router.use('/admin/results',        require('./results'));
router.use('/admin/attendance',     require('./attendance'));
router.use('/admin/exams',          require('./exams'));
router.use('/admin/timetable',      require('./timetable'));
router.use('/admin/transcript',     require('./transcript'));
router.use('/admin/graduation',     require('./graduation'));

// ------------------------------------------------------------
// Admin — finance & clearances
// ------------------------------------------------------------
router.use('/admin/fees',           require('./fees'));
router.use('/admin/payments',       require('./payments'));
router.use('/admin/clearances',     require('./clearances'));

// ------------------------------------------------------------
// Admin — HR / staff
// ------------------------------------------------------------
router.use('/admin/staff',          require('./staff'));
router.use('/admin/lecturers',      require('./lecturers'));
router.use('/admin/hods',           require('./hods'));

// ------------------------------------------------------------
// Admin — library
// ------------------------------------------------------------
router.use('/admin/library',        require('./library'));

// ------------------------------------------------------------
// Admin — documents & comms
// ------------------------------------------------------------
router.use('/admin/documents',      require('./documents'));
router.use('/admin/announcements',  require('./announcements'));
router.use('/admin/notifications',  require('./notifications'));
router.use('/admin/complaints',     require('./complaints'));

// ------------------------------------------------------------
// Admin — system
// ------------------------------------------------------------
router.use('/admin/settings',       require('./settings'));
router.use('/admin/security',       require('./security'));
router.use('/admin/audit',          require('./audit'));
router.use('/admin/reports',        require('./reports'));

// ------------------------------------------------------------
// Portal — shared (photo, messages, notifications, announcements,
// complaints, security, avatar upload, etc.)
// Mounted at /portal so client calls to
//   /api/portal/photo
//   /api/portal/messages
//   /api/portal/notifications
// resolve correctly.
// ------------------------------------------------------------
router.use('/portal',               require('./portal/shared'));
router.use('/portal/profile',       require('./portal/profile'));

// ------------------------------------------------------------
// Portal — role-specific
// ------------------------------------------------------------
router.use('/student',              require('./portal/student'));
router.use('/lecturer',             require('./portal/lecturer'));
router.use('/hod',                  require('./portal/hod'));
router.use('/bursar',               require('./portal/bursar'));
router.use('/registrar',            require('./portal/registrar'));
router.use('/rector',               require('./portal/rector'));
router.use('/exam-officer',         require('./portal/examOfficer'));
router.use('/academic-officer',     require('./portal/academicOfficer'));
router.use('/admission-officer',    require('./portal/admissionOfficer'));
router.use('/librarian',            require('./portal/librarian'));

module.exports = router;