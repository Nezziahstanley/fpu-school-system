// ============================================================
// FPU — Public ID-card lookup
// Mounted at /api/public/id-lookup
// ------------------------------------------------------------
// Someone finds a lost ID card, scans the barcode (which
// encodes the matric number), and lands on a page showing
// the student's name + department + school + institution
// contact info. NO sensitive data is returned.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { db, schema } = require('../db');
const { eq } = require('drizzle-orm');
const { users, departments, programmes, schools } = schema;

// ------------------------------------------------------------
// GET /api/public/id-lookup?matric=FPU/SET/CEN/ND/26/001
// ------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const matric = String(req.query.matric || '').trim();
    if (!matric) {
      return res.status(400).json({
        success: false,
        error: 'Matric number is required.',
      });
    }

    const [row] = await db
      .select({
        id:             users.id,
        firstName:      users.firstName,
        lastName:       users.lastName,
        middleName:     users.middleName,
        matricNumber:   users.matricNumber,
        level:          users.level,
        photoUrl:       users.photoUrl,
        isActive:       users.isActive,
        role:           users.role,
        departmentName: departments.name,
        departmentCode: departments.code,
        programmeName:  programmes.name,
        programmeCode:  programmes.code,
        schoolName:     schools.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(programmes,  eq(users.programmeId,  programmes.id))
      .leftJoin(schools,     eq(users.schoolId,     schools.id))
      .where(eq(users.matricNumber, matric))
      .limit(1);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'No student found for this ID card.',
      });
    }

    if (row.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: 'No student found for this ID card.',
      });
    }

    const institution = {
      name:    process.env.INSTITUTION_NAME    || 'Federal Polytechnic Ugep',
      short:   process.env.INSTITUTION_SHORT   || 'FPU',
      phone:   process.env.INSTITUTION_PHONE   || '+234 800 000 0000',
      email:   process.env.INSTITUTION_EMAIL   || 'info@fedpolyugep.edu.ng',
      website: process.env.INSTITUTION_WEBSITE || 'https://fedpolyugep.edu.ng',
      address: process.env.INSTITUTION_ADDRESS || 'Ugep, Cross River State, Nigeria',
    };

    return res.json({
      success: true,
      data: {
        firstName:      row.firstName,
        lastName:       row.lastName,
        middleName:     row.middleName,
        matricNumber:   row.matricNumber,
        level:          row.level,
        photoUrl:       row.photoUrl,
        departmentName: row.departmentName,
        departmentCode: row.departmentCode,
        programmeName:  row.programmeName,
        programmeCode:  row.programmeCode,
        schoolName:     row.schoolName,
        status:         row.isActive ? 'Active' : 'Inactive',
      },
      institution,
      contact: {
        message: 'If you found this ID card, please return it to the institution using the details below, or hand it to any staff member on campus.',
      },
    });
  } catch (err) {
    console.error('[public/id-lookup]', err);
    return next(err);
  }
});

module.exports = router;