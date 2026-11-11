'use strict';

const express = require('express');
const router = express.Router();
const { db, schema } = require('../db');
const { eq, asc } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { users, departments, programmes, schools, staffProfiles } = schema;

const ACCESS = ['admin', 'registrar', 'rector', 'academic_officer'];

// GET /api/admin/id-cards — institutional directory of printable identity cards.
router.get('/', requireRole(ACCESS), async (req, res, next) => {
  try {
    const role = String(req.query.role || '').trim().toLowerCase();
    const allowed = ['student', 'lecturer', 'hod', 'bursar', 'registrar', 'rector', 'librarian', 'exam_officer', 'academic_officer', 'admission_officer', 'admin'];
    if (role && !allowed.includes(role)) return res.status(400).json({ success: false, error: 'Invalid card category.' });
    const rows = await db.select({
      id: users.id, firstName: users.firstName, middleName: users.middleName, lastName: users.lastName,
      email: users.email, phone: users.phone, role: users.role, matricNumber: users.matricNumber,
      level: users.level, photoUrl: users.idCardPhotoUrl, profilePhotoUrl: users.photoUrl,
      isActive: users.isActive, departmentName: departments.name, programmeName: programmes.name,
      schoolName: schools.name, staffNumber: staffProfiles.staffNumber, rank: staffProfiles.rank,
      specialization: staffProfiles.specialization, employmentDate: staffProfiles.employmentDate,
    }).from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(role ? eq(users.role, role) : undefined)
      .orderBy(asc(users.role), asc(users.lastName), asc(users.firstName));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

module.exports = router;