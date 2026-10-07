// ============================================================
// FPU — Drizzle-native seed for departments, programmes, courses
// ------------------------------------------------------------
// Source of truth: the two seed files provided by the client
// (SMARTACADEMIC — Full FPU Seed, and Seed ND 1/2 + HND 1/2).
// Rewritten to use Drizzle against the FPU schema.
//
// What it does:
//   1. Inserts 4 schools (SET, SST, SES, SMSS)
//   2. Inserts 13 departments under their parent school
//   3. Inserts 14 programmes (ND + HND)
//   4. Inserts all courses with year_of_study mapped from 100/200/300/400
//   5. Deletes old schools/departments/programmes/courses that
//      aren't in the new data AND aren't referenced anywhere
//
// Idempotent — safe to re-run.
//
// Usage:
//   node scripts/seed-fpu-drizzle.js
//   node scripts/seed-fpu-drizzle.js --dry       preview only
//   node scripts/seed-fpu-drizzle.js --no-delete keep old rows
// ============================================================

'use strict';

require('dotenv').config();

const { db, schema, sql, close } = require('../db');
const { eq, and, inArray, notInArray } = require('drizzle-orm');

const {
  schools,
  departments,
  programmes,
  courses,
  users,
  courseAllocations,
  courseRegistrations,
  results,
  timetableSlots,
  examSchedules,
  feeStructures,
} = schema;

const DRY = process.argv.includes('--dry');
const NO_DELETE = process.argv.includes('--no-delete');

function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok   = (m) => log('  ✓ ' + m, 'green');
const info = (m) => log('  · ' + m, 'dim');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const head = (m) => log('\n' + m, 'cyan');
const err  = (m) => log('  ✗ ' + m, 'red');

// ============================================================
// DATA — verbatim from the source files
// ============================================================

// ---- SCHOOLS (parents for departments) --------------------
const SCHOOLS = [
  { code: 'SET',  name: 'School of Engineering and Technology' },
  { code: 'SST',  name: 'School of Science and Technology' },
  { code: 'SES',  name: 'School of Environmental Studies' },
  { code: 'SMSS', name: 'School of Management and Social Sciences' },
];

// ---- DEPARTMENTS ------------------------------------------
const DEPARTMENTS = [
  // Engineering
  { code: 'CEN', name: 'Computer Engineering',                  schoolCode: 'SET' },
  { code: 'CIV', name: 'Civil Engineering',                     schoolCode: 'SET' },
  { code: 'EEE', name: 'Electrical/Electronics Engineering',    schoolCode: 'SET' },
  // Science
  { code: 'CSC', name: 'Computer Science',                      schoolCode: 'SST' },
  { code: 'STA', name: 'Statistics',                            schoolCode: 'SST' },
  { code: 'AIT', name: 'Artificial Intelligence',               schoolCode: 'SST' },
  // Environmental
  { code: 'ARC', name: 'Architectural Technology',              schoolCode: 'SES' },
  // Management & Social Sciences
  { code: 'BAM', name: 'Business Administration and Management',schoolCode: 'SMSS' },
  { code: 'PAD', name: 'Public Administration',                 schoolCode: 'SMSS' },
  { code: 'ACC', name: 'Accountancy',                           schoolCode: 'SMSS' },
  { code: 'LIS', name: 'Library and Information Science',       schoolCode: 'SMSS' },
  { code: 'HTM', name: 'Hospitality and Tourism Management',    schoolCode: 'SMSS' },
];

