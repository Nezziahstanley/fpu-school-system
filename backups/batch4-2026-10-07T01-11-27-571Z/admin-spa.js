// ============================================================
// FPU Admin — SPA Shell
// ============================================================

(function () {
  'use strict';

  const A = window.FPU_ADMIN || {};

  // ----------------------------------------------------------
  // AUTH HELPERS
  // ----------------------------------------------------------
  function getToken() {
    return localStorage.getItem('fpu_admin_token')
      || localStorage.getItem('portal_token');
  }

  function getUser() {
    try {
      const raw = localStorage.getItem('fpu_admin_user')
        || localStorage.getItem('portal_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem('fpu_admin_token');
    localStorage.removeItem('fpu_admin_user');
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_user');
  }

  async function performLogout() {
    if (!confirm('Log out of the admin panel?')) return;
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
      } catch { /* ignore */ }
    }
    clearSession();
    window.location.href = '/login.html';
  }

  // ----------------------------------------------------------
  // SAFE INIT WRAPPER
  // ----------------------------------------------------------
  function call(name) {
    return function () {
      const fn = A[name];
      if (typeof fn === 'function') {
        try {
          const r = fn();
          if (r && typeof r.catch === 'function') {
            r.catch((e) => console.warn('[init]', name, e));
          }
        } catch (e) {
          console.warn('[init]', name, e);
        }
      }
    };
  }

  // ----------------------------------------------------------
  // SIDEBAR
  // ----------------------------------------------------------
  const SPA_NAV = [
    { key: 'dashboard',        label: 'Dashboard',        icon: 'dash' },
    { group: 'Admissions' },
    { key: 'applications',     label: 'Applications',     icon: 'clipboard' },
    { key: 'admitted',         label: 'Admitted',         icon: 'check' },
    { group: 'Academics' },
    { key: 'students',         label: 'Students',         icon: 'users' },
    { key: 'sessions',         label: 'Sessions',         icon: 'calendar' },
    { key: 'programmes',       label: 'Programmes',       icon: 'building' },
    { key: 'courses',          label: 'Courses',          icon: 'book' },
    { key: 'schools',          label: 'Schools',          icon: 'building' },
    { key: 'departments',      label: 'Departments',      icon: 'building' },
    { key: 'allocations',      label: 'Allocations',      icon: 'book' },
    { key: 'registrations',    label: 'Registrations',    icon: 'clipboard' },
    { key: 'results',          label: 'Results',          icon: 'chart' },
    { key: 'grade-scales',     label: 'Grade Scales',     icon: 'chart' },
    { key: 'transcript',       label: 'Transcript',       icon: 'file' },
    { key: 'timetable',        label: 'Timetable',        icon: 'calendar' },
    { key: 'exams',            label: 'Exams',            icon: 'clipboard' },
    { key: 'attendance',       label: 'Attendance',       icon: 'check' },
    { group: 'Staff' },
    { key: 'staff',            label: 'Staff',            icon: 'users' },
    { key: 'hods',             label: 'HODs',             icon: 'users' },
    { key: 'lecturers',        label: 'Lecturers',        icon: 'users' },
    { group: 'Finance' },
    { key: 'fees',             label: 'Fees',             icon: 'money' },
    { key: 'payments',         label: 'Payments',         icon: 'money' },
    { key: 'clearances',       label: 'Clearances',       icon: 'check' },
    { group: 'Communication' },
    { key: 'announcements',    label: 'Announcements',    icon: 'megaphone' },
    { key: 'notifications',    label: 'Notifications',    icon: 'bell' },
    { key: 'complaints',       label: 'Complaints',       icon: 'chat' },
    { group: 'Library' },
    { key: 'library',          label: 'Books',            icon: 'book' },
    { key: 'borrows',          label: 'Borrows',          icon: 'book' },
    { group: 'Records' },
    { key: 'documents',        label: 'Documents',        icon: 'file' },
    { key: 'graduation',       label: 'Graduation',       icon: 'award' },
    { key: 'reports',          label: 'Reports',          icon: 'chart' },
    { key: 'audit',            label: 'Audit',            icon: 'clipboard' },
    { key: 'security',         label: 'Security',         icon: 'shield' },
    { key: 'settings',         label: 'Settings',         icon: 'settings' },
    { group: 'Users' },
    { key: 'users',            label: 'Users Hub',        icon: 'users' },
    { key: 'users-all',        label: 'All Users',        icon: 'users' },
    { key: 'users-admins',     label: 'Admin Accounts',   icon: 'shield' },
    { key: 'users-login-history', label: 'Login History', icon: 'clipboard' },
  ];

  // Aliases: page key → sidebar key to highlight.
  const NAV_ALIASES = {
    'students-by-dept':     'students',
    'student-form':         'students',
    'student-profile':      'students',
    'application-form':     'applications',
    'application-view':     'applications',
    'programme-form':       'programmes',
    'session-form':         'sessions',
    'course-form':          'courses',
    'courses-by-dept':      'courses',
    'school-form':          'schools',
    'school-by-id':         'schools',
    'department-form':      'departments',
    'department-by-id':     'departments',
    'allocation-form':      'allocations',
    'allocation-bulk':      'allocations',
    'allocations-by-dept':  'allocations',
    'result-edit':          'results',
    'result-detail':        'results',
    'results-by-dept':      'results',
    'timetable-form':       'timetable',
    'timetable-by-dept':    'timetable',
    'exam-form':            'exams',
    'exam-sheet':           'exams',
    'staff-form':           'staff',
    'staff-profile':        'staff',
    'staff-workload':       'staff',
    'fee-form':             'fees',
    'fees-by-dept':         'fees',
    'payment-form':         'payments',
    'payment-detail':       'payments',
    'payments-by-dept':     'payments',
    'payments-by-student':  'payments',
    'announcement-form':    'announcements',
    'announcement-detail':  'announcements',
    'graduation-form':      'graduation',
    'graduation-queue':     'graduation',
    'complaint-view':       'complaints',
    'book-form':            'library',
    'book-detail':          'library',
    'borrow-issue':         'borrows',
    'clearances-by-dept':   'clearances',
    'documents-detail':     'documents',
    'document-new':         'documents',
    'attendance-by-dept':   'attendance',
    'attendance-by-course': 'attendance',
    'attendance-by-student':'attendance',
    'transcript-by-student':'transcript',
    'users-all':            'users',
    'users-admins':         'users',
    'users-with-photos':    'users',
    'users-login-history':  'users',
    'user-form':            'users',
    'user-profile':         'users',
    'security-dashboard':   'security',
    'security-events':      'security',
    'security-sessions':    'security',
    'security-logins':      'security',
    'security-ip-rules':    'security',
    'security-password':    'security',
    'security-permissions': 'security',
    'security-2fa':         'security',
    'security-backups':     'security',
    'security-compliance':  'security',
  };

  // ----------------------------------------------------------
  // PAGES
  // ----------------------------------------------------------
  const SPA_PAGES = {
    // ---------- Dashboard ----------
    'dashboard':        { url: '/admin/partials/dashboard/index.html',           title: 'Dashboard',       init: () => {} },

    // ---------- Admissions ----------
    'applications':     { url: '/admin/partials/applications/list.html',         title: 'Applications',    init: call('loadApplications') },
    'application-form': { url: '/admin/partials/applications/form.html',         title: 'New Application', init: () => {} },
    'application-view': { url: '/admin/partials/applications/view.html',         title: 'Application',     init: () => {} },
    'admitted':         { url: '/admin/partials/applications/admitted.html',     title: 'Admitted',        init: call('loadAdmitted') },

    // ---------- Academics ----------
    'students':           { url: '/admin/partials/students/list.html',           title: 'Students',        init: call('loadStudentDepartments') },
    'students-by-dept':   { url: '/admin/partials/students/by-department.html',  title: 'Department',      init: call('loadDepartmentStudents') },
    'student-form':       { url: '/admin/partials/students/form.html',           title: 'New Student',     init: () => {} },
    'student-profile':    { url: '/admin/partials/students/profile.html',        title: 'Student Profile', init: () => {} },

    'sessions':         { url: '/admin/partials/academics/sessions.html',         title: 'Sessions',        init: call('loadSessions') },
    'session-form':     { url: '/admin/partials/academics/session-form.html',     title: 'New Session',     init: () => {} },

    'programmes':       { url: '/admin/partials/academics/programmes.html',     title: 'Programmes',      init: call('loadProgrammes') },
    'programme-form':   { url: '/admin/partials/academics/programme-form.html', title: 'New Programme',   init: () => {} },

    // ---------- Courses (department-first) ----------
    'courses':          { url: '/admin/partials/courses/departments.html',       title: 'Courses',         init: call('loadCourseDepartments') },
    'courses-by-dept':  { url: '/admin/partials/courses/by-department.html',     title: 'Department Courses', init: call('loadDepartmentCourses') },
    'course-form':      { url: '/admin/partials/courses/form.html',              title: 'New Course',      init: () => {} },
    'courses-list':     { url: '/admin/partials/courses/list.html',              title: 'All Courses',     init: () => {} },

    'schools':          { url: '/admin/partials/schools/list.html',              title: 'Schools',         init: call('loadSchoolCards') },
    'school-form':      { url: '/admin/partials/schools/form.html',              title: 'New School',      init: () => {} },
    'school-by-id':     { url: '/admin/partials/schools/detail.html',            title: 'School Detail',   init: () => {} },

    'departments':      { url: '/admin/partials/departments/list.html',          title: 'Departments',     init: call('loadDepartmentCards') },
    'department-form':  { url: '/admin/partials/departments/form.html',          title: 'New Department',  init: () => {} },
    'department-by-id': { url: '/admin/partials/departments/detail.html',        title: 'Department',      init: () => {} },

    'allocations':          { url: '/admin/partials/allocations/list.html',      title: 'Allocations',     init: call('loadAllocationDepartments') },
    'allocation-form':      { url: '/admin/partials/allocations/form.html',      title: 'New Allocation',  init: () => {} },
    'allocation-bulk':      { url: '/admin/partials/allocations/bulk.html',      title: 'Bulk Allocations',init: () => {} },
    'allocations-by-dept':  { url: '/admin/partials/allocations/by-department.html', title: 'Department Allocations', init: call('loadDepartmentAllocations') },

    'registrations':           { url: '/admin/partials/registrations/list.html',      title: 'Registrations',   init: call('loadRegistrationStudents') },
    'registrations-by-course': { url: '/admin/partials/registrations/by-course.html', title: 'Registrations by Course', init: call('loadCourseRegistrations') },
    'registrations-by-student':{ url: '/admin/partials/registrations/by-student.html',title: 'Student Registrations',   init: call('loadStudentRegistrations') },

    'results':          { url: '/admin/partials/results/list.html',              title: 'Results',         init: call('loadResultDepartments') },
    'results-by-dept':  { url: '/admin/partials/results/by-department.html',     title: 'Department Results', init: call('loadDepartmentResults') },
    'result-edit':      { url: '/admin/partials/results/edit.html',              title: 'Edit Result',     init: () => {} },
    'result-detail':    { url: '/admin/partials/results/result-detail.html',     title: 'Result Detail',   init: () => {} },
    'grade-scales':     { url: '/admin/partials/results/grade-scales.html',      title: 'Grade Scales',    init: call('loadGradeScales') },

    'transcript':           { url: '/admin/partials/transcript/index.html',      title: 'Transcript',      init: call('loadTranscriptLookup') },
    'transcript-by-student':{ url: '/admin/partials/transcript/by-student.html', title: 'Student Transcript', init: call('loadStudentTranscript') },

    'timetable':          { url: '/admin/partials/timetable/index.html',         title: 'Timetable',       init: call('loadTimetableIndex') },
    'timetable-list':     { url: '/admin/partials/timetable/list.html',          title: 'Timetable List',  init: call('loadTimetable') },
    'timetable-form':     { url: '/admin/partials/timetable/form.html',          title: 'New Slot',        init: () => {} },
    'timetable-by-dept':  { url: '/admin/partials/timetable/semester.html',      title: 'Department Timetable', init: call('loadTimetableSheet') },

    'exams':         { url: '/admin/partials/exams/index.html',                  title: 'Exams',           init: call('loadExamsIndex') },
    'exams-list':    { url: '/admin/partials/exams/list.html',                   title: 'Exam Schedules',  init: call('loadExams') },
    'exam-form':     { url: '/admin/partials/exams/form.html',                   title: 'New Exam',        init: () => {} },
    'exam-sheet':    { url: '/admin/partials/exams/sheet.html',                  title: 'Exam Sheet',      init: call('loadExamSheet') },

    'attendance':            { url: '/admin/partials/attendance/index.html',         title: 'Attendance',      init: call('loadAttendanceDepartments') },
    'attendance-by-dept':    { url: '/admin/partials/attendance/by-department.html', title: 'Department Attendance', init: call('loadDepartmentAttendance') },
    'attendance-by-course':  { url: '/admin/partials/attendance/by-course.html',     title: 'Course Attendance', init: call('loadCourseAttendance') },
    'attendance-by-student': { url: '/admin/partials/attendance/by-student.html',    title: 'Student Attendance', init: call('loadStudentCourseAttendance') },

    // ---------- Staff ----------
    'staff':            { url: '/admin/partials/staff/list.html',                title: 'Staff',           init: call('loadStaffDirectory') },
    'staff-form':       { url: '/admin/partials/staff/form.html',                title: 'New Staff',       init: () => {} },
    'staff-profile':    { url: '/admin/partials/staff/profile.html',             title: 'Staff Profile',   init: call('loadStaffProfile') },
    'staff-workload':   { url: '/admin/partials/staff/workload.html',            title: 'Workload',        init: call('loadStaffWorkload') },

    'hods':             { url: '/admin/partials/hods/list.html',                 title: 'HODs',            init: call('loadHodBoard') },
    'lecturers':        { url: '/admin/partials/lecturers/list.html',            title: 'Lecturers',       init: call('loadLecturerGrid') },

    // ---------- Finance ----------
    'fees':             { url: '/admin/partials/fees/list.html',                 title: 'Fee Structures',  init: call('loadFeeDepartments') },
    'fee-form':         { url: '/admin/partials/fees/form.html',                 title: 'New Fee',         init: () => {} },
    'fees-by-dept':     { url: '/admin/partials/fees/by-department.html',        title: 'Department Fees', init: call('loadDepartmentFees') },

    'payments':           { url: '/admin/partials/payments/list.html',           title: 'Payments',        init: call('loadPaymentDepartments') },
    'payment-form':       { url: '/admin/partials/payments/form.html',           title: 'New Payment',     init: () => {} },
    'payment-detail':     { url: '/admin/partials/payments/detail.html',         title: 'Payment Detail',  init: call('loadPaymentDetail') },
    'payments-by-dept':   { url: '/admin/partials/payments/by-department.html',  title: 'Department Payments', init: call('loadDepartmentPayments') },
    'payments-by-student':{ url: '/admin/partials/payments/by-student.html',     title: 'Student Payments',init: call('loadStudentPayments') },

    'clearances':         { url: '/admin/partials/clearances/list.html',         title: 'Clearances',      init: call('loadClearanceDepartments') },
    'clearances-list':    { url: '/admin/partials/clearances/index.html',        title: 'Clearances',      init: call('loadClearances') },
    'clearances-by-dept': { url: '/admin/partials/clearances/by-department.html',title: 'Department Clearances', init: call('loadDepartmentClearances') },

    // ---------- Communication ----------
    'announcements':     { url: '/admin/partials/announcements/list.html',       title: 'Announcements',   init: call('loadAnnouncements') },
    'announcement-form': { url: '/admin/partials/announcements/form.html',       title: 'New Announcement',init: () => {} },
    'announcement-detail': { url: '/admin/partials/announcements/detail.html',   title: 'Announcement',    init: () => {} },

    'notifications':          { url: '/admin/partials/notifications/index.html', title: 'Notifications',   init: call('loadNotifications') },
    'notification-compose':   { url: '/admin/partials/notifications/compose.html', title: 'Compose',       init: () => {} },
    'notification-detail':    { url: '/admin/partials/notifications/detail.html',  title: 'Notification',  init: () => {} },

    'complaints':      { url: '/admin/partials/complaints/list.html',            title: 'Complaints',      init: call('loadComplaints') },
    'complaint-view':  { url: '/admin/partials/complaints/view.html',            title: 'Complaint',       init: () => {} },

    // ---------- Library ----------
    'library':      { url: '/admin/partials/library/books.html',                 title: 'Books',           init: call('loadBooksGrid') },
    'book-form':    { url: '/admin/partials/library/book-form.html',             title: 'New Book',        init: () => {} },
    'book-detail':  { url: '/admin/partials/library/book-detail.html',           title: 'Book Detail',     init: call('loadBookDetail') },
    'borrows':      { url: '/admin/partials/library/borrows.html',               title: 'Borrows',         init: call('loadBorrowsTable') },
    'borrow-issue': { url: '/admin/partials/library/issue.html',                 title: 'Issue Book',      init: () => {} },
    'library-fines':{ url: '/admin/partials/library/fines.html',                 title: 'Fines',           init: call('loadFinesTable') },
    'library-reservations': { url: '/admin/partials/library/reservations.html',  title: 'Reservations',    init: call('loadReservationsTable') },

    // ---------- Records ----------
    'documents':        { url: '/admin/partials/documents/index.html',           title: 'Documents',       init: call('loadDocumentsTable') },
    'documents-detail': { url: '/admin/partials/documents/detail.html',          title: 'Document',        init: call('loadDocumentDetail') },
    'document-new':     { url: '/admin/partials/documents/new.html',             title: 'New Request',     init: () => {} },

    'graduation':       { url: '/admin/partials/graduations/list.html',           title: 'Graduation',      init: call('loadGraduationsTable') },
    'graduation-form':  { url: '/admin/partials/graduations/form.html',           title: 'Queue Graduand',  init: () => {} },
    'graduation-queue': { url: '/admin/partials/graduations/queue.html',          title: 'Graduation Queue',init: call('loadGraduationsTable') },

    // ---------- System ----------
    'reports':          { url: '/admin/partials/reports/index.html',             title: 'Reports',         init: call('loadReports') },
    'audit':            { url: '/admin/partials/audit/index.html',               title: 'Audit',           init: call('loadAuditTable') },
    'security':         { url: '/admin/partials/security/index.html',            title: 'Security',        init: call('loadSecurity') },
    'settings':         { url: '/admin/partials/settings/_tabs/index.html',            title: 'Settings',        init: call('loadSettingsShell') },

    // ---------- Users ----------
    'users':              { url: '/admin/partials/users/list.html',              title: 'Users',           init: call('loadUsersHub') },
    'users-all':          { url: '/admin/partials/users/all.html',               title: 'All Users',       init: call('loadAllUsers') },
    'users-admins':       { url: '/admin/partials/users/admins.html',            title: 'Admin Accounts',  init: call('loadAdminAccounts') },
    'users-with-photos':  { url: '/admin/partials/users/with-photos.html',       title: 'Photo Directory', init: call('loadUsersWithPhotos') },
    'users-login-history':{ url: '/admin/partials/users/login-history.html',     title: 'Login History',   init: call('loadLoginHistory') },
    'user-form':          { url: '/admin/partials/users/form.html',              title: 'User Form',       init: () => {} },
    'user-profile':       { url: '/admin/partials/users/profile.html',           title: 'User Profile',    init: () => {} },

    // ---------- Security sub-pages ----------
    'security-dashboard':   { url: '/admin/partials/security/dashboard.html',    title: 'Security Center', init: call('loadSecurityDashboard') },
    'security-events':      { url: '/admin/partials/security/events.html',       title: 'Security Events', init: call('loadSecurityEvents') },
    'security-sessions':    { url: '/admin/partials/security/sessions.html',     title: 'Active Sessions', init: call('loadSecuritySessions') },
    'security-logins':      { url: '/admin/partials/security/login-attempts.html', title: 'Login Attempts',init: call('loadLoginAttempts') },
    'security-ip-rules':    { url: '/admin/partials/security/ip-rules.html',     title: 'IP Rules',        init: call('loadIpRules') },
    'security-password':    { url: '/admin/partials/security/password-policy.html', title: 'Password Policy', init: call('loadPasswordPolicy') },
    'security-permissions': { url: '/admin/partials/security/permissions.html',  title: 'Permissions',     init: call('loadPermissionsMatrix') },
    'security-2fa':         { url: '/admin/partials/security/two-factor.html',   title: 'Two-Factor Auth', init: call('load2FAConfig') },
    'security-backups':     { url: '/admin/partials/security/backups.html',      title: 'Backups',         init: call('loadBackups') },
    'security-compliance':  { url: '/admin/partials/security/compliance.html',   title: 'Compliance',      init: call('loadCompliance') },
  };

  // ----------------------------------------------------------
  // ICONS
  // ----------------------------------------------------------
  const ICON = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="10" height="4" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v3l12 6V5L3 11z"/><path d="M15 8v10M18 9a4 4 0 0 1 0 6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M4.5 12a7.5 7.5 0 0 1 .1-1.2l-2-1.5 2-3.4 2.3.9a7.5 7.5 0 0 1 2-1.2l.4-2.5h4l.4 2.5a7.5 7.5 0 0 1 2 1.2l2.3-.9 2 3.4-2 1.5a7.5 7.5 0 0 1 0 2.4l2 1.5-2 3.4-2.3-.9a7.5 7.5 0 0 1-2 1.2L13 21h-4l-.4-2.5a7.5 7.5 0 0 1-2-1.2l-2.3.9-2-3.4 2-1.5A7.5 7.5 0 0 1 4.5 12z"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18"/><path d="M9 7h6M9 11h6M9 15h6"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 22l5-2 5 2-1.5-8.5"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  };

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------
  let currentPage = null;
  const cache = new Map();

  function escapeHtmlLocal(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showPartialError(view, key, err) {
    const existing = view.querySelector('.partial-error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'alert alert-warning partial-error-banner';
    banner.style.marginTop = '12px';
    banner.innerHTML = `
      <strong>⚠️ Something went wrong loading this section.</strong><br/>
      <span class="small">${escapeHtmlLocal(err && err.message ? err.message : 'Unknown error')}</span>
      <button class="btn btn-sm btn-outline" style="margin-left:12px;" data-retry>Retry</button>
    `;
    banner.querySelector('[data-retry]').addEventListener('click', () => loadPage(key));
    view.appendChild(banner);
  }

  // ----------------------------------------------------------
  // RENDER NAV
  // ----------------------------------------------------------
  function renderNav(activeKey) {
    const container = document.getElementById('sidebar-nav');
    if (!container) return;

    const navKey = NAV_ALIASES[activeKey] || activeKey;

    const items = SPA_NAV.map((it) => {
      if (it.group) return `<div class="section-title">${it.group}</div>`;
      const cls = it.key === navKey ? 'active' : '';
      return `<a class="nav-item ${cls}" data-page="${it.key}">
        <span class="icon">${ICON[it.icon] || ''}</span>
        <span class="label">${it.label}</span>
      </a>`;
    }).join('');

    container.innerHTML = items + `
      <div class="section-title">Account</div>
      <a class="nav-item" data-logout="1">
        <span class="icon">${ICON.logout}</span>
        <span class="label">Sign out</span>
      </a>`;

    container.querySelectorAll('[data-page]').forEach((el) => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    const logoutLink = container.querySelector('[data-logout]');
    if (logoutLink) logoutLink.addEventListener('click', performLogout);
  }

  // ----------------------------------------------------------
  // SCRIPT EXECUTOR
  // ----------------------------------------------------------
  function executePartialScripts(view) {
    if (window.FPU_EXECUTE_PARTIAL_SCRIPTS) {
      window.FPU_EXECUTE_PARTIAL_SCRIPTS(view);
      return;
    }
    view.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      if (old.src) s.src = old.src;
      else s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }

  // ----------------------------------------------------------
  // LOAD A PAGE
  // ----------------------------------------------------------
  async function loadPage(key) {
    let queryString = '';
    if (key && key.includes('?')) {
      const qIdx = key.indexOf('?');
      queryString = key.slice(qIdx + 1);
      key = key.slice(0, qIdx);
    }
    const fullHash = queryString ? `${key}?${queryString}` : key;

    const cfg = SPA_PAGES[key] || SPA_PAGES.dashboard;
    const view = document.getElementById('page-view');
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');

    if (!view) return;
    if (titleEl) titleEl.textContent = cfg.title;
    if (subEl) subEl.textContent = '';

    view.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
    renderNav(key);
    window.location.hash = `#${fullHash}`;
    currentPage = fullHash;

    try {
      let html;
      if (cache.has(cfg.url)) {
        html = cache.get(cfg.url);
      } else {
        const res = await fetch(cfg.url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`Partial not found: ${cfg.url} (HTTP ${res.status})`);
        html = await res.text();
        cache.set(cfg.url, html);
      }

      view.innerHTML = html;
      executePartialScripts(view);

      if (typeof cfg.init === 'function') {
        try {
          const result = cfg.init();
          if (result && typeof result.catch === 'function') {
            result.catch((e) => {
              console.error('[admin-spa] init promise rejected for', key, e);
              showPartialError(view, key, e);
            });
          }
        } catch (e) {
          console.error('[admin-spa] init threw for', key, e);
          showPartialError(view, key, e);
        }
      }
    } catch (err) {
      console.error('[admin-spa] loadPage error:', err);
      view.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Could not load page "<strong>${escapeHtmlLocal(key)}</strong>".</p><p class="small muted" style="margin-top:10px;">${escapeHtmlLocal(err.message)}</p></div>`;
    }
  }

  function navigateTo(key) {
    loadPage(key);
  }

  function navigateToWithQuery(key, queryObj) {
    const qs = new URLSearchParams(queryObj).toString();
    loadPage(`${key}?${qs}`);
  }

  // ----------------------------------------------------------
  // SIDEBAR TOGGLE
  // ----------------------------------------------------------
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.toggle('sidebar-open');
    }
  }

  // ----------------------------------------------------------
  // PENDING BADGE
  // ----------------------------------------------------------
  async function updatePendingBadge() {
    try {
      const res = await A.adminFetch('/api/admin/reports/overview');
      const json = await res.json();
      if (!json.success) return;
      const d = json.data || json.stats || json;
      const total = (d.pendingApplications || 0) + (d.pendingResults || 0) + (d.pendingPayments || 0);
      const el = document.getElementById('pending-badge');
      if (el) {
        el.textContent = total;
        el.style.display = total > 0 ? 'inline-flex' : 'none';
      }
    } catch { /* ignore */ }
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function initSPA() {
    const token = getToken();
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    const user = getUser();
    if (user) {
      const nameEl = document.getElementById('topbar-name');
      const roleEl = document.getElementById('topbar-role');
      const avatar = document.getElementById('topbar-avatar');
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin';
      if (nameEl && !nameEl.textContent.trim()) nameEl.textContent = fullName;
      if (roleEl && !roleEl.textContent.trim()) {
        roleEl.textContent = String(user.role || 'admin').replace(/_/g, ' ');
      }
      if (avatar && user.photoUrl) {
        avatar.innerHTML = `<img src="${user.photoUrl}" alt="" />`;
      } else if (avatar && !avatar.textContent.trim()) {
        const initials = (
          (user.firstName || '')[0] || (user.email || '')[0] || 'A'
        ).toUpperCase() + ((user.lastName || '')[0] || '').toUpperCase();
        avatar.textContent = initials || 'A';
      }
    }

    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.addEventListener('click', toggleSidebar);

    window.addEventListener('hashchange', () => {
      const rawKey = window.location.hash.replace('#', '');
      const key = rawKey.split('?')[0];
      const currentKey = currentPage ? currentPage.split('?')[0] : null;
      if (key && key !== currentKey) loadPage(rawKey);
    });

    const initial = window.location.hash.replace('#', '') || 'dashboard';
    currentPage = initial;
    loadPage(initial);

    updatePendingBadge();
    setInterval(updatePendingBadge, 60_000);
  }

  // ----------------------------------------------------------
  // EXPORTS
  // ----------------------------------------------------------
  window.FPU_ADMIN_SPA = {
    SPA_NAV, SPA_PAGES, NAV_ALIASES,
    initSPA, navigateTo, navigateToWithQuery, loadPage, renderNav,
    toggleSidebar, updatePendingBadge,
    performLogout,
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body && document.body.classList.contains('admin-app') && document.getElementById('page-view')) {
      initSPA();
    }
  });
})();