// ============================================================
// FPU — HOD department auto-scope
// ------------------------------------------------------------
// When an HOD makes a request, this middleware forces
// req.query.departmentId to the HOD's own department.
// Admin / registrar / rector are unaffected (they see all).
// ============================================================

'use strict';

module.exports = function hodDepartmentScope(req, res, next) {
  try {
    const user = req.user; // set by requireUser / requireRole middleware
    if (!user) return next();

    const role = String(user.role || '').toLowerCase();

    // HOD is auto-scoped to their own department
    if (role === 'hod') {
      const deptId = user.departmentId || user.department_id;
      if (deptId) {
        // Force the departmentId — HOD cannot override via query string
        req.query.departmentId = String(deptId);
      }
    }

    // Lecturer is also scoped (to their own department) for read-only
    // views like students/courses lists. Write ops have their own guards.
    if (role === 'lecturer' && req.method === 'GET') {
      const deptId = user.departmentId || user.department_id;
      if (deptId) {
        req.query.departmentId = String(deptId);
      }
    }

    next();
  } catch (err) {
    next();
  }
};