// ---- PROGRAMMES -------------------------------------------
const PROGRAMMES = [
  { code: 'CEN-ND', name: 'ND Computer Engineering',                    deptCode: 'CEN', level: 'ND' },
  { code: 'CIV-ND', name: 'ND Civil Engineering',                       deptCode: 'CIV', level: 'ND' },
  { code: 'EEE-ND', name: 'ND Electrical/Electronics Engineering',      deptCode: 'EEE', level: 'ND' },
  { code: 'CSC-ND', name: 'ND Computer Science',                        deptCode: 'CSC', level: 'ND' },
  { code: 'STA-ND', name: 'ND Statistics',                              deptCode: 'STA', level: 'ND' },
  { code: 'AIT-ND', name: 'ND Artificial Intelligence',                 deptCode: 'AIT', level: 'ND' },
  { code: 'ARC-ND', name: 'ND Architectural Technology',                deptCode: 'ARC', level: 'ND' },
  { code: 'BAM-ND', name: 'ND Business Administration and Management',  deptCode: 'BAM', level: 'ND' },
  { code: 'PAD-ND', name: 'ND Public Administration',                   deptCode: 'PAD', level: 'ND' },
  { code: 'ACC-ND', name: 'ND Accountancy',                             deptCode: 'ACC', level: 'ND' },
  { code: 'LIS-ND', name: 'ND Library and Information Science',         deptCode: 'LIS', level: 'ND' },
  { code: 'HTM-ND', name: 'ND Hospitality and Tourism Management',      deptCode: 'HTM', level: 'ND' },
  { code: 'SWD-HND', name: 'HND Software and Web Development',          deptCode: 'CSC', level: 'HND' },
  { code: 'NCC-HND', name: 'HND Networking and Cloud Computing',        deptCode: 'CSC', level: 'HND' },
];

