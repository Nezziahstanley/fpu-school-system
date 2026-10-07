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
    dash:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>',
    photo:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    book:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M18 4v16"/></svg>',
    clipboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="10" height="4" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>',
    chart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    money:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    mail:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    bell:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    megaphone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v3l12 6V5L3 11z"/><path d="M15 8v10M18 9a4 4 0 0 1 0 6"/></svg>',
    shield:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>',
    chat:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>',
    building:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18"/><path d="M9 7h6M9 11h6M9 15h6"/></svg>',
    users:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><circle cx="17" cy="8" r="3"/><path d="M15 20a5 5 0 0 1 6-5"/></svg>',
    book2:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v6h6"/></svg>',
    award:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 22l5-2 5 2-1.5-8.5"/></svg>',
    lock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    file:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    idcard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="12" r="2"/><path d="M13 10h5M13 14h5"/></svg>',
    library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17 5l3 15"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    logout:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  };

  // ----------------------------------------------------------
  // SHARED PAGES — available to every role (visibility filtered)
  // ----------------------------------------------------------
  const SHARED_PAGES = [
    // Personal
    { key: 'portal-profile',       label: 'My Profile',     icon: ICON.user },
    { key: 'portal-photo',         label: 'My Photo',       icon: ICON.photo },
    { key: 'portal-messages',      label: 'Messages',       icon: ICON.chat },
    { key: 'portal-notifications', label: 'Notifications',  icon: ICON.bell },
    { key: 'portal-announcements', label: 'Announcements',  icon: ICON.megaphone },
    { key: 'portal-complaints',    label: 'Complaints',     icon: ICON.chat },
    { key: 'portal-security',      label: 'Security',       icon: ICON.shield },

    // Staff-facing shared pages (admin-* prefix)
    { key: 'admin-applications-list', label: 'Applications', icon: ICON.clipboard },
    { key: 'admin-audit',             label: 'Audit Log',    icon: ICON.shield },
    { key: 'admin-borrows',           label: 'Borrows',      icon: ICON.book },
    { key: 'admin-courses',           label: 'Courses',      icon: ICON.book },
    { key: 'admin-documents',         label: 'Documents',    icon: ICON.file },
    { key: 'admin-exams',             label: 'Exams',        icon: ICON.clipboard },
    { key: 'admin-graduations',       label: 'Graduations',  icon: ICON.award },
    { key: 'admin-library',           label: 'Library',      icon: ICON.library },
    { key: 'admin-programmes',        label: 'Programmes',   icon: ICON.book2 },
    { key: 'admin-sessions',          label: 'Sessions',     icon: ICON.calendar },
    { key: 'admin-settings',          label: 'Settings',     icon: ICON.settings },
    { key: 'admin-transcript',        label: 'Transcript',   icon: ICON.file },
    { key: 'admin-users',             label: 'Users',        icon: ICON.users },
  ];

  // ----------------------------------------------------------
  // ROLE-AWARE SHARED PAGES
  // ----------------------------------------------------------
  // '*' = every shared page (admin only)
  const SHARED_BY_ROLE = {
    student: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'portal-complaints', 'portal-security',
    ],
    lecturer: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'portal-complaints', 'portal-security',
      'admin-exams', 'admin-courses', 'admin-documents',
    ],
    hod: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-exams', 'admin-courses', 'admin-programmes',
      'admin-sessions', 'admin-transcript',
    ],
    bursar: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-documents', 'admin-transcript',
    ],
    rector: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-audit', 'admin-transcript',
    ],
    registrar: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-applications-list', 'admin-graduations',
      'admin-sessions', 'admin-programmes',
      'admin-transcript', 'admin-documents',
    ],
    librarian: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-library', 'admin-borrows',
    ],
    exam_officer: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-exams', 'admin-courses',
    ],
    academic_officer: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-programmes', 'admin-courses',
      'admin-sessions', 'admin-exams',
    ],
    admission_officer: [
      'portal-profile', 'portal-photo', 'portal-messages',
      'portal-notifications', 'portal-announcements',
      'admin-applications-list', 'admin-graduations',
      'admin-documents',
    ],
    admin:      '*',
    superadmin: '*',
  };

  function getSharedItemsForRole(role) {
    const allowed = SHARED_BY_ROLE[role];
    if (allowed === '*') return SHARED_PAGES;
    if (!Array.isArray(allowed)) return [];
    return SHARED_PAGES.filter((p) => allowed.includes(p.key));
  }

  // ----------------------------------------------------------
  // Role-specific sidebars
  // ----------------------------------------------------------
  const PORTAL_SIDEBAR = {
    student: [
      { key: 'student-dashboard',     label: 'Dashboard',           icon: ICON.dash },
      { key: 'student-registration',  label: 'Course Registration', icon: ICON.clipboard },
      { key: 'student-results',       label: 'Results',             icon: ICON.chart },
      { key: 'student-transcript',    label: 'Transcript',          icon: ICON.file },
      { key: 'student-timetable',     label: 'Timetable',           icon: ICON.calendar },
      { key: 'student-exams',         label: 'Exam Schedule',       icon: ICON.clipboard },
      { key: 'student-attendance',    label: 'Attendance',          icon: ICON.check },
      { key: 'student-materials',     label: 'Materials',           icon: ICON.book },
      { key: 'student-assignments',   label: 'Assignments',         icon: ICON.book2 },
      { key: 'student-fees',          label: 'Fees',                icon: ICON.money },
      { key: 'student-clearance',     label: 'Clearance',           icon: ICON.check },
      { key: 'student-documents',     label: 'Documents',           icon: ICON.file },
      { key: 'student-id-card',       label: 'ID Card',             icon: ICON.idcard },
      { key: 'student-graduation',    label: 'Graduation',          icon: ICON.award },
      { key: 'student-library',       label: 'Library',             icon: ICON.library },
      { key: 'student-announcements', label: 'Announcements',       icon: ICON.megaphone },
      { key: 'student-notifications', label: 'Notifications',       icon: ICON.bell },
    ],
    lecturer: [
      { key: 'lecturer-dashboard',   label: 'Dashboard',   icon: ICON.dash },
      { key: 'lecturer-courses',     label: 'My Courses',  icon: ICON.book },
      { key: 'lecturer-students',    label: 'Students',    icon: ICON.users },
      { key: 'lecturer-timetable',   label: 'Timetable',   icon: ICON.calendar },
      { key: 'lecturer-attendance',  label: 'Attendance',  icon: ICON.check },
      { key: 'lecturer-assessments', label: 'Assessments', icon: ICON.clipboard },
      { key: 'lecturer-assignments', label: 'Assignments', icon: ICON.book2 },
      { key: 'lecturer-results',     label: 'Results',     icon: ICON.chart },
      { key: 'lecturer-materials',   label: 'Materials',   icon: ICON.book },
      { key: 'lecturer-messages',    label: 'Messages',    icon: ICON.mail },
      { key: 'lecturer-requests',    label: 'Requests',    icon: ICON.chat },
      { key: 'lecturer-reports',     label: 'Reports',     icon: ICON.chart },
    ],
    hod: [
      { key: 'hod-dashboard',        label: 'Dashboard',       icon: ICON.dash },
      { key: 'hod-pending-results',  label: 'Pending Results', icon: ICON.clipboard },
      { key: 'hod-courses',          label: 'Courses',         icon: ICON.book },
      { key: 'hod-students',         label: 'Students',        icon: ICON.users },
      { key: 'hod-staff',            label: 'Staff',           icon: ICON.users },
    ],
    bursar: [
      { key: 'bursar-dashboard',  label: 'Dashboard',  icon: ICON.dash },
      { key: 'bursar-payments',   label: 'Payments',   icon: ICON.money },
      { key: 'bursar-fees',       label: 'Fees',       icon: ICON.money },
      { key: 'bursar-clearances', label: 'Clearances', icon: ICON.check },
      { key: 'bursar-reports',    label: 'Reports',    icon: ICON.chart },
    ],
    rector: [
      { key: 'rector-dashboard', label: 'Dashboard', icon: ICON.dash },
    ],
    registrar: [
      { key: 'registrar-dashboard', label: 'Dashboard', icon: ICON.dash },
    ],
    librarian: [
      { key: 'librarian-dashboard',    label: 'Dashboard',    icon: ICON.dash },
      { key: 'librarian-reservations', label: 'Reservations', icon: ICON.book },
      { key: 'librarian-fines',        label: 'Fines',        icon: ICON.money },
    ],
    exam_officer: [
      { key: 'exam-officer-dashboard',   label: 'Dashboard',   icon: ICON.dash },
      { key: 'exam-officer-attendance',  label: 'Attendance',  icon: ICON.check },
      { key: 'exam-officer-eligibility', label: 'Eligibility', icon: ICON.users },
    ],
    academic_officer: [
      { key: 'academic-officer-dashboard', label: 'Dashboard', icon: ICON.dash },
    ],
    admission_officer: [
      { key: 'admission-officer-dashboard', label: 'Dashboard', icon: ICON.dash },
      { key: 'admission-officer-admitted',  label: 'Admitted',  icon: ICON.check },
      { key: 'admission-officer-letters',   label: 'Letters',   icon: ICON.file },
    ],
    admin: [
      { key: 'superadmin-dashboard', label: 'Dashboard', icon: ICON.dash },
    ],
    superadmin: [
      { key: 'superadmin-dashboard', label: 'Dashboard', icon: ICON.dash },
    ],
  };

  // ----------------------------------------------------------
  // Role → folder under /portal/partials/
  // ----------------------------------------------------------
  const ROLE_FOLDER = {
    student:           'student',
    lecturer:          'lecturer',
    hod:               'hod',
    bursar:            'bursar',
    rector:            'rector',
    registrar:         'registrar',
    librarian:         'librarian',
    exam_officer:      'exam-officer',
    academic_officer:  'academic-officer',
    admission_officer: 'admission-officer',
    admin:             'superadmin',
    superadmin:        'superadmin',
  };

  // ----------------------------------------------------------
  // Landing page per role
  // ----------------------------------------------------------
  const DASHBOARD_CONFIG = {
    student:           'student-dashboard',
    lecturer:          'lecturer-dashboard',
    hod:               'hod-dashboard',
    bursar:            'bursar-dashboard',
    rector:            'rector-dashboard',
    registrar:         'registrar-dashboard',
    librarian:         'librarian-dashboard',
    exam_officer:      'exam-officer-dashboard',
    academic_officer:  'academic-officer-dashboard',
    admission_officer: 'admission-officer-dashboard',
    admin:             'superadmin-dashboard',
    superadmin:        'superadmin-dashboard',
  };

  // ----------------------------------------------------------
  // Titles keyed by page key
  // ----------------------------------------------------------
  const PORTAL_TITLES = {};
  Object.values(PORTAL_SIDEBAR).forEach((list) => {
    list.forEach((item) => { PORTAL_TITLES[item.key] = item.label; });
  });
  SHARED_PAGES.forEach((item) => { PORTAL_TITLES[item.key] = item.label; });

  // ----------------------------------------------------------
  // Map sidebar keys -> real filenames under /portal/partials/shared/
  // ----------------------------------------------------------
  const SHARED_FILE_MAP = {
    'portal-profile':       'profile',
    'portal-photo':         'photo',
    'portal-messages':      'messages',
    'portal-notifications': 'notifications',
    'portal-announcements': 'announcements',
    'portal-complaints':    'complaints',
    'portal-security':      'security',

    'admin-applications-list': 'admin-applications-list',
    'admin-audit':             'admin-audit',
    'admin-borrows':           'admin-borrows',
    'admin-courses':           'admin-courses',
    'admin-documents':         'admin-documents',
    'admin-exams':             'admin-exams',
    'admin-graduations':       'admin-graduations',
    'admin-library':           'admin-library',
    'admin-programmes':        'admin-programmes',
    'admin-sessions':          'admin-sessions',
    'admin-settings':          'admin-settings',
    'admin-transcript':        'admin-transcript',
    'admin-users':             'admin-users',
  };

  // ----------------------------------------------------------
  // Map sidebar keys -> real filenames under /portal/partials/shared/
  // ----------------------------------------------------------
  const SHARED_FILE_MAP = {
    'portal-profile':       'profile',
    'portal-photo':         'photo',
    'portal-messages':      'messages',
    'portal-notifications': 'notifications',
    'portal-announcements': 'announcements',
    'portal-complaints':    'complaints',
    'portal-security':      'security',

    'admin-applications-list': 'admin-applications-list',
    'admin-audit':             'admin-audit',
    'admin-borrows':           'admin-borrows',
    'admin-courses':           'admin-courses',
    'admin-documents':         'admin-documents',
    'admin-exams':             'admin-exams',
    'admin-graduations':       'admin-graduations',
    'admin-library':           'admin-library',
    'admin-programmes':        'admin-programmes',
    'admin-sessions':          'admin-sessions',
    'admin-settings':          'admin-settings',
    'admin-transcript':        'admin-transcript',
    'admin-users':             'admin-users',
  };

  // ----------------------------------------------------------
  // Resolve a page key to a partial path
  // ----------------------------------------------------------
  function resolvePageConfig(pageKey) {
    const user = core.getPortalUser && core.getPortalUser();
    if (!user) return null;
    const role = user.role;
    const folder = ROLE_FOLDER[role] || 'shared';

    // Guard: only admin can open admin-settings / admin-users
    const adminOnly = ['admin-settings', 'admin-users', 'admin-audit'];
    if (adminOnly.includes(pageKey) && role !== 'admin' && role !== 'superadmin') {
      return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
    }

    // Guard: students may not open admin-* pages
    if (pageKey.startsWith('admin-') && role === 'student') {
      return { url: '/portal/partials/shared/forbidden.html', title: 'Access Denied' };
    }

    // 1. Shared pages (including admin-*)
    if (SHARED_PAGES.some((p) => p.key === pageKey) || pageKey.startsWith('admin-')) {
      return {
        url: `/portal/partials/shared/${pageKey}.html`,
        title: PORTAL_TITLES[pageKey] || pageKey.replace(/-/g, ' '),
      };
    }

    // 2. Role pages: {folder}/*.html
    const roleList = PORTAL_SIDEBAR[role] || [];
    const roleItem = roleList.find((p) => p.key === pageKey);
    if (roleItem) {
      const file = pageKey
        .replace(/^exam-officer-/, '')
        .replace(/^academic-officer-/, '')
        .replace(/^admission-officer-/, '')
        .replace(/^superadmin-/, '')
        .replace(new RegExp(`^${role}-`), '')
        .replace(new RegExp(`^${folder}-`), '');
      return {
        url: `/portal/partials/${folder}/${file}.html`,
        title: roleItem.label,
      };
    }

    // 3. Fallback
    return {
      url: `/portal/partials/${folder}/${pageKey}.html`,
      title: pageKey,
    };
  }

  // ----------------------------------------------------------
  // Render sidebar (role-aware)
  // ----------------------------------------------------------
  function renderSidebar(activeKey) {
    const user = core.getPortalUser && core.getPortalUser();
    if (!user) return;
    const role = user.role;

    const container = document.getElementById('sidebar-nav');
    if (!container) return;

    const roleItems = PORTAL_SIDEBAR[role] || [];
    const sharedItems = getSharedItemsForRole(role);

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
      ${buildGroup('Main', roleItems)}
      ${buildGroup('Shared', sharedItems)}
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

  // ----------------------------------------------------------
  // Script executor
  // ----------------------------------------------------------
  function executePartialScripts(view) {
    if (window.FPU_EXECUTE_PARTIAL_SCRIPTS) {
      window.FPU_EXECUTE_PARTIAL_SCRIPTS(view);
      return;
    }
    view.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      if (old.src) s.src = old.src; else s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }

  // ----------------------------------------------------------
  // Load a partial into #page-view
  // ----------------------------------------------------------
  async function loadPage(pageKey) {
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
    window.location.hash = `#${pageKey}`;

    try {
      const res = await fetch(cfg.url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Partial not found: ${cfg.url}`);
      const html = await res.text();
      view.innerHTML = html;
      executePartialScripts(view);

      // Re-run dashboard init scripts if present
      if (window.FPU_RUN_PARTIAL_SCRIPTS) {
        window.FPU_RUN_PARTIAL_SCRIPTS(view);
      }
    } catch (err) {
      console.error('[portal-spa] load error:', err);
      view.innerHTML = `<div class="panel"><div class="panel-body">
        <div class="alert alert-error">Failed to load this page: ${err.message}</div>
      </div></div>`;
      core.showToast && core.showToast(err.message, 'error');
    }
  }

  // ----------------------------------------------------------
  // Public navigation API
  // ----------------------------------------------------------
  function navigatePortal(pageKey) {
    if (window.innerWidth < 900) core.closeSidebar && core.closeSidebar();
    return loadPage(pageKey);
  }

  // ----------------------------------------------------------
  // Boot
  // ----------------------------------------------------------
  function initPortalSPA() {
    const user = core.requirePortalAuth && core.requirePortalAuth();
    if (!user) return;

    const role = user.role;
    const landing = DASHBOARD_CONFIG[role] || 'superadmin-dashboard';

    // Topbar user info
    const nameEl = document.getElementById('topbar-name');
    const roleEl = document.getElementById('topbar-role');
    const avatarEl = document.getElementById('topbar-avatar');
    if (nameEl) nameEl.textContent = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : (user.email || 'User');
    if (roleEl) roleEl.textContent = role;

    if (avatarEl) {
      if (window.FPU_PHOTO && window.FPU_PHOTO.renderMyAvatar) {
        window.FPU_PHOTO.renderMyAvatar(avatarEl, user);
      } else {
        avatarEl.textContent = (user.firstName || 'U')[0].toUpperCase();
      }
    }

    // Sidebar toggle + logout
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.addEventListener('click', () => core.toggleSidebar && core.toggleSidebar());
    const logoutBtn = document.getElementById('topbar-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => core.portalLogout && core.portalLogout());

    // Hash-based initial page, else landing dashboard
    const hash = (window.location.hash || '').replace(/^#/, '');
    loadPage(hash || landing);

    // Handle back/forward
    window.addEventListener('hashchange', () => {
      const h = (window.location.hash || '').replace(/^#/, '');
      if (h) loadPage(h);
    });
  }

  // ----------------------------------------------------------
  // Expose
  // ----------------------------------------------------------
  window.FPU_SPA = { navigatePortal, loadPage, renderSidebar, resolvePageConfig };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortalSPA);
  } else {
    initPortalSPA();
  }
})();