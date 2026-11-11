/* ============================================================
   FPU Portal — SPA shell
   ============================================================ */

(function () {
  'use strict';

  const core = window.FPU_PORTAL || {};

  // ----------------------------------------------------------
  // ICONS
  // ----------------------------------------------------------
  const ICON = {
    dash:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>',
    photo:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    book:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M18 4v16"/></svg>',
    clipboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="10" height="4" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>',
    chart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    money:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    mail:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    bell:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    megaphone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v3l12 6V5L3 11z"/><path d="M15 8v10M18 9a4 4 0 0 1 0 6"/></svg>',
    shield:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>',
    chat:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>',
    users:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><circle cx="17" cy="8" r="3"/><path d="M15 20a5 5 0 0 1 6-5"/></svg>',
    book2:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v6h6"/></svg>',
    award:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 22l5-2 5 2-1.5-8.5"/></svg>',
    file:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    idcard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="12" r="2"/><path d="M13 10h5M13 14h5"/></svg>',
    library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17 5l3 15"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>',
    logout:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  };

  // ----------------------------------------------------------
  // SHARED PAGES
  // ----------------------------------------------------------
  const SHARED_PAGES = [
    { key: 'portal-profile',          label: 'My Profile',     icon: ICON.user },
    { key: 'portal-photo',            label: 'My Photo',       icon: ICON.photo },
    { key: 'portal-messages',         label: 'Messages',       icon: ICON.chat },
    { key: 'portal-notifications',    label: 'Notifications',  icon: ICON.bell },
    { key: 'portal-announcements',    label: 'Announcements',  icon: ICON.megaphone },
    { key: 'portal-complaints',       label: 'Complaints',     icon: ICON.chat },
    { key: 'portal-security',         label: 'Security',       icon: ICON.shield },

    { key: 'admin-applications-list', label: 'Applications',   icon: ICON.clipboard },
    { key: 'admin-admitted',          label: 'Admitted',       icon: ICON.check },
    { key: 'admin-audit',             label: 'Audit Log',      icon: ICON.shield },
    { key: 'admin-borrows',           label: 'Borrows',        icon: ICON.book },
    { key: 'admin-courses',           label: 'Courses',        icon: ICON.book },
    { key: 'admin-documents',         label: 'Documents',      icon: ICON.file },
    { key: 'admin-id-cards',          label: 'ID Cards',        icon: ICON.idcard },
    { key: 'portal-id-card',           label: 'My ID Card',       icon: ICON.idcard },
    { key: 'admin-exams',             label: 'Exams',          icon: ICON.clipboard },
    { key: 'admin-graduations',       label: 'Graduations',    icon: ICON.award },
    { key: 'admin-library',           label: 'Library',        icon: ICON.library },
    { key: 'admin-programmes',        label: 'Programmes',     icon: ICON.book2 },
    { key: 'admin-sessions',          label: 'Sessions',       icon: ICON.calendar },
    { key: 'admin-settings',          label: 'Settings',       icon: ICON.settings },
    { key: 'admin-transcript',        label: 'Transcript',     icon: ICON.file },
    { key: 'admin-users',             label: 'Users',          icon: ICON.users },
  ];

  // ----------------------------------------------------------
  // ROLE-AWARE SHARED MENUS
  // ----------------------------------------------------------
  const SHARED_BY_ROLE = {
    student: [
      'portal-profile', 'portal-photo', 'portal-notifications',
      'portal-announcements', 'portal-complaints', 'portal-security',
    ],
    lecturer: [
      'portal-profile', 'portal-photo', 'portal-id-card', 'portal-notifications', 'portal-announcements',
    ],
    hod: [
      'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
    ],
    bursar: [
      'bursar-dashboard', 'bursar-payments', 'bursar-fees', 'bursar-clearances',
      'bursar-reports', 'bursar-documents', 'bursar-transcripts',
      'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-documents', 'admin-transcript',
    ],
    rector: [
      'admin-id-cards', 'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'portal-complaints',
      'admin-audit', 'admin-transcript',
    ],
    registrar: [
      'admin-admitted', 'admin-documents', 'admin-transcript',
      'admin-id-cards', 'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements', 'admin-transcript',
    ],
    librarian: [
      'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-library', 'admin-borrows',
    ],
    exam_officer: [
      'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-exams', 'admin-courses',
    ],
    academic_officer: [
      'admin-id-cards', 'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-programmes', 'admin-courses', 'admin-sessions', 'admin-exams',
    ],
    admission_officer: [
      'portal-profile', 'portal-photo', 'portal-id-card', 'portal-messages',
      'portal-notifications', 'portal-announcements',
    ],
    admin:      '*',
    superadmin: '*',
  };

  // ----------------------------------------------------------
  // GROUP DEFINITIONS
  // ----------------------------------------------------------
  const MENU_GROUPS_BY_ROLE = {
    registrar: (role, roleItems, sharedItems) => {
      const mainKeys = [
        'registrar-dashboard', 
        'registrar-students', 
        'registrar-sessions', 
        'registrar-programmes', 
        'registrar-registrations'
      ];
      
      const registryKeys = ['admin-admitted', 'admin-documents', 'admin-transcript']; 
      
      const mainItems = roleItems.filter((it) => mainKeys.includes(it.key));
      
      const customRegistry = roleItems.filter((it) => ['registrar-applications', 'registrar-graduations', 'registrar-clearances'].includes(it.key));
      
      const registryItems = [
        ...customRegistry,
        ...sharedItems.filter((p) => registryKeys.includes(p.key))
      ];
      
      const personalItems = sharedItems.filter((p) => !registryKeys.includes(p.key));

      return [
        { title: 'Main',     items: mainItems },
        { title: 'Registry', items: registryItems },
        { title: 'Personal', items: personalItems },
      ];
    },
    lecturer: (role, roleItems, sharedItems) => {
      const personalKeys = ['portal-profile', 'portal-photo', 'portal-notifications', 'portal-announcements'];

      return [
        { title: 'Main',       items: roleItems },
        { title: 'Personal',   items: sharedItems.filter((p) => personalKeys.includes(p.key)) },
      ];
    },
    default: (role, roleItems, sharedItems) => [
      { title: 'Main',   items: roleItems },
      { title: 'Shared', items: sharedItems },
    ],
  };

  // ----------------------------------------------------------
  // Role-specific MAIN sidebars
  // ----------------------------------------------------------
  const PORTAL_SIDEBAR = {
    student: [
      { key: 'student-dashboard',      label: 'Dashboard',          icon: ICON.dash },
      { key: 'student-registration',   label: 'Course Registration', icon: ICON.clipboard },
      { key: 'student-results',        label: 'Results',             icon: ICON.chart },
      { key: 'student-transcript',     label: 'Transcript',          icon: ICON.file },
      { key: 'student-timetable',      label: 'Timetable',           icon: ICON.calendar },
      { key: 'student-exams',          label: 'Exam Schedule',       icon: ICON.clipboard },
      { key: 'student-attendance',     label: 'Attendance',          icon: ICON.check },
      { key: 'student-materials',      label: 'Materials',           icon: ICON.book },
      { key: 'student-assignments',    label: 'Assignments',         icon: ICON.book2 },
      { key: 'student-fees',           label: 'Fees',                icon: ICON.money },
      { key: 'student-clearance',      label: 'Clearance',           icon: ICON.check },
      { key: 'student-documents',      label: 'Documents',           icon: ICON.file },
      { key: 'student-id-card',        label: 'ID Card',             icon: ICON.idcard },
      { key: 'student-graduation',     label: 'Graduation',          icon: ICON.award },
      { key: 'student-library',        label: 'Library',             icon: ICON.library },
    ],
    lecturer: [
      { key: 'lecturer-dashboard',   label: 'Dashboard',   icon: ICON.dash },
      { key: 'lecturer-courses',     label: 'My Courses',  icon: ICON.book },
      { key: 'lecturer-students',    label: 'Students',    icon: ICON.users },
      { key: 'lecturer-timetable',   label: 'Timetable',   icon: ICON.calendar },
      { key: 'lecturer-attendance',  label: 'Attendance',  icon: ICON.check },
      { key: 'lecturer-results',     label: 'Results',     icon: ICON.chart },
      { key: 'lecturer-materials',   label: 'Materials',   icon: ICON.book },
      { key: 'lecturer-assignments', label: 'Assignments', icon: ICON.book2 },
      { key: 'lecturer-exams',       label: 'Exams',       icon: ICON.clipboard },
      { key: 'lecturer-requests',    label: 'Requests',    icon: ICON.chat },
      { key: 'lecturer-reports',     label: 'Reports',     icon: ICON.chart },
      { key: 'lecturer-messages',    label: 'Messages',    icon: ICON.chat },
    ],
    hod: [
      { key: 'hod-dashboard',        label: 'Dashboard',       icon: ICON.dash },
      { key: 'hod-pending-results',  label: 'Pending Results', icon: ICON.clipboard },
      { key: 'hod-courses',          label: 'Courses',         icon: ICON.book },
      { key: 'hod-allocations',      label: 'Allocations',     icon: ICON.users },
      { key: 'hod-history',          label: 'History',         icon: ICON.calendar },
      { key: 'hod-students',         label: 'Students',        icon: ICON.users },
      { key: 'hod-staff',            label: 'Staff',           icon: ICON.users },
      { key: 'hod-exams',            label: 'Exams',           icon: ICON.clipboard },
      { key: 'lecture-timetable',    label: 'Lecture Timetable', icon: ICON.calendar }, // <-- ADDED THIS LINE
      { key: 'hod-results',          label: 'Results Entry',   icon: ICON.chart },
      { key: 'hod-transcript',       label: 'Transcript',      icon: ICON.file }, 
      { key: 'hod-reports',          label: 'Department Reports', icon: ICON.chart },
    ],
    bursar: [
      { key: 'bursar-dashboard',  label: 'Dashboard',  icon: ICON.dash },
      { key: 'bursar-payments',   label: 'Payments',   icon: ICON.money },
      { key: 'bursar-fees',       label: 'Fees',       icon: ICON.money },
      { key: 'bursar-clearances', label: 'Clearances', icon: ICON.check },
      { key: 'bursar-reports',    label: 'Reports',    icon: ICON.chart },
      { key: 'bursar-documents',  label: 'Document Requests', icon: ICON.file },
      { key: 'bursar-transcripts', label: 'Transcript Register', icon: ICON.book },
    ],
    rector: [
      { key: 'rector-dashboard',    label: 'Dashboard',    icon: ICON.dash },
      { key: 'rector-students',     label: 'Students',     icon: ICON.users },
      { key: 'rector-staff',        label: 'Staff Directory', icon: ICON.user },
      { key: 'rector-applications', label: 'Applications Overview', icon: ICON.clipboard },
      { key: 'rector-graduation',   label: 'Graduation Pipeline', icon: ICON.award },
      { key: 'rector-reports',      label: 'Executive Reports', icon: ICON.chart },
    ],
    registrar: [
      { key: 'registrar-dashboard',       label: 'Dashboard',       icon: ICON.dash },
      { key: 'registrar-students',        label: 'Students',        icon: ICON.users },
      { key: 'registrar-sessions',        label: 'Sessions',        icon: ICON.calendar },
      { key: 'registrar-programmes',      label: 'Programmes',      icon: ICON.book2 },
      { key: 'registrar-registrations',   label: 'Registrations',   icon: ICON.clipboard },
      { key: 'registrar-applications',    label: 'Applications',    icon: ICON.file }, 
      { key: 'registrar-clearances',      label: 'Clearances',      icon: ICON.check },
      { key: 'registrar-graduations',     label: 'Graduations',     icon: ICON.award },
    ],
    librarian: [
      { key: 'librarian-dashboard',    label: 'Dashboard',    icon: ICON.dash },
      { key: 'librarian-books',        label: 'Books',        icon: ICON.book },
      { key: 'librarian-borrows',      label: 'Borrows',      icon: ICON.book },
      { key: 'librarian-reservations', label: 'Reservations', icon: ICON.book },
      { key: 'librarian-fines',        label: 'Fines',        icon: ICON.money },
      { key: 'librarian-reports',      label: 'Library Reports', icon: ICON.chart },
    ],
    exam_officer: [
      { key: 'exam-officer-dashboard',   label: 'Dashboard',   icon: ICON.dash },
      { key: 'exam-officer-attendance',  label: 'Attendance',  icon: ICON.check },
      { key: 'exam-officer-eligibility', label: 'Eligibility', icon: ICON.users },
      { key: 'exam-officer-publish',     label: 'Publish Results', icon: ICON.file }, 
      { key: 'exam-officer-schedules',   label: 'Exam Schedules', icon: ICON.calendar },
      { key: 'exam-officer-reports',     label: 'Examination Reports', icon: ICON.chart },
    ],
    academic_officer: [
      { key: 'academic-officer-dashboard', label: 'Dashboard', icon: ICON.dash },
      { key: 'academic-officer-sessions', label: 'Academic Sessions', icon: ICON.calendar },
      { key: 'academic-officer-programmes', label: 'Programmes', icon: ICON.book2 },
      { key: 'academic-officer-departments', label: 'Departments', icon: ICON.users },
      { key: 'academic-officer-courses', label: 'Course Catalogue', icon: ICON.book },
      { key: 'academic-officer-results', label: 'Published Results', icon: ICON.chart },
      { key: 'academic-officer-transcripts', label: 'Transcript Lookup', icon: ICON.file },
      { key: 'academic-officer-graduation', label: 'Graduation Pipeline', icon: ICON.award },
      { key: 'academic-officer-reports', label: 'Academic Reports', icon: ICON.clipboard },
    ],
    admission_officer: [
      { key: 'admission-officer-dashboard',    label: 'Dashboard',    icon: ICON.dash },
      { key: 'admission-officer-applications', label: 'Applications', icon: ICON.clipboard },
      { key: 'admission-officer-admitted',     label: 'Admitted',     icon: ICON.check },
      { key: 'admission-officer-letters',      label: 'Letters',      icon: ICON.file },
      { key: 'admission-officer-reports',      label: 'Admission Reports', icon: ICON.chart },
    ],
    admin:      [{ key: 'superadmin-dashboard', label: 'Dashboard', icon: ICON.dash }],
    superadmin: [{ key: 'superadmin-dashboard', label: 'Dashboard', icon: ICON.dash }],
  };

  // ----------------------------------------------------------
  // Role → folder, DASHBOARD_CONFIG, FILE_MAP
  // ----------------------------------------------------------
  const ROLE_FOLDER = {
    student: 'student', lecturer: 'lecturer', hod: 'hod', bursar: 'bursar',
    rector: 'rector', registrar: 'registrar', librarian: 'librarian',
    exam_officer: 'exam-officer', academic_officer: 'academic-officer',
    admission_officer: 'admission-officer', admin: 'superadmin', superadmin: 'superadmin',
  };

  const DASHBOARD_CONFIG = {
    student: 'student-dashboard', lecturer: 'lecturer-dashboard', hod: 'hod-dashboard',
    bursar: 'bursar-dashboard', rector: 'rector-dashboard', registrar: 'registrar-dashboard',
    librarian: 'librarian-dashboard', exam_officer: 'exam-officer-dashboard',
    academic_officer: 'academic-officer-dashboard', admission_officer: 'admission-officer-dashboard',
    admin: 'superadmin-dashboard', superadmin: 'superadmin-dashboard',
  };

  const SHARED_FILE_MAP = {
    'portal-profile': 'profile', 'portal-photo': 'photo', 'portal-messages': 'messages',
    'portal-notifications': 'notifications', 'portal-announcements': 'announcements',
    'portal-complaints': 'complaints', 'portal-security': 'security',
    'admin-applications-list': 'admin-applications-list',
    'admin-admitted': 'admin-admitted', 'admin-audit': 'admin-audit',
    'admin-borrows': 'admin-borrows', 'admin-courses': 'admin-courses',
    'admin-documents': 'admin-documents', 'admin-exams': 'admin-exams',
    'admin-graduations': 'admin-graduations', 'admin-library': 'admin-library',
    'admin-programmes': 'admin-programmes', 'admin-sessions': 'admin-sessions',
    'admin-settings': 'admin-settings', 'admin-transcript': 'admin-transcript',
    'admin-users': 'admin-users',
  };

  const PORTAL_TITLES = {};
  Object.values(PORTAL_SIDEBAR).forEach((list) => {
    list.forEach((item) => { PORTAL_TITLES[item.key] = item.label; });
  });
  SHARED_PAGES.forEach((item) => { PORTAL_TITLES[item.key] = item.label; });

  function getSharedItemsForRole(role) {
    const allowed = SHARED_BY_ROLE[role];
    if (allowed === '*') return SHARED_PAGES;
    if (!Array.isArray(allowed)) return [];
    return SHARED_PAGES.filter((p) => allowed.includes(p.key));
  }

  function resolvePageConfig(pageKey) {
    const cleanKey = String(pageKey || '').split('?')[0];
    const user = core.getPortalUser && core.getPortalUser();
    if (!user) return null;
    
    const role = user.role;
    if (cleanKey === 'registrar-student-profile') {
      if (!['registrar', 'admin', 'superadmin'].includes(role)) {
        return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
      }
      return {
        url: '/portal/partials/registrar/student-profile.html',
        title: 'Student Profile'
      };
    }
    if (role === 'registrar') {
      const registrarPages = {
        'admin-admitted': { url: '/portal/partials/registrar/admitted.html', title: 'Admitted Students' },
        'admin-documents': { url: '/portal/partials/registrar/documents.html', title: 'Documents & Certificates' },
        'admin-transcript': { url: '/portal/partials/registrar/transcripts.html', title: 'Transcript Register' },
        'admin-id-cards': { url: '/portal/partials/shared/admin-id-cards.html', title: 'Student & Staff ID Cards' },
      };
      if (registrarPages[cleanKey]) return registrarPages[cleanKey];
    }

    const folder = ROLE_FOLDER[role] || 'shared';

    const adminOnly = ['admin-settings', 'admin-users'];
    if (adminOnly.includes(cleanKey) && role !== 'admin' && role !== 'superadmin') {
      return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
    }

    if (cleanKey === 'admin-audit' && !['admin', 'superadmin', 'rector'].includes(role)) {
      return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
    }

    const roleList = PORTAL_SIDEBAR[role] || [];
    const roleItem = roleList.find((p) => p.key === cleanKey);
    if (roleItem) {
      const file = cleanKey
        .replace(/^exam-officer-/, '')
        .replace(/^academic-officer-/, '')
        .replace(/^admission-officer-/, '')
        .replace(/^superadmin-/, '')
        .replace(/^bursar-/, '')
        .replace(/^rector-/, '')
        .replace(/^registrar-/, '')
        .replace(/^librarian-/, '')
        .replace(/^hod-/, '')
        .replace(/^lecturer-/, '')
        .replace(/^student-/, '');

      // Special fix for lecture-timetable so it doesn't look for "lecture-timetable.html" if key doesn't have prefix
      let finalFile = file;
      if (cleanKey === 'lecture-timetable') {
        finalFile = 'lecture-timetable';
      }

      const candidates = [
        `${finalFile}.html`,
        `${cleanKey}.html`,
      ];
      return {
        url: `/portal/partials/${folder}/${candidates[0]}`,
        fallbackUrl: `/portal/partials/${folder}/${candidates[1]}`,
        title: roleItem.label,
      };
    }

    const sharedPage = SHARED_PAGES.find((p) => p.key === cleanKey);
    if (sharedPage) {
      const allowedSharedPage = getSharedItemsForRole(role).some((p) => p.key === cleanKey);
      if (!allowedSharedPage) {
        return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
      }
      const file = SHARED_FILE_MAP[cleanKey] || cleanKey;
      return {
        url: `/portal/partials/shared/${file}.html`,
        title: PORTAL_TITLES[cleanKey] || cleanKey.replace(/-/g, ' '),
      };
    }

    // Permit only role-owned detail pages and explicitly registered special pages.
    // Never let an unregistered admin-* key fall through to an arbitrary partial.
    const rolePrefix = role.replace(/_/g, '-') + '-';
    const isRoleOwnedPage = cleanKey.startsWith(rolePrefix);
    const isHodTimetable = role === 'hod' && cleanKey === 'lecture-timetable';
    if (isRoleOwnedPage || isHodTimetable) {
      return { url: `/portal/partials/${folder}/${cleanKey}.html`, title: cleanKey.replace(/-/g, ' ') };
    }

    return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
  }

  function renderSidebar(activeKey) {
    const user = core.getPortalUser && core.getPortalUser();
    if (!user) return;
    const role = user.role;

    const container = document.getElementById('sidebar-nav');
    if (!container) return;

    const roleItems = PORTAL_SIDEBAR[role] || [];
    const sharedItems = getSharedItemsForRole(role);

    const groupFn = MENU_GROUPS_BY_ROLE[role] || MENU_GROUPS_BY_ROLE.default;
    const groups = groupFn(role, roleItems, sharedItems);

    const buildGroup = (title, items) => {
      if (!items.length) return '';
      return `
        <div class="section-title">${title}</div>
        ${items.map((it) => `
          <a class="nav-item ${it.key === activeKey ? 'active' : ''}" data-page="${it.key}">
            <span class="icon">${it.icon}</span>
            <span class="label">${it.label}</span>
          </a>`).join('')}`;
    };

    container.innerHTML = `
      ${groups.map((g) => buildGroup(g.title, g.items)).join('')}
      <div class="section-title">Account</div>
      <a class="nav-item" data-logout="1">
        <span class="icon">${ICON.logout}</span>
        <span class="label">Sign out</span>
      </a>`;

    container.querySelectorAll('[data-page]').forEach((el) => {
      el.addEventListener('click', () => navigatePortal(el.dataset.page));
    });
    const logout = container.querySelector('[data-logout]');
    if (logout) logout.addEventListener('click', () => core.portalLogout());
  }

  function executePartialScripts(view) {
    if (window.FPU_EXECUTE_PARTIAL_SCRIPTS) {
      window.FPU_EXECUTE_PARTIAL_SCRIPTS(view);
      return;
    }
    view.querySelectorAll('script').forEach((old) => {
      try {
        const s = document.createElement('script');
        if (old.src) {
          s.src = old.src;
        } else {
          s.textContent = String(old.textContent || '');
        }
        if (old.parentNode) {
          old.parentNode.replaceChild(s, old);
        }
      } catch (err) {
        console.warn('[portal-spa] script inject failed:', err && err.message);
      }
    });
  }

  let lastRequestedPageKey = '';
  let activeLoadId = 0;
  const partialHtmlCache = new Map();
  let registrarPrefetchStarted = false;

  async function loadPage(pageKey) {
    const requestId = ++activeLoadId;
    lastRequestedPageKey = pageKey;
    const cfg = resolvePageConfig(pageKey);
    if (!cfg) return;

    const view = document.getElementById('page-view');
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const topbar = document.getElementById('topbar-title');
    if (!view) return;

    if (titleEl) titleEl.textContent = cfg.title;
    if (topbar) topbar.textContent = cfg.title;
    if (subtitleEl) subtitleEl.textContent = '';

    view.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
    renderSidebar(pageKey);
    if (window.location.hash !== `#${pageKey}`) window.location.hash = `#${pageKey}`;

    try {
      let html = partialHtmlCache.get(cfg.url);
      if (!html) {
        let res = await fetch(cfg.url, { cache: 'no-cache' });
        if (!res.ok && cfg.fallbackUrl && cfg.fallbackUrl !== cfg.url) {
          res = await fetch(cfg.fallbackUrl, { cache: 'no-cache' });
          if (res.ok) { html = await res.text(); partialHtmlCache.set(cfg.fallbackUrl, html); }
        }
        if (!res.ok) throw new Error('Partial not found: ' + cfg.url);
        if (!html) html = await res.text();
        partialHtmlCache.set(cfg.url, html);
      }
      if (requestId !== activeLoadId) return;
      view.innerHTML = html;
      executePartialScripts(view);
      if (core.getPortalUser && core.getPortalUser()?.role === 'registrar' && !registrarPrefetchStarted) {
        registrarPrefetchStarted = true;
        setTimeout(prefetchRegistrarPages, 0);
      }
    } catch (err) {
      if (requestId !== activeLoadId) return;
      console.error('[portal-spa] load error:', err);
      view.innerHTML = `<div class="panel"><div class="panel-body">
        <div class="alert alert-error">Failed to load this page: ${err.message}</div>
      </div></div>`;
      core.showToast && core.showToast(err.message, 'error');
    }
  }

  function prefetchRegistrarPages() {
    const user = core.getPortalUser && core.getPortalUser();
    if (!user || user.role !== 'registrar') return;
    const keys = ['registrar-students','registrar-sessions','registrar-programmes','registrar-registrations','registrar-applications','registrar-clearances','registrar-graduations','admin-admitted','admin-documents','admin-transcript','admin-id-cards','portal-id-card','portal-profile','portal-photo','portal-messages','portal-notifications','portal-announcements','portal-security'];
    keys.forEach((key) => {
      const cfg = resolvePageConfig(key);
      if (!cfg || partialHtmlCache.has(cfg.url)) return;
      fetch(cfg.url, { cache: 'no-cache' }).then(async (res) => {
        if (!res.ok && cfg.fallbackUrl) res = await fetch(cfg.fallbackUrl, { cache: 'no-cache' });
        if (!res.ok) return;
        const html = await res.text();
        partialHtmlCache.set(cfg.url, html);
      }).catch(() => {});
    });
  }

  function navigatePortal(pageKey) {
    if (window.innerWidth < 900) core.closeSidebar && core.closeSidebar();
    return loadPage(pageKey);
  }

  function initUserDropdown() {
    const chip = document.getElementById('topbar-user-chip');
    const menu = document.getElementById('topbar-user-menu');
    if (!chip || !menu) return;

    const user = core.getPortalUser ? core.getPortalUser() : {};
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('user-menu-name', user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.email || 'User'));
    set('user-menu-email', user.email || '');

    ['user-menu-avatar', 'topbar-avatar'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (window.FPU_PHOTO && window.FPU_PHOTO.renderMyAvatar) {
        window.FPU_PHOTO.renderMyAvatar(el, user);
      } else {
        el.textContent = (user.firstName || 'U')[0].toUpperCase();
      }
    });

    function closeMenu() {
      menu.hidden = true;
      chip.setAttribute('aria-expanded', 'false');
    }
    function openMenu() {
      menu.hidden = false;
      chip.setAttribute('aria-expanded', 'true');
    }

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu(); else closeMenu();
    });

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && !chip.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
    });

    menu.querySelectorAll('[data-menu]').forEach((item) => {
      item.addEventListener('click', () => {
        closeMenu();
        const action = item.dataset.menu;
        if (action === 'profile')        navigatePortal('portal-profile');
        else if (action === 'photo')     navigatePortal('portal-photo');
        else if (action === 'password')  navigatePortal('portal-security');
        else if (action === 'notifications') navigatePortal('portal-notifications');
        else if (action === 'logout')    core.portalLogout && core.portalLogout();
      });
    });
  }

  function initPortalSPA() {
    if (!core.getToken || !core.getToken()) {
      window.location.replace('/login.html');
      return;
    }

    const user = core.getPortalUser && core.getPortalUser();
    if (!user) {
      window.location.replace('/login.html');
      return;
    }

    const role = user.role;

    const titleEl = document.getElementById('topbar-title');
    const roleEl = document.getElementById('topbar-role');
    const nameEl = document.getElementById('topbar-name');
    const avatarEl = document.getElementById('topbar-avatar');
    if (roleEl) roleEl.textContent = role;
    if (nameEl) nameEl.textContent = user.firstName || user.email || 'User';
    if (titleEl) titleEl.textContent = 'Dashboard';
    if (avatarEl && !avatarEl.style.backgroundImage) {
      avatarEl.textContent = (user.firstName || 'U')[0].toUpperCase();
    }
    if (window.FPU_PHOTO && window.FPU_PHOTO.renderMyAvatar && avatarEl) {
      window.FPU_PHOTO.renderMyAvatar(avatarEl, user);
    }

    initUserDropdown();

    const logoutBtn = document.getElementById('topbar-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => core.portalLogout && core.portalLogout());

    const landing = DASHBOARD_CONFIG[role] || 'portal-profile';
    const hash = (window.location.hash || '').replace(/^#/, '');
    loadPage(hash || landing);

    window.addEventListener('hashchange', () => {
      const h = (window.location.hash || '').replace(/^#/, '');
      if (h && h !== lastRequestedPageKey) loadPage(h);
    });
  }

  window.FPU_SPA = { navigatePortal, loadPage, renderSidebar, resolvePageConfig };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortalSPA);
  } else {
    initPortalSPA();
  }
})();