// ---- COURSES ----------------------------------------------
// Source format: [code, title, units, level100/200/300/400, 'First'|'Second']
const COURSES = {
  'CSC-ND': [
    ['COM 111', 'Introduction to Computing',            3, 100, 'First'],
    ['COM 112', 'Introduction to Digital Electronics',  3, 100, 'First'],
    ['COM 113', 'Introduction to Programming',          4, 100, 'First'],
    ['COM 114', 'Statistics for Computing I',           2, 100, 'First'],
    ['COM 115', 'Computer Application Packages I',      3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             2, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['COM 121', 'Computer Application Packages II',     3, 100, 'Second'],
    ['COM 122', 'Programming in C',                     4, 100, 'Second'],
    ['COM 123', 'Statistics for Computing II',          2, 100, 'Second'],
    ['COM 124', 'Computer Hardware I',                  3, 100, 'Second'],
    ['COM 125', 'Introduction to Web Technology',       3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['COM 211', 'Programming Language using Java II',   4, 200, 'First'],
    ['COM 212', 'Introduction to Systems Programming',  2, 200, 'First'],
    ['COM 213', 'Unified Modelling Language (UML)',     3, 200, 'First'],
    ['COM 214', 'Computer Systems Troubleshooting',     3, 200, 'First'],
    ['COM 215', 'Computer Application Packages II',     3, 200, 'First'],
    ['COM 216', 'Statistics for Computing II',          2, 200, 'First'],
    ['GNS 201', 'Use of English II',                    2, 200, 'First'],
    ['EED 216', 'Practice of Entrepreneurship',         2, 200, 'First'],
    ['COM 221', 'Basic Computer Networking',            3, 200, 'Second'],
    ['COM 222', 'Seminar on Computer and Society',      2, 200, 'Second'],
    ['COM 223', 'Basic Hardware Maintenance',           2, 200, 'Second'],
    ['COM 224', 'Management Information System',         2, 200, 'Second'],
    ['COM 225', 'Web Technology',                       3, 200, 'Second'],
    ['COM 226', 'File Organisation and Management',     2, 200, 'Second'],
    ['COM 227', 'Project',                              6, 200, 'Second'],
    ['GNS 204', 'Communication in English II',          2, 200, 'Second'],
  ],
  'CEN-ND': [
    ['COM 111', 'Introduction to Computing',            3, 100, 'First'],
    ['COM 112', 'Computer Hardware I',                  3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['COM 121', 'Computer Hardware II',                 3, 100, 'Second'],
    ['COM 122', 'Introduction to Programming',          3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['COM 211', 'Digital Electronics',                  3, 200, 'First'],
    ['COM 212', 'Microprocessor Systems',               3, 200, 'First'],
    ['COM 213', 'Computer Programming I',               3, 200, 'First'],
    ['EEC 211', 'Electrical Principles',                3, 200, 'First'],
    ['COM 221', 'Computer Architecture',                3, 200, 'Second'],
    ['COM 222', 'Computer Programming II',              3, 200, 'Second'],
    ['COM 223', 'Data Communication',                   3, 200, 'Second'],
    ['EEC 221', 'Electronic Circuits',                  3, 200, 'Second'],
  ],
  'CIV-ND': [
    ['CIV 111', 'Introduction to Civil Engineering',    3, 100, 'First'],
    ['CIV 112', 'Engineering Drawing I',                3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['CIV 121', 'Building Construction I',              3, 100, 'Second'],
    ['CIV 122', 'Engineering Drawing II',               3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['CIV 211', 'Structural Mechanics I',               3, 200, 'First'],
    ['CIV 212', 'Soil Mechanics I',                     3, 200, 'First'],
    ['CIV 213', 'Fluid Mechanics I',                    3, 200, 'First'],
    ['CIV 221', 'Structural Mechanics II',              3, 200, 'Second'],
    ['CIV 222', 'Soil Mechanics II',                    3, 200, 'Second'],
    ['CIV 223', 'Fluid Mechanics II',                   3, 200, 'Second'],
  ],
  'EEE-ND': [
    ['EEE 111', 'Introduction to Electrical Engineering', 3, 100, 'First'],
    ['EEE 112', 'Electrical Drawing I',                   3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',               3, 100, 'First'],
    ['GNS 101', 'Use of English I',                       2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',                2, 100, 'First'],
    ['EEE 121', 'Electrical Circuits I',                  3, 100, 'Second'],
    ['EEE 122', 'Electrical Drawing II',                  3, 100, 'Second'],
    ['MTH 121', 'Calculus',                               3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                      2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',               2, 100, 'Second'],
    ['EEE 211', 'Electrical Machines I',                  3, 200, 'First'],
    ['EEE 212', 'Electronics I',                          3, 200, 'First'],
    ['EEE 213', 'Electrical Measurements',                3, 200, 'First'],
    ['EEE 221', 'Electrical Machines II',                 3, 200, 'Second'],
    ['EEE 222', 'Electronics II',                         3, 200, 'Second'],
    ['EEE 223', 'Power Systems I',                        3, 200, 'Second'],
  ],
  'STA-ND': [
    ['STA 111', 'Introduction to Statistics',           3, 100, 'First'],
    ['STA 112', 'Descriptive Statistics',               3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['STA 121', 'Probability Theory I',                 3, 100, 'Second'],
    ['STA 122', 'Statistical Computing',                3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['STA 211', 'Probability Distributions',            3, 200, 'First'],
    ['STA 212', 'Sampling Theory',                      3, 200, 'First'],
    ['STA 213', 'Regression Analysis',                  3, 200, 'First'],
    ['STA 221', 'Statistical Inference',                3, 200, 'Second'],
    ['STA 222', 'Design of Experiments',                3, 200, 'Second'],
    ['STA 223', 'Time Series Analysis',                 3, 200, 'Second'],
  ],
  'AIT-ND': [
    ['AIT 111', 'Introduction to Artificial Intelligence', 3, 100, 'First'],
    ['AIT 112', 'Python Programming I',                    3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',                3, 100, 'First'],
    ['GNS 101', 'Use of English I',                        2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',                 2, 100, 'First'],
    ['AIT 121', 'Python Programming II',                   3, 100, 'Second'],
    ['AIT 122', 'Data Science Fundamentals',               3, 100, 'Second'],
    ['MTH 121', 'Calculus',                                3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                       2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',                2, 100, 'Second'],
    ['AIT 211', 'Machine Learning I',                      3, 200, 'First'],
    ['AIT 212', 'Neural Networks',                         3, 200, 'First'],
    ['AIT 213', 'Data Mining',                             3, 200, 'First'],
    ['AIT 221', 'Machine Learning II',                     3, 200, 'Second'],
    ['AIT 222', 'Natural Language Processing',             3, 200, 'Second'],
    ['AIT 223', 'Computer Vision',                         3, 200, 'Second'],
  ],
  'ARC-ND': [
    ['ARC 111', 'Introduction to Architecture',         3, 100, 'First'],
    ['ARC 112', 'Architectural Drawing I',              3, 100, 'First'],
    ['ARC 113', 'Building Materials I',                 3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['ARC 121', 'Architectural Drawing II',             3, 100, 'Second'],
    ['ARC 122', 'Building Materials II',                3, 100, 'Second'],
    ['ARC 123', 'Freehand Sketching',                   2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['ARC 211', 'Architectural Design I',               3, 200, 'First'],
    ['ARC 212', 'Building Construction I',              3, 200, 'First'],
    ['ARC 213', 'Computer Aided Design',                3, 200, 'First'],
    ['ARC 221', 'Architectural Design II',              3, 200, 'Second'],
    ['ARC 222', 'Building Construction II',             3, 200, 'Second'],
    ['ARC 223', 'Site Planning',                        3, 200, 'Second'],
  ],
  'BAM-ND': [
    ['BAM 111', 'Introduction to Business',             3, 100, 'First'],
    ['BAM 112', 'Principles of Management',             3, 100, 'First'],
    ['BAM 113', 'Elements of Accounting I',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['BAM 121', 'Principles of Marketing',              3, 100, 'Second'],
    ['BAM 122', 'Elements of Accounting II',            3, 100, 'Second'],
    ['BAM 123', 'Business Communication',               2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['BAM 211', 'Business Statistics',                  3, 200, 'First'],
    ['BAM 212', 'Human Resource Management',            3, 200, 'First'],
    ['BAM 213', 'Entrepreneurship Development',         3, 200, 'First'],
    ['BAM 221', 'Business Law',                         3, 200, 'Second'],
    ['BAM 222', 'Organisational Behaviour',             3, 200, 'Second'],
    ['BAM 223', 'Financial Management',                 3, 200, 'Second'],
  ],
  'PAD-ND': [
    ['PAD 111', 'Introduction to Public Administration', 3, 100, 'First'],
    ['PAD 112', 'Elements of Government',                3, 100, 'First'],
    ['PAD 113', 'Principles of Management',              3, 100, 'First'],
    ['GNS 101', 'Use of English I',                      2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',               2, 100, 'First'],
    ['PAD 121', 'Nigerian Government and Politics',      3, 100, 'Second'],
    ['PAD 122', 'Public Personnel Administration',       3, 100, 'Second'],
    ['PAD 123', 'Business Communication',                2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                     2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',              2, 100, 'Second'],
    ['PAD 211', 'Administrative Theory',                 3, 200, 'First'],
    ['PAD 212', 'Public Finance',                        3, 200, 'First'],
    ['PAD 213', 'Local Government Administration',       3, 200, 'First'],
    ['PAD 221', 'Public Policy Analysis',                3, 200, 'Second'],
    ['PAD 222', 'Comparative Public Administration',     3, 200, 'Second'],
    ['PAD 223', 'Development Administration',            3, 200, 'Second'],
  ],
  'ACC-ND': [
    ['ACC 111', 'Principles of Accounting I',           3, 100, 'First'],
    ['ACC 112', 'Introduction to Business',             3, 100, 'First'],
    ['ACC 113', 'Business Mathematics',                 3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['ACC 121', 'Principles of Accounting II',          3, 100, 'Second'],
    ['ACC 122', 'Business Communication',               2, 100, 'Second'],
    ['ACC 123', 'Economics I',                          3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['ACC 211', 'Intermediate Accounting I',            3, 200, 'First'],
    ['ACC 212', 'Cost Accounting I',                    3, 200, 'First'],
    ['ACC 213', 'Business Statistics',                  3, 200, 'First'],
    ['ACC 221', 'Intermediate Accounting II',           3, 200, 'Second'],
    ['ACC 222', 'Cost Accounting II',                   3, 200, 'Second'],
    ['ACC 223', 'Taxation I',                           3, 200, 'Second'],
  ],
  'LIS-ND': [
    ['LIS 111', 'Introduction to Library Science',      3, 100, 'First'],
    ['LIS 112', 'Reference Services',                   3, 100, 'First'],
    ['LIS 113', 'Classification and Cataloguing I',     3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['LIS 121', 'Classification and Cataloguing II',    3, 100, 'Second'],
    ['LIS 122', 'Information Sources and Services',     3, 100, 'Second'],
    ['LIS 123', 'Library and Society',                  2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['LIS 211', 'Information Technology in Libraries',  3, 200, 'First'],
    ['LIS 212', 'Collection Development',               3, 200, 'First'],
    ['LIS 221', 'Library Management',                   3, 200, 'Second'],
    ['LIS 222', 'Information Retrieval',                3, 200, 'Second'],
  ],
  'HTM-ND': [
    ['HTM 111', 'Introduction to Hospitality',          3, 100, 'First'],
    ['HTM 112', 'Introduction to Tourism',              3, 100, 'First'],
    ['HTM 113', 'Food and Beverage Production I',       3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    ['HTM 121', 'Food and Beverage Production II',      3, 100, 'Second'],
    ['HTM 122', 'Hospitality Marketing',                3, 100, 'Second'],
    ['HTM 123', 'Travel and Tour Operations',           2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    ['HTM 211', 'Front Office Operations',              3, 200, 'First'],
    ['HTM 212', 'Housekeeping Management',              3, 200, 'First'],
    ['HTM 221', 'Tourism Planning and Development',     3, 200, 'Second'],
    ['HTM 222', 'Event Management',                     3, 200, 'Second'],
  ],
  'SWD-HND': [
    ['SWD 311', 'Advanced Web Development',             3, 300, 'First'],
    ['SWD 312', 'Software Architecture',                3, 300, 'First'],
    ['SWD 313', 'Database Systems',                     3, 300, 'First'],
    ['SWD 314', 'Server-Side Programming',              3, 300, 'First'],
    ['SWD 321', 'Front-End Frameworks',                 3, 300, 'Second'],
    ['SWD 322', 'API Design and Development',           3, 300, 'Second'],
    ['SWD 323', 'Cloud-Based Applications',             3, 300, 'Second'],
    ['SWD 324', 'Mobile App Development',               3, 300, 'Second'],
    ['SWD 411', 'DevOps and Deployment',                3, 400, 'First'],
    ['SWD 412', 'Software Testing and QA',              3, 400, 'First'],
    ['SWD 413', 'Research Methods',                     3, 400, 'First'],
    ['SWD 421', 'Final Year Project',                   6, 400, 'Second'],
    ['SWD 422', 'Software Project Management',          3, 400, 'Second'],
  ],
  'NCC-HND': [
    ['NCC 311', 'Advanced Networking',                  3, 300, 'First'],
    ['NCC 312', 'Cloud Computing Fundamentals',         3, 300, 'First'],
    ['NCC 313', 'Network Security',                     3, 300, 'First'],
    ['NCC 314', 'Linux Administration',                 3, 300, 'First'],
    ['NCC 321', 'Virtualisation Technologies',          3, 300, 'Second'],
    ['NCC 322', 'Cloud Architecture',                   3, 300, 'Second'],
    ['NCC 323', 'Wireless Networks',                    3, 300, 'Second'],
    ['NCC 324', 'Network Design and Management',        3, 300, 'Second'],
    ['NCC 411', 'DevOps for Cloud',                     3, 400, 'First'],
    ['NCC 412', 'IoT and Edge Computing',               3, 400, 'First'],
    ['NCC 413', 'Research Methods',                     3, 400, 'First'],
    ['NCC 421', 'Final Year Project',                   6, 400, 'Second'],
    ['NCC 422', 'Cloud Security and Compliance',        3, 400, 'Second'],
  ],
};

// ============================================================
// MAPPERS
// ============================================================
function mapLevel(sourceLevel) {
  if ([100, 200].includes(Number(sourceLevel))) {
    return { level: 'ND', yearOfStudy: Number(sourceLevel) === 100 ? 1 : 2 };
  }
  if ([300, 400].includes(Number(sourceLevel))) {
    return { level: 'HND', yearOfStudy: Number(sourceLevel) === 300 ? 1 : 2 };
  }
  throw new Error('Unknown source level: ' + sourceLevel);
}

function mapSemester(sourceSemester) {
  const s = String(sourceSemester).toLowerCase();
  if (s === 'first') return 'First';
  if (s === 'second') return 'Second';
  throw new Error('Unknown semester: ' + sourceSemester);
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  head('══════════════════════════════════════════════════');
  log('  FPU Seed — Drizzle native', 'cyan');
  log('══════════════════════════════════════════════════', 'cyan');
  if (DRY) log('  DRY RUN — no writes', 'yellow');
  if (NO_DELETE) log('  Keep-old mode — no deletions', 'yellow');
  console.log('');

  try {
    // ------------------------------------------------------
    // 1. SCHOOLS
    // ------------------------------------------------------
    head('1. Schools');
    const schoolMap = {};
    for (const s of SCHOOLS) {
      const [existing] = await db.select().from(schools).where(eq(schools.code, s.code)).limit(1);
      if (existing) {
        schoolMap[s.code] = existing.id;
        info(`${s.code.padEnd(5)} (exists #${existing.id})`);
      } else if (!DRY) {
        const [row] = await db.insert(schools).values({ code: s.code, name: s.name }).returning();
        schoolMap[s.code] = row.id;
        ok(`${s.code.padEnd(5)} + ${s.name}`);
      } else {
        schoolMap[s.code] = -1;
        ok(`[DRY] ${s.code} + ${s.name}`);
      }
    }

    // ------------------------------------------------------
    // 2. DEPARTMENTS
    // ------------------------------------------------------
    head('2. Departments');
    const deptMap = {};
    for (const d of DEPARTMENTS) {
      const schoolId = schoolMap[d.schoolCode];
      if (!schoolId || schoolId === -1) {
        warn(`Skipping ${d.code} — parent school ${d.schoolCode} missing`);
        continue;
      }
      const [existing] = await db.select().from(departments).where(eq(departments.code, d.code)).limit(1);
      if (existing) {
        deptMap[d.code] = existing.id;
        info(`${d.code.padEnd(5)} (exists #${existing.id})`);
      } else if (!DRY) {
        const [row] = await db.insert(departments).values({
          code: d.code, name: d.name, schoolId,
        }).returning();
        deptMap[d.code] = row.id;
        ok(`${d.code.padEnd(5)} + ${d.name}`);
      } else {
        deptMap[d.code] = -1;
        ok(`[DRY] ${d.code} + ${d.name}`);
      }
    }

    // ------------------------------------------------------
    // 3. PROGRAMMES
    // ------------------------------------------------------
    head('3. Programmes');
    const progMap = {};
    for (const p of PROGRAMMES) {
      const deptId = deptMap[p.deptCode];
      if (!deptId || deptId === -1) {
        warn(`Skipping ${p.code} — parent dept ${p.deptCode} missing`);
        continue;
      }
      const [existing] = await db.select().from(programmes).where(eq(programmes.code, p.code)).limit(1);
      if (existing) {
        progMap[p.code] = existing.id;
        info(`${p.code.padEnd(10)} (exists #${existing.id})`);
      } else if (!DRY) {
        const [row] = await db.insert(programmes).values({
          code: p.code, name: p.name, departmentId: deptId,
          level: p.level, durationYears: 2,
        }).returning();
        progMap[p.code] = row.id;
        ok(`${p.code.padEnd(10)} + ${p.name}`);
      } else {
        progMap[p.code] = -1;
        ok(`[DRY] ${p.code} + ${p.name}`);
      }
    }

    // ------------------------------------------------------
    // 4. COURSES
    // ------------------------------------------------------
    head('4. Courses');
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const [progCode, list] of Object.entries(COURSES)) {
      const progId = progMap[progCode];
      if (!progId || progId === -1) {
        warn(`Skipping courses for ${progCode} — programme missing`);
        continue;
      }
      const prog = PROGRAMMES.find((p) => p.code === progCode);
      const deptId = prog ? deptMap[prog.deptCode] : null;
      if (!deptId || deptId === -1) {
        warn(`Skipping courses for ${progCode} — department missing`);
        continue;
      }

      info(`\n  → ${progCode}`);

      for (const [code, title, unit, sourceLevel, sourceSemester] of list) {
        const { level, yearOfStudy } = mapLevel(sourceLevel);
        const semesterName = mapSemester(sourceSemester);

        // Course unique key is (code, programme_id, level, semester_name)
        const [existing] = await db
          .select()
          .from(courses)
          .where(and(
            eq(courses.code, code),
            eq(courses.programmeId, progId),
            eq(courses.level, level),
            eq(courses.semesterName, semesterName),
          ))
          .limit(1);

        if (existing) {
          if (!DRY) {
            // Update title / unit / yearOfStudy in case source changed
            await db
              .update(courses)
              .set({ title, unit, yearOfStudy, departmentId: deptId })
              .where(eq(courses.id, existing.id));
            updated++;
          }
          skipped++;
        } else if (!DRY) {
          await db.insert(courses).values({
            code,
            title,
            unit,
            level,
            semesterName,
            yearOfStudy,
            programmeId: progId,
            departmentId: deptId,
            isElective: false,
            isActive: true,
          });
          inserted++;
        } else {
          inserted++;
        }
      }
    }
    ok(`Inserted: ${inserted}`);
    ok(`Updated:  ${updated}`);
    ok(`Skipped:  ${skipped}`);

    // ------------------------------------------------------
    // 5. CLEANUP — remove stale rows not in the new data
    // ------------------------------------------------------
    if (NO_DELETE || DRY) {
      head('5. Cleanup');
      info(NO_DELETE ? 'Skipped (--no-delete)' : 'Skipped (--dry)');
      return;
    }

    head('5. Cleanup');

    const keepSchoolCodes  = SCHOOLS.map((s) => s.code);
    const keepDeptCodes    = DEPARTMENTS.map((d) => d.code);
    const keepProgCodes    = PROGRAMMES.map((p) => p.code);

    // --- 5a. Courses -------------------------------------------------
    // A course is "stale" if no (code, programme, level, semester) tuple
    // in COURSES matches it. We compute the keep-set per programme.
    let staleCourses = 0;
    for (const [progCode, list] of Object.entries(COURSES)) {
      const progId = progMap[progCode];
      if (!progId) continue;

      const keepKeys = list.map(([code, , , srcLevel, srcSem]) => {
        const { level } = mapLevel(srcLevel);
        return { code, level, semesterName: mapSemester(srcSem) };
      });

      // Pull all courses for this programme, then delete those not in keepKeys.
      const rows = await db
        .select({ id: courses.id, code: courses.code, level: courses.level, semesterName: courses.semesterName })
        .from(courses)
        .where(eq(courses.programmeId, progId));

      const keepSet = new Set(keepKeys.map((k) => `${k.code}|${k.level}|${k.semesterName}`));
      const toDelete = rows
        .filter((r) => !keepSet.has(`${r.code}|${r.level}|${r.semesterName}`))
        .map((r) => r.id);

      if (toDelete.length) {
        // Guard: never delete a course that has allocations / registrations / results.
        const referenced = await db
          .select({ courseId: courseAllocations.courseId })
          .from(courseAllocations)
          .where(inArray(courseAllocations.courseId, toDelete));
        const regRefs = await db
          .select({ courseId: courseRegistrations.courseId })
          .from(courseRegistrations)
          .where(inArray(courseRegistrations.courseId, toDelete));
        const resRefs = await db
          .select({ courseId: results.courseId })
          .from(results)
          .where(inArray(results.courseId, toDelete));
        const tslotRefs = await db
          .select({ courseId: timetableSlots.courseId })
          .from(timetableSlots)
          .where(inArray(timetableSlots.courseId, toDelete));
        const examRefs = await db
          .select({ courseId: examSchedules.courseId })
          .from(examSchedules)
          .where(inArray(examSchedules.courseId, toDelete));
        const feeRefs = await db
          .select({ courseId: feeStructures.courseId })
          .from(feeStructures)
          .where(inArray(feeStructures.courseId, toDelete));

        const protectedIds = new Set([
          ...referenced.map((r) => r.courseId),
          ...regRefs.map((r) => r.courseId),
          ...resRefs.map((r) => r.courseId),
          ...tslotRefs.map((r) => r.courseId),
          ...examRefs.map((r) => r.courseId),
          ...feeRefs.map((r) => r.courseId),
        ]);

        const deletable = toDelete.filter((id) => !protectedIds.has(id));
        const blocked   = toDelete.length - deletable.length;

        if (deletable.length) {
          await db.delete(courses).where(inArray(courses.id, deletable));
          staleCourses += deletable.length;
          warn(`${progCode}: removed ${deletable.length} stale course(s)` +
               (blocked ? ` (${blocked} kept — referenced)` : ''));
        } else if (blocked) {
          info(`${progCode}: ${blocked} stale course(s) kept — referenced`);
        }
      }
    }
    ok(`Stale courses removed: ${staleCourses}`);

    // --- 5b. Programmes ---------------------------------------------
    const allProgrammes = await db.select().from(programmes);
    const staleProgs = allProgrammes.filter((p) => !keepProgCodes.includes(p.code));
    if (staleProgs.length) {
      const progIds = staleProgs.map((p) => p.id);
      // Protect any programme that still has courses or students.
      const courseRefs = await db
        .select({ programmeId: courses.programmeId })
        .from(courses)
        .where(inArray(courses.programmeId, progIds));
      const protectedProgIds = new Set(courseRefs.map((r) => r.programmeId));

      const deletable = staleProgs.filter((p) => !protectedProgIds.has(p.id)).map((p) => p.id);
      if (deletable.length) {
        await db.delete(programmes).where(inArray(programmes.id, deletable));
        warn(`Removed ${deletable.length} stale programme(s)`);
      }
      if (staleProgs.length - deletable.length) {
        info(`${staleProgs.length - deletable.length} stale programme(s) kept — referenced`);
      }
    } else {
      info('No stale programmes');
    }

    // --- 5c. Departments --------------------------------------------
    const allDepts = await db.select().from(departments);
    const staleDepts = allDepts.filter((d) => !keepDeptCodes.includes(d.code));
    if (staleDepts.length) {
      const deptIds = staleDepts.map((d) => d.id);
      const progRefs = await db
        .select({ departmentId: programmes.departmentId })
        .from(programmes)
        .where(inArray(programmes.departmentId, deptIds));
      const courseRefs = await db
        .select({ departmentId: courses.departmentId })
        .from(courses)
        .where(inArray(courses.departmentId, deptIds));

      const protectedDeptIds = new Set([
        ...progRefs.map((r) => r.departmentId),
        ...courseRefs.map((r) => r.departmentId),
      ]);

      const deletable = staleDepts.filter((d) => !protectedDeptIds.has(d.id)).map((d) => d.id);
      if (deletable.length) {
        await db.delete(departments).where(inArray(departments.id, deletable));
        warn(`Removed ${deletable.length} stale department(s)`);
      }
      if (staleDepts.length - deletable.length) {
        info(`${staleDepts.length - deletable.length} stale department(s) kept — referenced`);
      }
    } else {
      info('No stale departments');
    }

    // --- 5d. Schools ------------------------------------------------
    const allSchools = await db.select().from(schools);
    const staleSchools = allSchools.filter((s) => !keepSchoolCodes.includes(s.code));
    if (staleSchools.length) {
      const schoolIds = staleSchools.map((s) => s.id);
      const deptRefs = await db
        .select({ schoolId: departments.schoolId })
        .from(departments)
        .where(inArray(departments.schoolId, schoolIds));
      const protectedSchoolIds = new Set(deptRefs.map((r) => r.schoolId));

      const deletable = staleSchools.filter((s) => !protectedSchoolIds.has(s.id)).map((s) => s.id);
      if (deletable.length) {
        await db.delete(schools).where(inArray(schools.id, deletable));
        warn(`Removed ${deletable.length} stale school(s)`);
      }
      if (staleSchools.length - deletable.length) {
        info(`${staleSchools.length - deletable.length} stale school(s) kept — referenced`);
      }
    } else {
      info('No stale schools');
    }

    head('Done');
    ok('FPU seed complete');
  } catch (e) {
    err(e.message);
    if (e.stack) console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();