# System-wide dashboard data and presentation audit

Date: 2026-11-12

## Coverage reviewed
- All 12 role dashboard entry points: Student, Lecturer, HOD, Registrar, Bursar, Librarian, Examination Officer, Admission Officer, Rector, Academic Officer, Admin and Super Admin.
- Role sidebar definitions and the configured partial-file destinations.
- Dashboard API response fields for each role against the corresponding dashboard rendering code.
- Portal route handlers for academic-session selection and dashboard data aggregation.
- Shared menu entries that were duplicating role-owned pages or pointing users toward admin-only pages.

## Findings and fixes
1. All configured sidebar entries for the 12 roles resolve to existing partial files. No missing sidebar partials were found.
2. HOD dashboard no longer assumes academic session ID 1. It reads the active session, reports its name and calculates the number of department students without an approved registration in that session.
3. Registrar student counts now include ND, ND1, ND2, HND, HND1 and HND2 values. Department totals include students without an assigned department, and unknown gender values are separated from the Other category.
4. Registrar gender chart now has a distinct colour for the Unknown category.
5. Student dashboard no longer returns an error before loading the student's profile and published results when there is no active academic session. Current-session registrations are empty in that case.
6. Lecturer attendance and assignment creation, HOD exam scheduling, and Registrar graduation marking no longer silently fall back to session ID 1. They use the active academic session or return a clear conflict when none exists.
7. HOD dashboard includes a students-without-registration figure and handles a missing Chart.js library without breaking its data cards.
8. Removed duplicate/inappropriate shared admin links from Bursar, Librarian, Examination Officer, Academic Officer and Rector menus where dedicated role pages already exist.
9. Rector transcript API had two duplicate GET /transcripts routes. Kept the register endpoint and replaced the duplicate with GET /transcripts/:studentId for individual transcript details. Added a Rector-owned transcript register page with search, CGPA, academic detail preview and print support.

## Validation performed
- Static comparison of the dashboard data fields with their API response shapes.
- Verified that all configured role sidebar entries resolve to existing portal partials.
- Verified the Rector transcript register/detail routes and page mapping.
- Scanned all ten role portal route modules for the hard-coded currentSessionId/sessionId || 1 fallback; none remain.
- No fabricated student, staff, application, payment or result records were inserted.

## Limitations
This is source-level review. Authenticated browser testing against live accounts and live database records remains necessary to verify role permissions, real record rendering, and each action end-to-end. Existing records are displayed from the current database; this work does not manufacture missing institutional data.
