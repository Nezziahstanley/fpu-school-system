// ============================================================
// FPU School Management System — Merged seed  (v2)
// ------------------------------------------------------------
// 7 schools:
//   SET    School of Engineering Technology
//   SST    School of Science Technology
//   SAT    School of Agricultural Technology
//   SEHT   School of Environmental & Health Technology
//   SMT    School of Management Technology
//   SAD    School of Art & Design
//   SGEVS  School of General, Entrepreneurial & Vocational Studies
//
// Departments + programmes + courses follow NBTE conventions.
// Populates users, sessions, students, payments, results,
// timetables, exams, attendance, library, documents,
// graduations, complaints, announcements, notifications.
//
// Run: npm run seed
// ============================================================

'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { db, schema, sql, close } = require('../db');

const {
  users, schools, departments, programmes, courses,
  courseAllocations, courseRegistrations, results, gradeScales,
  feeStructures, payments, clearances,
  timetableSlots, examSchedules, examAttendance, attendance,
  assignments, assignmentSubmissions, courseMaterials,
  books, borrowRecords, bookReservations, libraryFines,
  documents, graduations, complaints, messages, notifications,
  announcements, staffProfiles, loginHistory, auditLogs,
  securityLogs, tokens, photoUploads, settings, studyLevels,
  academicSessions,
} = schema;

const { DEFAULT_GRADE_SCALE } = require('../config/departments');

// ============================================================
// RNG
// ============================================================
let _seed = 20260101;
function rand() { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(a) { return a[Math.floor(rand() * a.length)]; }
function pad(n, w = 3) { return String(n).padStart(w, '0'); }

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
async function hash(p) { return bcrypt.hash(p, await bcrypt.genSalt(BCRYPT_ROUNDS)); }

// ============================================================
// SCHOOLS  (7)
// ============================================================
const SCHOOLS_DATA = [
  { code: 'SET',   name: 'School of Engineering Technology' },
  { code: 'SST',   name: 'School of Science Technology' },
  { code: 'SAT',   name: 'School of Agricultural Technology' },
  { code: 'SEHT',  name: 'School of Environmental & Health Technology' },
  { code: 'SMT',   name: 'School of Management Technology' },
  { code: 'SAD',   name: 'School of Art & Design' },
  { code: 'SGEVS', name: 'School of General, Entrepreneurial & Vocational Studies' },
];

// ============================================================
// DEPARTMENTS  (25)
// ============================================================
const DEPARTMENTS_DATA = [
  // SET
  { code: 'CEN', name: 'Computer Engineering',                    schoolCode: 'SET' },
  { code: 'CIV', name: 'Civil Engineering',                       schoolCode: 'SET' },
  { code: 'EEE', name: 'Electrical/Electronics Engineering',      schoolCode: 'SET' },
  { code: 'MEC', name: 'Mechanical Engineering',                  schoolCode: 'SET' },
  // SST
  { code: 'CSC', name: 'Computer Science',                        schoolCode: 'SST' },
  { code: 'STA', name: 'Statistics',                              schoolCode: 'SST' },
  { code: 'AIT', name: 'Artificial Intelligence',                 schoolCode: 'SST' },
  { code: 'SLT', name: 'Science Laboratory Technology',           schoolCode: 'SST' },
  // SAT
  { code: 'AGR', name: 'Agricultural Technology',                 schoolCode: 'SAT' },
  { code: 'ANS', name: 'Animal Science & Fisheries',              schoolCode: 'SAT' },
  // SEHT
  { code: 'ARC', name: 'Architectural Technology',                schoolCode: 'SEHT' },
  { code: 'URP', name: 'Urban & Regional Planning',               schoolCode: 'SEHT' },
  { code: 'EVH', name: 'Environmental Health Technology',         schoolCode: 'SEHT' },
  // SMT
  { code: 'ACC', name: 'Accountancy',                             schoolCode: 'SMT' },
  { code: 'BAM', name: 'Business Administration & Management',    schoolCode: 'SMT' },
  { code: 'PAD', name: 'Public Administration',                   schoolCode: 'SMT' },
  { code: 'MKT', name: 'Marketing',                               schoolCode: 'SMT' },
  { code: 'LIS', name: 'Library & Information Science',           schoolCode: 'SMT' },
  { code: 'HTM', name: 'Hospitality & Tourism Management',        schoolCode: 'SMT' },
  // SAD
  { code: 'FAS', name: 'Fashion Design',                          schoolCode: 'SAD' },
  { code: 'GRD', name: 'Graphics Design',                         schoolCode: 'SAD' },
  { code: 'FAD', name: 'Fine Arts & Design',                      schoolCode: 'SAD' },
  // SGEVS
  { code: 'GNS', name: 'General Studies',                         schoolCode: 'SGEVS' },
  { code: 'ENT', name: 'Entrepreneurship',                        schoolCode: 'SGEVS' },
  { code: 'VOC', name: 'Vocational Studies',                      schoolCode: 'SGEVS' },
];

// ============================================================
// PROGRAMMES  (ND + HND for every department → 50)
// ============================================================
const PROGRAMMES_DATA = [];
for (const d of DEPARTMENTS_DATA) {
  PROGRAMMES_DATA.push({ code: `${d.code}-ND`,  name: `ND ${d.name}`,  deptCode: d.code, level: 'ND'  });
  PROGRAMMES_DATA.push({ code: `${d.code}-HND`, name: `HND ${d.name}`, deptCode: d.code, level: 'HND' });
}

// ============================================================
// COURSE BUILDER
// ------------------------------------------------------------
// Compact helper: many departments share a "common" prelude
// (GNS, MTH, Entrepreneur). We assemble course lists per
// programme with realistic NBTE codes.
// ============================================================
const GNS_PRELUDE_ND = [
  ['GNS 101', 'Use of English I',            2, 100, 'First'],
  ['GNS 103', 'Citizenship Education I',     2, 100, 'First'],
  ['GNS 102', 'Use of English II',           2, 100, 'Second'],
  ['GNS 104', 'Citizenship Education II',    2, 100, 'Second'],
];
const GNS_PRELUDE_HND = [
  ['GNS 301', 'Use of English III',          2, 300, 'First'],
  ['GNS 302', 'Communication in English',    2, 300, 'Second'],
];
const ENT_ND  = [['EED 126', 'Entrepreneurship Development I', 2, 100, 'Second']];
const ENT_HND = [['EED 326', 'Entrepreneurship Development II', 2, 300, 'Second']];

function mergeCourses(...lists) {
  const out = [];
  const seen = new Set();
  for (const l of lists) for (const c of l) {
    const k = c[0];
    if (seen.has(k)) continue;
    seen.add(k); out.push(c);
  }
  return out;
}

// Existing 12 department course lists (from seed-fpu-drizzle.js)
const SEED_EXISTING = {
  'CSC-ND': [
    ['COM 111','Introduction to Computing',3,100,'First'],
    ['COM 112','Introduction to Digital Electronics',3,100,'First'],
    ['COM 113','Introduction to Programming',4,100,'First'],
    ['COM 114','Statistics for Computing I',2,100,'First'],
    ['COM 115','Computer Application Packages I',3,100,'First'],
    ['MTH 111','Logic and Linear Algebra',2,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['COM 121','Computer Application Packages II',3,100,'Second'],
    ['COM 122','Programming in C',4,100,'Second'],
    ['COM 123','Statistics for Computing II',2,100,'Second'],
    ['COM 124','Computer Hardware I',3,100,'Second'],
    ['COM 125','Introduction to Web Technology',3,100,'Second'],
    ['MTH 121','Calculus',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['COM 211','Programming Language using Java II',4,200,'First'],
    ['COM 212','Introduction to Systems Programming',2,200,'First'],
    ['COM 213','Unified Modelling Language (UML)',3,200,'First'],
    ['COM 214','Computer Systems Troubleshooting',3,200,'First'],
    ['COM 215','Computer Application Packages II',3,200,'First'],
    ['COM 216','Statistics for Computing II',2,200,'First'],
    ['GNS 201','Use of English II',2,200,'First'],
    ['EED 216','Practice of Entrepreneurship',2,200,'First'],
    ['COM 221','Basic Computer Networking',3,200,'Second'],
    ['COM 222','Seminar on Computer and Society',2,200,'Second'],
    ['COM 223','Basic Hardware Maintenance',2,200,'Second'],
    ['COM 224','Management Information System',2,200,'Second'],
    ['COM 225','Web Technology',3,200,'Second'],
    ['COM 226','File Organisation and Management',2,200,'Second'],
    ['COM 227','Project',6,200,'Second'],
    ['GNS 204','Communication in English II',2,200,'Second'],
  ],
  'CEN-ND': [
    ['COM 111','Introduction to Computing',3,100,'First'],
    ['COM 112','Computer Hardware I',3,100,'First'],
    ['MTH 111','Logic and Linear Algebra',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['COM 121','Computer Hardware II',3,100,'Second'],
    ['COM 122','Introduction to Programming',3,100,'Second'],
    ['MTH 121','Calculus',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['COM 211','Digital Electronics',3,200,'First'],
    ['COM 212','Microprocessor Systems',3,200,'First'],
    ['COM 213','Computer Programming I',3,200,'First'],
    ['EEC 211','Electrical Principles',3,200,'First'],
    ['COM 221','Computer Architecture',3,200,'Second'],
    ['COM 222','Computer Programming II',3,200,'Second'],
    ['COM 223','Data Communication',3,200,'Second'],
    ['EEC 221','Electronic Circuits',3,200,'Second'],
  ],
  'CIV-ND': [
    ['CIV 111','Introduction to Civil Engineering',3,100,'First'],
    ['CIV 112','Engineering Drawing I',3,100,'First'],
    ['MTH 111','Logic and Linear Algebra',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['CIV 121','Building Construction I',3,100,'Second'],
    ['CIV 122','Engineering Drawing II',3,100,'Second'],
    ['MTH 121','Calculus',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['CIV 211','Structural Mechanics I',3,200,'First'],
    ['CIV 212','Soil Mechanics I',3,200,'First'],
    ['CIV 213','Fluid Mechanics I',3,200,'First'],
    ['CIV 221','Structural Mechanics II',3,200,'Second'],
    ['CIV 222','Soil Mechanics II',3,200,'Second'],
    ['CIV 223','Fluid Mechanics II',3,200,'Second'],
  ],
  'EEE-ND': [
    ['EEE 111','Introduction to Electrical Engineering',3,100,'First'],
    ['EEE 112','Electrical Drawing I',3,100,'First'],
    ['MTH 111','Logic and Linear Algebra',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['EEE 121','Electrical Circuits I',3,100,'Second'],
    ['EEE 122','Electrical Drawing II',3,100,'Second'],
    ['MTH 121','Calculus',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['EEE 211','Electrical Machines I',3,200,'First'],
    ['EEE 212','Electronics I',3,200,'First'],
    ['EEE 213','Electrical Measurements',3,200,'First'],
    ['EEE 221','Electrical Machines II',3,200,'Second'],
    ['EEE 222','Electronics II',3,200,'Second'],
    ['EEE 223','Power Systems I',3,200,'Second'],
  ],
  'STA-ND': [
    ['STA 111','Introduction to Statistics',3,100,'First'],
    ['STA 112','Descriptive Statistics',3,100,'First'],
    ['MTH 111','Logic and Linear Algebra',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['STA 121','Probability Theory I',3,100,'Second'],
    ['STA 122','Statistical Computing',3,100,'Second'],
    ['MTH 121','Calculus',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['STA 211','Probability Distributions',3,200,'First'],
    ['STA 212','Sampling Theory',3,200,'First'],
    ['STA 213','Regression Analysis',3,200,'First'],
    ['STA 221','Statistical Inference',3,200,'Second'],
    ['STA 222','Design of Experiments',3,200,'Second'],
    ['STA 223','Time Series Analysis',3,200,'Second'],
  ],
  'AIT-ND': [
    ['AIT 111','Introduction to Artificial Intelligence',3,100,'First'],
    ['AIT 112','Python Programming I',3,100,'First'],
    ['MTH 111','Logic and Linear Algebra',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['AIT 121','Python Programming II',3,100,'Second'],
    ['AIT 122','Data Science Fundamentals',3,100,'Second'],
    ['MTH 121','Calculus',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['AIT 211','Machine Learning I',3,200,'First'],
    ['AIT 212','Neural Networks',3,200,'First'],
    ['AIT 213','Data Mining',3,200,'First'],
    ['AIT 221','Machine Learning II',3,200,'Second'],
    ['AIT 222','Natural Language Processing',3,200,'Second'],
    ['AIT 223','Computer Vision',3,200,'Second'],
  ],
  'ARC-ND': [
    ['ARC 111','Introduction to Architecture',3,100,'First'],
    ['ARC 112','Architectural Drawing I',3,100,'First'],
    ['ARC 113','Building Materials I',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['ARC 121','Architectural Drawing II',3,100,'Second'],
    ['ARC 122','Building Materials II',3,100,'Second'],
    ['ARC 123','Freehand Sketching',2,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['ARC 211','Architectural Design I',3,200,'First'],
    ['ARC 212','Building Construction I',3,200,'First'],
    ['ARC 213','Computer Aided Design',3,200,'First'],
    ['ARC 221','Architectural Design II',3,200,'Second'],
    ['ARC 222','Building Construction II',3,200,'Second'],
    ['ARC 223','Site Planning',3,200,'Second'],
  ],
  'BAM-ND': [
    ['BAM 111','Introduction to Business',3,100,'First'],
    ['BAM 112','Principles of Management',3,100,'First'],
    ['BAM 113','Elements of Accounting I',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['BAM 121','Principles of Marketing',3,100,'Second'],
    ['BAM 122','Elements of Accounting II',3,100,'Second'],
    ['BAM 123','Business Communication',2,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['BAM 211','Business Statistics',3,200,'First'],
    ['BAM 212','Human Resource Management',3,200,'First'],
    ['BAM 213','Entrepreneurship Development',3,200,'First'],
    ['BAM 221','Business Law',3,200,'Second'],
    ['BAM 222','Organisational Behaviour',3,200,'Second'],
    ['BAM 223','Financial Management',3,200,'Second'],
  ],
  'PAD-ND': [
    ['PAD 111','Introduction to Public Administration',3,100,'First'],
    ['PAD 112','Elements of Government',3,100,'First'],
    ['PAD 113','Principles of Management',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['PAD 121','Nigerian Government and Politics',3,100,'Second'],
    ['PAD 122','Public Personnel Administration',3,100,'Second'],
    ['PAD 123','Business Communication',2,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['PAD 211','Administrative Theory',3,200,'First'],
    ['PAD 212','Public Finance',3,200,'First'],
    ['PAD 213','Local Government Administration',3,200,'First'],
    ['PAD 221','Public Policy Analysis',3,200,'Second'],
    ['PAD 222','Comparative Public Administration',3,200,'Second'],
    ['PAD 223','Development Administration',3,200,'Second'],
  ],
  'ACC-ND': [
    ['ACC 111','Principles of Accounting I',3,100,'First'],
    ['ACC 112','Introduction to Business',3,100,'First'],
    ['ACC 113','Business Mathematics',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['ACC 121','Principles of Accounting II',3,100,'Second'],
    ['ACC 122','Business Communication',2,100,'Second'],
    ['ACC 123','Economics I',3,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['ACC 211','Intermediate Accounting I',3,200,'First'],
    ['ACC 212','Cost Accounting I',3,200,'First'],
    ['ACC 213','Business Statistics',3,200,'First'],
    ['ACC 221','Intermediate Accounting II',3,200,'Second'],
    ['ACC 222','Cost Accounting II',3,200,'Second'],
    ['ACC 223','Taxation I',3,200,'Second'],
  ],
  'LIS-ND': [
    ['LIS 111','Introduction to Library Science',3,100,'First'],
    ['LIS 112','Reference Services',3,100,'First'],
    ['LIS 113','Classification and Cataloguing I',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['LIS 121','Classification and Cataloguing II',3,100,'Second'],
    ['LIS 122','Information Sources and Services',3,100,'Second'],
    ['LIS 123','Library and Society',2,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['LIS 211','Information Technology in Libraries',3,200,'First'],
    ['LIS 212','Collection Development',3,200,'First'],
    ['LIS 221','Library Management',3,200,'Second'],
    ['LIS 222','Information Retrieval',3,200,'Second'],
  ],
  'HTM-ND': [
    ['HTM 111','Introduction to Hospitality',3,100,'First'],
    ['HTM 112','Introduction to Tourism',3,100,'First'],
    ['HTM 113','Food and Beverage Production I',3,100,'First'],
    ['GNS 101','Use of English I',2,100,'First'],
    ['GNS 103','Citizenship Education I',2,100,'First'],
    ['HTM 121','Food and Beverage Production II',3,100,'Second'],
    ['HTM 122','Hospitality Marketing',3,100,'Second'],
    ['HTM 123','Travel and Tour Operations',2,100,'Second'],
    ['GNS 102','Use of English II',2,100,'Second'],
    ['GNS 104','Citizenship Education II',2,100,'Second'],
    ['HTM 211','Front Office Operations',3,200,'First'],
    ['HTM 212','Housekeeping Management',3,200,'First'],
    ['HTM 221','Tourism Planning and Development',3,200,'Second'],
    ['HTM 222','Event Management',3,200,'Second'],
  ],
  'SWD-HND': [
    ['SWD 311','Advanced Web Development',3,300,'First'],
    ['SWD 312','Software Architecture',3,300,'First'],
    ['SWD 313','Database Systems',3,300,'First'],
    ['SWD 314','Server-Side Programming',3,300,'First'],
    ['SWD 321','Front-End Frameworks',3,300,'Second'],
    ['SWD 322','API Design and Development',3,300,'Second'],
    ['SWD 323','Cloud-Based Applications',3,300,'Second'],
    ['SWD 324','Mobile App Development',3,300,'Second'],
    ['SWD 411','DevOps and Deployment',3,400,'First'],
    ['SWD 412','Software Testing and QA',3,400,'First'],
    ['SWD 413','Research Methods',3,400,'First'],
    ['SWD 421','Final Year Project',6,400,'Second'],
    ['SWD 422','Software Project Management',3,400,'Second'],
  ],
  'NCC-HND': [
    ['NCC 311','Advanced Networking',3,300,'First'],
    ['NCC 312','Cloud Computing Fundamentals',3,300,'First'],
    ['NCC 313','Network Security',3,300,'First'],
    ['NCC 314','Linux Administration',3,300,'First'],
    ['NCC 321','Virtualisation Technologies',3,300,'Second'],
    ['NCC 322','Cloud Architecture',3,300,'Second'],
    ['NCC 323','Wireless Networks',3,300,'Second'],
    ['NCC 324','Network Design and Management',3,300,'Second'],
    ['NCC 411','DevOps for Cloud',3,400,'First'],
    ['NCC 412','IoT and Edge Computing',3,400,'First'],
    ['NCC 413','Research Methods',3,400,'First'],
    ['NCC 421','Final Year Project',6,400,'Second'],
    ['NCC 422','Cloud Security and Compliance',3,400,'Second'],
  ],
};

// ---- Build the full course map ----------------------------------
const COURSES = Object.assign({}, SEED_EXISTING);

// Helper: seed a list from (prefix, titles by year)
function genCourseList(prefix, titlesFirstYear, titlesSecondYear, titlesHndFirst, titlesHndSecond) {
  const out = [];
  // Year 1 (100)
  titlesFirstYear.forEach((t, i) => out.push([`${prefix} ${100 + i + 1}`, t, randInt(2, 4), 100, 'First']));
  // Year 2 (200)
  titlesSecondYear.forEach((t, i) => out.push([`${prefix} ${200 + i + 1}`, t, randInt(2, 4), 200, 'Second']));
  if (titlesHndFirst) titlesHndFirst.forEach((t, i) => out.push([`${prefix} ${300 + i + 1}`, t, randInt(2, 4), 300, 'First']));
  if (titlesHndSecond) titlesHndSecond.forEach((t, i) => out.push([`${prefix} ${400 + i + 1}`, t, randInt(2, 4), 400, 'Second']));
  return out;
}

// Helper: enrich a base ND course list with GNS and Entrepreneur
function withNDCommon(base) { return mergeCourses(base, GNS_PRELUDE_ND, ENT_ND); }
function withHNDCommon(base) { return mergeCourses(base, GNS_PRELUDE_HND, ENT_HND); }

// ---- New departments: ND ---------------------------------------
COURSES['MEC-ND'] = withNDCommon(genCourseList('MEC',
  ['Engineering Drawing I','Workshop Technology I','Engineering Materials','Applied Mechanics','Thermodynamics I'],
  ['Engineering Drawing II','Workshop Technology II','Fluid Mechanics','Machine Design I','Metrology'],
));
COURSES['SLT-ND'] = withNDCommon(genCourseList('SLT',
  ['General Biology','General Chemistry I','General Physics I','Lab Techniques I','General Mathematics'],
  ['General Chemistry II','General Physics II','Lab Techniques II','Microbiology I','Biochemistry I'],
));
COURSES['AGR-ND'] = withNDCommon(genCourseList('AGR',
  ['Principles of Agriculture','Crop Production I','Soil Science I','Farm Tools & Machinery','Agricultural Economics I'],
  ['Crop Production II','Soil Science II','Animal Husbandry I','Agricultural Extension','Farm Management'],
));
COURSES['ANS-ND'] = withNDCommon(genCourseList('ANS',
  ['Introduction to Animal Science','Principles of Nutrition','Livestock Production I','Anatomy & Physiology','Aquaculture I'],
  ['Livestock Production II','Animal Health','Poultry Production','Fisheries Management','Aquaculture II'],
));
COURSES['URP-ND'] = withNDCommon(genCourseList('URP',
  ['Introduction to Planning','Land Surveying I','Urban Design I','Principles of Cartography','Built Environment'],
  ['Land Surveying II','Urban Design II','Regional Planning','Site Planning','Housing Studies'],
));
COURSES['EVH-ND'] = withNDCommon(genCourseList('EVH',
  ['Introduction to Environmental Health','General Biology','General Chemistry','Sanitation & Hygiene','Epidemiology I'],
  ['Vector Control','Water Supply & Treatment','Waste Management I','Food Hygiene','Health Education'],
));
COURSES['MKT-ND'] = withNDCommon(genCourseList('MKT',
  ['Principles of Marketing','Business Communication','Introduction to Business','Business Maths','Consumer Behaviour I'],
  ['Salesmanship','Retail Management','Advertising I','Marketing Research','Consumer Behaviour II'],
));
COURSES['FAS-ND'] = withNDCommon(genCourseList('FAS',
  ['Introduction to Fashion Design','Pattern Drafting I','Garment Construction I','Textile Studies I','Fashion Drawing I'],
  ['Pattern Drafting II','Garment Construction II','Textile Studies II','Fashion Drawing II','Fashion Marketing'],
));
COURSES['GRD-ND'] = withNDCommon(genCourseList('GRD',
  ['Introduction to Graphics','Drawing Fundamentals','Typography I','History of Design','Computer Graphics I'],
  ['Typography II','Layout Design','Print Production','Computer Graphics II','Brand Identity'],
));
COURSES['FAD-ND'] = withNDCommon(genCourseList('FAD',
  ['Introduction to Fine Arts','Drawing & Painting I','Sculpture I','Art History I','Colour Theory'],
  ['Drawing & Painting II','Sculpture II','Art History II','Ceramics I','Studio Practice'],
));
COURSES['GNS-ND'] = GNS_PRELUDE_ND.slice();
COURSES['ENT-ND'] = withNDCommon(mergeCourses(
  [['ENT 111','Principles of Entrepreneurship',3,100,'First']],
  [['ENT 121','Small Business Management',3,100,'Second']],
));
COURSES['VOC-ND'] = withNDCommon(genCourseList('VOC',
  ['Introduction to Vocational Studies','Workshop Practice I','Technical Drawing','Safety in Workshop','Hand Tools'],
  ['Workshop Practice II','Metal Work','Wood Work','Electrical Wiring','Entrepreneurship Practice'],
));

// ---- New departments: HND ---------------------------------------
COURSES['MEC-HND'] = withHNDCommon(genCourseList('MEC',
  [], [],
  ['Advanced Thermodynamics','Machine Design II','Manufacturing Technology','Control Systems','Engineering Management'],
  ['Industrial Automation','Renewable Energy Systems','Advanced Fluid Mechanics','Research Methods','Final Year Project'],
));
COURSES['SLT-HND'] = withHNDCommon(genCourseList('SLT',
  [], [],
  ['Analytical Chemistry','Advanced Microbiology','Instrumental Analysis','Cell Biology','Research Techniques I'],
  ['Biotechnology','Environmental Chemistry','Research Techniques II','Quality Control','Final Year Project'],
));
COURSES['AGR-HND'] = withHNDCommon(genCourseList('AGR',
  [], [],
  ['Advanced Crop Production','Agricultural Economics II','Farm Mechanisation','Irrigation & Drainage','Research Methods'],
  ['Agro-Business Management','Post-Harvest Technology','Agricultural Extension II','Project Management','Final Year Project'],
));
COURSES['ANS-HND'] = withHNDCommon(genCourseList('ANS',
  [], [],
  ['Advanced Animal Nutrition','Animal Breeding','Livestock Health II','Aquaculture III','Research Methods'],
  ['Animal Products Technology','Poultry Nutrition','Fisheries Economics','Livestock Marketing','Final Year Project'],
));
COURSES['URP-HND'] = withHNDCommon(genCourseList('URP',
  [], [],
  ['Advanced Urban Design','GIS for Planners','Transport Planning I','Planning Law I','Research Methods'],
  ['Regional Development','Transport Planning II','Planning Law II','Environmental Planning','Final Year Project'],
));
COURSES['EVH-HND'] = withHNDCommon(genCourseList('EVH',
  [], [],
  ['Advanced Environmental Health','Waste Management II','Occupational Health','Epidemiology II','Research Methods'],
  ['Environmental Toxicology','Public Health Law','Health Promotion','Environmental Impact','Final Year Project'],
));
COURSES['MKT-HND'] = withHNDCommon(genCourseList('MKT',
  [], [],
  ['Strategic Marketing','Advertising II','International Marketing','Marketing Research II','Research Methods'],
  ['Digital Marketing','Sales Management','Marketing Communications','Consumer Law','Final Year Project'],
));
COURSES['FAS-HND'] = withHNDCommon(genCourseList('FAS',
  [], [],
  ['Advanced Fashion Illustration','Draping Techniques','Fashion Business','Textile Design','Research Methods'],
  ['Fashion Production Management','Fashion Merchandising','Costume Design','Portfolio Development','Final Year Project'],
));
COURSES['GRD-HND'] = withHNDCommon(genCourseList('GRD',
  [], [],
  ['Advanced Typography','Motion Graphics','Web Design','Packaging Design','Research Methods'],
  ['Brand Strategy','UI/UX Design','Advertising Design','Portfolio Development','Final Year Project'],
));
COURSES['FAD-HND'] = withHNDCommon(genCourseList('FAD',
  [], [],
  ['Advanced Painting','Advanced Sculpture','Art Criticism','Gallery Management','Research Methods'],
  ['Public Art','Digital Art','Curatorial Practice','Portfolio Development','Final Year Project'],
));
COURSES['GNS-HND'] = GNS_PRELUDE_HND.slice();
COURSES['ENT-HND'] = withHNDCommon(mergeCourses(
  [['ENT 311','Advanced Entrepreneurship',3,300,'First']],
  [['ENT 321','Venture Capital & Finance',3,300,'Second']],
));
COURSES['VOC-HND'] = withHNDCommon(genCourseList('VOC',
  [], [],
  ['Advanced Workshop Practice','Industrial Design','Project Management','Quality Assurance','Research Methods'],
  ['Automation & Robotics','Production Planning','Trade Certification','Portfolio Development','Final Year Project'],
));

// ---- HND for existing departments that only had ND --------------
COURSES['CEN-HND'] = withHNDCommon(genCourseList('CEN', [], [],
  ['Advanced Microprocessors','Digital Signal Processing','Embedded Systems','Computer Networks','Research Methods'],
  ['VLSI Design','Robotics','Advanced Computer Architecture','Network Security','Final Year Project'],
));
COURSES['CIV-HND'] = withHNDCommon(genCourseList('CIV', [], [],
  ['Advanced Structural Analysis','Geotechnical Engineering','Transportation Engineering','Hydraulics','Research Methods'],
  ['Reinforced Concrete Design','Water Resources Engineering','Construction Management','Quantity Surveying','Final Year Project'],
));
COURSES['EEE-HND'] = withHNDCommon(genCourseList('EEE', [], [],
  ['Power Electronics','Electrical Machines III','Control Engineering','Electrical Services Design','Research Methods'],
  ['Power System Protection','Renewable Energy Systems','Industrial Electronics','Energy Management','Final Year Project'],
));
COURSES['STA-HND'] = withHNDCommon(genCourseList('STA', [], [],
  ['Advanced Probability','Multivariate Analysis','Statistical Computing II','Survey Methods','Research Methods'],
  ['Non-Parametric Methods','Bayesian Statistics','Econometrics','Applied Statistics','Final Year Project'],
));
COURSES['AIT-HND'] = withHNDCommon(genCourseList('AIT', [], [],
  ['Deep Learning','Computer Vision II','Reinforcement Learning','Big Data Analytics','Research Methods'],
  ['Generative AI','MLOps & Deployment','AI Ethics','Robotics & Perception','Final Year Project'],
));
COURSES['ARC-HND'] = withHNDCommon(genCourseList('ARC', [], [],
  ['Advanced Architectural Design','Urban Design','Building Services','Construction Management','Research Methods'],
  ['Sustainable Architecture','Interior Design','Landscape Architecture','Professional Practice','Final Year Project'],
));
COURSES['BAM-HND'] = withHNDCommon(genCourseList('BAM', [], [],
  ['Strategic Management','Operations Management','Marketing Management','Business Statistics II','Research Methods'],
  ['International Business','Business Ethics','Project Management','Corporate Finance','Final Year Project'],
));
COURSES['PAD-HND'] = withHNDCommon(genCourseList('PAD', [], [],
  ['Administrative Law','Public Policy Analysis II','Public Sector Management','Public Finance II','Research Methods'],
  ['Comparative Government','Development Administration II','Public Personnel Management','Local Government Finance','Final Year Project'],
));
COURSES['ACC-HND'] = withHNDCommon(genCourseList('ACC', [], [],
  ['Advanced Financial Accounting','Cost Accounting III','Auditing I','Taxation II','Research Methods'],
  ['Management Accounting','Public Sector Accounting','Auditing II','Taxation III','Final Year Project'],
));
COURSES['LIS-HND'] = withHNDCommon(genCourseList('LIS', [], [],
  ['Advanced Cataloguing','Digital Libraries','Information Systems Management','Knowledge Management','Research Methods'],
  ['Archives & Records Management','Information Policy','Bibliometrics','Library Automation','Final Year Project'],
));
COURSES['HTM-HND'] = withHNDCommon(genCourseList('HTM', [], [],
  ['Advanced Food Production','Hospitality Management','Tourism Management','Facility Management','Research Methods'],
  ['Events Management','International Tourism','Front Office Management II','Catering Management','Final Year Project'],
));

// ============================================================
// NAME POOLS
// ============================================================
const FIRST_M = ['Emeka','Chidi','Tunde','Kelechi','Ifeanyi','Segun','Yusuf','Ibrahim','Musa','Abubakar','Bright','Godwin','Peter','John','Samuel','David','Daniel','Michael','Anthony','Victor'];
const FIRST_F = ['Chioma','Ngozi','Amina','Fatima','Zainab','Aisha','Blessing','Grace','Precious','Esther','Mary','Joy','Peace','Ruth','Sarah','Rebecca','Hannah','Glory','Favour','Faith'];
const LAST = ['Okafor','Adeyemi','Balogun','Eze','Nwosu','Ibrahim','Musa','Okonkwo','Obi','Adebayo','Oyelaran','Akpan','Etuk','Bassey','Aniefiok','Chukwu','Uche','Yakubu','Bello','Abiodun'];
const STATES = ['Cross River','Akwa Ibom','Rivers','Lagos','Kano','Kaduna','Oyo','Anambra','Enugu','Imo','Abia','Ebonyi','Delta','Edo','Bayelsa','Benue','Plateau','Borno','Katsina','Sokoto'];

const BOOK_TITLES = [
  'Introduction to Programming','Data Structures and Algorithms','Calculus Made Easy',
  'Linear Algebra Fundamentals','Organic Chemistry','Principles of Physics',
  'Engineering Mechanics','Electrical Circuit Theory','Financial Accounting',
  'Principles of Marketing','Business Statistics','Agricultural Science',
  'Environmental Studies','Technical Drawing','Thermodynamics',
  'Operating Systems','Database Systems','Computer Networks',
  'Software Engineering','Discrete Mathematics','Numerical Methods',
  'Fluid Mechanics','Materials Science','Strength of Materials',
  'Digital Electronics','Microeconomics','Macroeconomics','Cost Accounting',
  'Auditing Principles','Taxation in Nigeria','Animal Husbandry','Crop Science',
  'Urban Planning','Fashion Illustration','Graphic Design Principles',
];
const BOOK_CATEGORIES = ['Computer Science','Engineering','Mathematics','Physics','Chemistry','Biology','Business','Accountancy','Agriculture','Literature','General','Arts','Environmental'];
const PUBLISHERS = ['University Press','Macmillan Nigeria','Longman','Evans Brothers','Spectrum Books','Africana Publishers'];

function mapLevel(src) {
  const n = Number(src);
  if (n === 100 || n === 200) return { level: 'ND',  yearOfStudy: n === 100 ? 1 : 2 };
  if (n === 300 || n === 400) return { level: 'HND', yearOfStudy: n === 300 ? 1 : 2 };
  throw new Error('Unknown source level: ' + src);
}
function mapSemester(src) {
  return String(src).toLowerCase() === 'first' ? 'First' : 'Second';
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🌱  FPU merged seed (7 schools, 25 depts, 50 programmes)\n');

  // ----------------------------------------------------------
  // 0. Wipe
  // ----------------------------------------------------------
  console.log('🧹  Clearing tables…');
  const truncateOrder = [
    'assignment_submissions','assignments','course_materials',
    'exam_attendance','exam_schedules','attendance','timetable_slots',
    'results','course_registrations','course_allocations',
    'library_fines','book_reservations','borrow_records','books',
    'clearances','payments','fee_structures','graduations','documents',
    'complaints','messages','notifications','announcements',
    'photo_uploads','tokens','security_logs','audit_logs','login_history',
    'staff_profiles','applications','users',
    'courses','programmes','departments','schools',
    'academic_sessions','grade_scales','settings','study_levels',
  ];
  for (const t of truncateOrder) {
    try { await db.execute(sql.raw(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`)); }
    catch { /* table may not exist */ }
  }
  console.log('   ✓ cleared\n');

  // ----------------------------------------------------------
  // 1. Settings
  // ----------------------------------------------------------
  console.log('⚙️   Settings…');
  const settingRows = [
    { key: 'matric_prefix',       value: 'FPU',                       category: 'institution' },
    { key: 'max_units',           value: '24',                        category: 'academic' },
    { key: 'current_session',     value: '2025/2026',                 category: 'academic' },
    { key: 'current_semester',    value: 'first',                     category: 'academic' },
    { key: 'pass_mark',           value: '40',                        category: 'academic' },
    { key: 'session_ttl_hours',   value: '72',                        category: 'auth' },
    { key: 'bcrypt_rounds',       value: String(BCRYPT_ROUNDS),       category: 'auth' },
    { key: 'institution_name',    value: 'Federal Polytechnic Ugep',  category: 'institution' },
    { key: 'institution_motto',   value: 'Citadel of Technical Excellence', category: 'institution' },
    { key: 'institution_state',   value: 'Cross River State',         category: 'institution' },
    { key: 'institution_country', value: 'Nigeria',                   category: 'institution' },
    { key: 'institution_website', value: 'https://fedpolyugep.edu.ng', category: 'institution' },
  ];
  for (const r of settingRows) {
    await db.insert(settings).values(r)
      .onConflictDoUpdate({ target: settings.key, set: { value: r.value, category: r.category } });
  }
  console.log(`   ✓ ${settingRows.length} settings\n`);

  // ----------------------------------------------------------
  // 2. Grade scales
  // ----------------------------------------------------------
  console.log('📊  Grade scales…');
  for (const g of DEFAULT_GRADE_SCALE) {
    await db.insert(gradeScales).values({
      grade: g.grade, minScore: g.minScore, maxScore: g.maxScore,
      points: String(g.points), remark: g.remark,
    }).onConflictDoNothing();
  }
  console.log(`   ✓ ${DEFAULT_GRADE_SCALE.length} grade rows\n`);

  // ----------------------------------------------------------
  // 3. Study levels
  // ----------------------------------------------------------
  console.log('🎓  Study levels…');
  const studyLevelRows = [
    { code: 'ND1',  name: 'National Diploma Year 1',        level: 'ND',  yearOfStudy: 1 },
    { code: 'ND2',  name: 'National Diploma Year 2',        level: 'ND',  yearOfStudy: 2 },
    { code: 'HND1', name: 'Higher National Diploma Year 1', level: 'HND', yearOfStudy: 1 },
    { code: 'HND2', name: 'Higher National Diploma Year 2', level: 'HND', yearOfStudy: 2 },
    { code: 'CERT', name: 'Certificate',                    level: 'CERT', yearOfStudy: 1 },
  ];
  await db.insert(studyLevels).values(studyLevelRows).onConflictDoNothing();
  console.log(`   ✓ ${studyLevelRows.length} study levels\n`);

  // ----------------------------------------------------------
  // 4. Academic sessions
  // ----------------------------------------------------------
  console.log('📅  Sessions…');
  const sessionRows = [
    { name: '2023/2024', startDate: '2023-10-01', endDate: '2024-07-31', isCurrent: false },
    { name: '2024/2025', startDate: '2024-10-01', endDate: '2025-07-31', isCurrent: false },
    { name: '2025/2026', startDate: '2025-10-01', endDate: '2026-07-31', isCurrent: true  },
    { name: '2026/2027', startDate: '2026-10-01', endDate: '2027-07-31', isCurrent: false },
  ];
  const insertedSessions = await db.insert(academicSessions).values(sessionRows).returning();
  const currentSession = insertedSessions.find((s) => s.isCurrent);
  console.log(`   ✓ ${insertedSessions.length} sessions\n`);

  // ----------------------------------------------------------
  // 5. Schools
  // ----------------------------------------------------------
  console.log('🏫  Schools…');
  const insertedSchools = await db.insert(schools).values(SCHOOLS_DATA).returning();
  const schoolByCode = new Map(insertedSchools.map((s) => [s.code, s]));
  console.log(`   ✓ ${insertedSchools.length} schools\n`);

  // ----------------------------------------------------------
  // 6. Departments
  // ----------------------------------------------------------
  console.log('🏢  Departments…');
  const deptRows = DEPARTMENTS_DATA.map((d) => ({
    code: d.code, name: d.name, schoolId: schoolByCode.get(d.schoolCode).id,
  }));
  const insertedDepts = await db.insert(departments).values(deptRows).returning();
  const deptByCode = new Map(insertedDepts.map((d) => [d.code, d]));
  console.log(`   ✓ ${insertedDepts.length} departments\n`);

  // ----------------------------------------------------------
  // 7. Programmes
  // ----------------------------------------------------------
  console.log('📚  Programmes…');
  const progRows = PROGRAMMES_DATA.map((p) => ({
    code: p.code, name: p.name,
    departmentId: deptByCode.get(p.deptCode).id,
    level: p.level, durationYears: 2,
  }));
  const insertedProgs = await db.insert(programmes).values(progRows).returning();
  const progByCode = new Map(insertedProgs.map((p) => [p.code, p]));
  console.log(`   ✓ ${insertedProgs.length} programmes\n`);

  // ----------------------------------------------------------
  // 8. Courses
  // ----------------------------------------------------------
  console.log('📖  Courses…');
  let insertedCount = 0;
  for (const [progCode, list] of Object.entries(COURSES)) {
    const prog = progByCode.get(progCode);
    if (!prog) continue;
    const deptId = prog.departmentId;
    for (const [code, title, unit, srcLevel, srcSem] of list) {
      const { level, yearOfStudy } = mapLevel(srcLevel);
      const semesterName = mapSemester(srcSem);
      try {
        await db.insert(courses).values({
          code, title, unit, level, semesterName, yearOfStudy,
          programmeId: prog.id, departmentId: deptId,
          isElective: false, isActive: true,
        }).onConflictDoNothing();
        insertedCount++;
      } catch (e) {
        // ignore duplicates
      }
    }
  }
  console.log(`   ✓ ${insertedCount} course rows\n`);

  // ----------------------------------------------------------
  // 9. Users: admin + principals + HODs + lecturers
  // ----------------------------------------------------------
  console.log('👥  Staff users…');
  const adminPwd = await hash('admin1234');
  const princPwd = await hash('principal1234');
  const hodPwd   = await hash('hod1234');
  const lectPwd  = await hash('lecturer1234');
  const studPwd  = await hash('student1234');

  const [adminUser] = await db.insert(users).values({
    email: 'admin@fedpolyugep.edu.ng', passwordHash: adminPwd,
    role: 'admin', firstName: 'System', lastName: 'Administrator',
    phone: '+2348000000001',
  }).returning();

  const principals = [
    { email: 'rector@fedpolyugep.edu.ng',      role: 'rector',             firstName: 'Vincent', lastName: 'Azubuike' },
    { email: 'registrar@fedpolyugep.edu.ng',   role: 'registrar',          firstName: 'Grace',   lastName: 'Ekpo' },
    { email: 'bursar@fedpolyugep.edu.ng',      role: 'bursar',             firstName: 'Sunday',  lastName: 'Etim' },
    { email: 'librarian@fedpolyugep.edu.ng',   role: 'librarian',          firstName: 'Mary',    lastName: 'Effiong' },
    { email: 'exam@fedpolyugep.edu.ng',        role: 'exam_officer',       firstName: 'Peter',   lastName: 'Akpan' },
    { email: 'academic@fedpolyugep.edu.ng',    role: 'academic_officer',   firstName: 'Rebecca', lastName: 'Asuquo' },
    { email: 'admissions@fedpolyugep.edu.ng',  role: 'admission_officer',  firstName: 'Daniel',  lastName: 'Bassey' },
  ];
  const insertedPrincipals = await db.insert(users).values(
    principals.map((p) => ({
      email: p.email, passwordHash: princPwd, role: p.role,
      firstName: p.firstName, lastName: p.lastName,
      phone: `+2348${randInt(100000000, 999999999)}`,
    }))
  ).returning();

  // One HOD per department
  const hodRows = [];
  const allDepts = insertedDepts;
  for (let i = 0; i < allDepts.length; i++) {
    const dept = allDepts[i];
    const gender = i % 2 === 0 ? 'Male' : 'Female';
    const fn = gender === 'Male' ? FIRST_M[i % FIRST_M.length] : FIRST_F[i % FIRST_F.length];
    const ln = LAST[(i * 3) % LAST.length];
    hodRows.push({
      email: `hod.${dept.code.toLowerCase()}@fedpolyugep.edu.ng`,
      passwordHash: hodPwd, role: 'hod',
      firstName: fn, lastName: ln,
      phone: `+2348${randInt(100000000, 999999999)}`,
      departmentId: dept.id, schoolId: dept.schoolId,
    });
  }
  const insertedHods = await db.insert(users).values(hodRows).returning();

  // Lecturers: 2 per department
  const lecturerRows = [];
  for (const dept of allDepts) {
    for (let k = 0; k < 2; k++) {
      const gender = (dept.id + k) % 2 === 0 ? 'Male' : 'Female';
      const fn = gender === 'Male' ? pick(FIRST_M) : pick(FIRST_F);
      const ln = pick(LAST);
      lecturerRows.push({
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${dept.code.toLowerCase()}${k}@fedpolyugep.edu.ng`,
        passwordHash: lectPwd, role: 'lecturer',
        firstName: fn, lastName: ln, gender,
        phone: `+2348${randInt(100000000, 999999999)}`,
        departmentId: dept.id, schoolId: dept.schoolId,
      });
    }
  }
  const insertedLecturers = await db.insert(users).values(lecturerRows).returning();

  // Staff profiles
  const staffRows = [
    ...insertedHods.map((u) => ({
      userId: u.id, departmentId: u.departmentId,
      rank: 'Chief Lecturer', isHod: true, employmentDate: '2015-09-01',
    })),
    ...insertedLecturers.map((u) => ({
      userId: u.id, departmentId: u.departmentId,
      rank: 'Lecturer I', isHod: false, employmentDate: '2018-09-01',
    })),
  ];
  await db.insert(staffProfiles).values(staffRows);

  for (const h of insertedHods) {
    await db.update(departments)
      .set({ hodUserId: h.id })
      .where(sql`${departments.id} = ${h.departmentId}`);
  }

  console.log(`   ✓ admin + ${insertedPrincipals.length} principals + ${insertedHods.length} HODs + ${insertedLecturers.length} lecturers\n`);

  // ----------------------------------------------------------
  // 10. Students (one cohort per programme)
  // ----------------------------------------------------------
  console.log('🎓  Students…');
  const studentRows = [];
  const year = '26';
  const matricSerials = new Map();

  for (const prog of insertedProgs) {
    const dept = insertedDepts.find((d) => d.id === prog.departmentId);
    const school = insertedSchools.find((s) => s.id === dept.schoolId);
    const cohortSize = 8;
    for (let i = 0; i < cohortSize; i++) {
      const gender = (i + prog.id) % 2 === 0 ? 'Male' : 'Female';
      const fn = gender === 'Male' ? FIRST_M[(i + prog.id) % FIRST_M.length] : FIRST_F[(i + prog.id) % FIRST_F.length];
      const ln = LAST[(i * 3 + prog.id) % LAST.length];

      const serialKey = `${prog.id}-${year}`;
      const serial = (matricSerials.get(serialKey) || 0) + 1;
      matricSerials.set(serialKey, serial);

      const matricNumber = `FPU/${school.code}/${dept.code}/${prog.level}/${year}/${pad(serial)}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${prog.code.toLowerCase()}${i}@student.fpu.edu.ng`;

      studentRows.push({
        email, passwordHash: studPwd, role: 'student',
        firstName: fn, lastName: ln, gender,
        dateOfBirth: `200${randInt(0, 6)}-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}`,
        stateOfOrigin: pick(STATES),
        phone: `+2348${randInt(100000000, 999999999)}`,
        matricNumber, level: prog.level,
        departmentId: dept.id, schoolId: school.id,
        programmeId: prog.id,
        currentSessionId: currentSession.id,
      });
    }
  }
  const insertedStudents = await db.insert(users).values(studentRows).returning();
  console.log(`   ✓ ${insertedStudents.length} students\n`);

  // ----------------------------------------------------------
  // 11. Fee structures (per programme × level × session)
  // ----------------------------------------------------------
  console.log('💵  Fee structures…');
  const feeRows = [];
  for (const s of insertedSessions) {
    for (const p of insertedProgs) {
      const tuition    = p.level === 'HND' ? randInt(45000, 55000) : randInt(35000, 45000);
      const acceptance = 5000, medical = 3000, library = 2000, ict = 3000, sports = 1000, other = 2000;
      const total = tuition + acceptance + medical + library + ict + sports + other;
      feeRows.push({
        programmeId: p.id, level: p.level, sessionId: s.id,
        tuition: String(tuition), acceptance: String(acceptance),
        medical: String(medical), library: String(library),
        ict: String(ict), sports: String(sports), other: String(other),
        total: String(total),
      });
    }
  }
  await db.insert(feeStructures).values(feeRows);
  console.log(`   ✓ ${feeRows.length} fee structures\n`);

  // ----------------------------------------------------------
  // 12. Course allocations
  // ----------------------------------------------------------
  console.log('🔗  Allocations…');
  const allCourses = await db.select().from(courses);
  const allocRows = [];
  for (const c of allCourses) {
    const deptLecturers = insertedLecturers.filter((l) => l.departmentId === c.departmentId);
    const lecturer = deptLecturers.length ? pick(deptLecturers) : insertedLecturers[0];
    allocRows.push({
      courseId: c.id, lecturerId: lecturer.id,
      sessionId: currentSession.id, semester: c.semesterName === 'First' ? 'first' : 'second',
    });
  }
  // De-dup
  const seenAlloc = new Set();
  const allocUnique = [];
  for (const a of allocRows) {
    const k = `${a.courseId}-${a.lecturerId}-${a.sessionId}-${a.semester}`;
    if (seenAlloc.has(k)) continue;
    seenAlloc.add(k); allocUnique.push(a);
  }
  for (let i = 0; i < allocUnique.length; i += 500) {
    await db.insert(courseAllocations).values(allocUnique.slice(i, i + 500)).onConflictDoNothing();
  }
  console.log(`   ✓ ${allocUnique.length} allocations\n`);

  // ----------------------------------------------------------
  // 13. Course registrations
  // ----------------------------------------------------------
  console.log('📝  Registrations…');
  const regRows = [];
  const studentRegMap = new Map();
  for (const st of insertedStudents) {
    const studentCourses = allCourses.filter((c) => c.programmeId === st.programmeId);
    const picked = studentCourses.slice(0, Math.min(8, studentCourses.length));
    studentRegMap.set(st.id, picked);
    for (const c of picked) {
      regRows.push({
        studentId: st.id, courseId: c.id,
        sessionId: currentSession.id,
        semester: c.semesterName === 'First' ? 'first' : 'second',
        status: 'approved',
      });
    }
  }
  for (let i = 0; i < regRows.length; i += 500) {
    await db.insert(courseRegistrations).values(regRows.slice(i, i + 500)).onConflictDoNothing();
  }
  console.log(`   ✓ ${regRows.length} registrations\n`);

  // ----------------------------------------------------------
  // 14. Results
  // ----------------------------------------------------------
  console.log('📊  Results…');
  const prevSession = insertedSessions.find((s) => s.name === '2024/2025');
  const resultRows = [];
  function scoreToGradeSync(score) {
    for (const g of DEFAULT_GRADE_SCALE) {
      if (score >= g.minScore && score <= g.maxScore) return g;
    }
    return DEFAULT_GRADE_SCALE[DEFAULT_GRADE_SCALE.length - 1];
  }
  for (const st of insertedStudents) {
    const list = studentRegMap.get(st.id) || [];
    for (const c of list) {
      const score = randInt(35, 95);
      const g = scoreToGradeSync(score);
      resultRows.push({
        studentId: st.id, courseId: c.id,
        sessionId: prevSession.id,
        semester: c.semesterName === 'First' ? 'first' : 'second',
        score: String(score), grade: g.grade, points: String(g.points),
        status: 'published',
        approvedBy: adminUser.id,
        approvedAt: new Date(),
        publishedAt: new Date(),
      });
    }
  }
  for (let i = 0; i < resultRows.length; i += 500) {
    await db.insert(results).values(resultRows.slice(i, i + 500)).onConflictDoNothing();
  }
  console.log(`   ✓ ${resultRows.length} results\n`);

  // ----------------------------------------------------------
  // 15. Payments (60% of students)
  // ----------------------------------------------------------
  console.log('💳  Payments…');
  const paymentRows = [];
  for (const st of insertedStudents) {
    const fs = feeRows.find((f) => f.programmeId === st.programmeId && f.level === st.level && f.sessionId === currentSession.id);
    if (!fs) continue;
    if (rand() > 0.4) {
      paymentRows.push({
        studentId: st.id, sessionId: currentSession.id, feeStructureId: null,
        amount: fs.total,
        reference: `FPU-${Date.now()}-${st.id}-${randInt(1000, 9999)}`,
        bankName: pick(['ECOBANK','MONIEPOINT / OPAY','OPAY']),
        depositorName: `${st.firstName} ${st.lastName}`,
        depositDate: `2025-10-${pad(randInt(1, 28), 2)}`,
        status: rand() > 0.2 ? 'verified' : 'pending',
        verifiedBy: rand() > 0.2 ? insertedPrincipals.find((p) => p.role === 'bursar')?.id || adminUser.id : null,
        verifiedAt: rand() > 0.2 ? new Date() : null,
      });
    }
  }
  for (let i = 0; i < paymentRows.length; i += 500) {
    await db.insert(payments).values(paymentRows.slice(i, i + 500));
  }
  console.log(`   ✓ ${paymentRows.length} payments\n`);

  // ----------------------------------------------------------
  // 16. Clearances
  // ----------------------------------------------------------
  console.log('✅  Clearances…');
  const clearanceRows = [];
  for (const p of paymentRows.filter((p) => p.status === 'verified')) {
    clearanceRows.push({
      studentId: p.studentId, sessionId: currentSession.id, type: 'semester',
      status: 'cleared',
      clearedBy: insertedPrincipals.find((x) => x.role === 'bursar')?.id || adminUser.id,
      clearedAt: new Date(),
    });
  }
  if (clearanceRows.length) {
    for (let i = 0; i < clearanceRows.length; i += 500) {
      await db.insert(clearances).values(clearanceRows.slice(i, i + 500)).onConflictDoNothing();
    }
  }
  console.log(`   ✓ ${clearanceRows.length} clearances\n`);

  // ----------------------------------------------------------
  // 17. Timetable
  // ----------------------------------------------------------
  console.log('🗓️   Timetable…');
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const VENUES = ['LT1','LT2','LT3','Lab A','Lab B','Hall 1','Hall 2'];
  const ttRows = [];
  for (const c of allCourses) {
    for (let i = 0; i < 2; i++) {
      const startH = 8 + i * 2;
      ttRows.push({
        courseId: c.id, sessionId: currentSession.id,
        semester: c.semesterName === 'First' ? 'first' : 'second',
        dayOfWeek: pick(DAYS),
        startTime: `${String(startH).padStart(2, '0')}:00`,
        endTime: `${String(startH + 1).padStart(2, '0')}:30`,
        venue: pick(VENUES),
      });
    }
  }
  for (let i = 0; i < ttRows.length; i += 500) {
    await db.insert(timetableSlots).values(ttRows.slice(i, i + 500));
  }
  console.log(`   ✓ ${ttRows.length} timetable slots\n`);

  // ----------------------------------------------------------
  // 18. Exams
  // ----------------------------------------------------------
  console.log('📋  Exams…');
  const examRows = [];
  for (const c of allCourses) {
    examRows.push({
      courseId: c.id, sessionId: currentSession.id,
      semester: c.semesterName === 'First' ? 'first' : 'second',
      examDate: `2026-0${randInt(1, 3)}-${pad(randInt(1, 28), 2)}`,
      startTime: '09:00', endTime: '11:00',
      venue: pick(VENUES),
      invigilators: `${insertedLecturers[0].firstName} ${insertedLecturers[0].lastName}`,
    });
  }
  for (let i = 0; i < examRows.length; i += 500) {
    await db.insert(examSchedules).values(examRows.slice(i, i + 500));
  }
  console.log(`   ✓ ${examRows.length} exam schedules\n`);

  // ----------------------------------------------------------
  // 19. Attendance (sample)
  // ----------------------------------------------------------
  console.log('🙋  Attendance…');
  const attRows = [];
  for (const st of insertedStudents.slice(0, 40)) {
    const list = (studentRegMap.get(st.id) || []).slice(0, 3);
    for (const c of list) {
      for (let d = 0; d < 5; d++) {
        attRows.push({
          courseId: c.id, studentId: st.id,
          lecturerId: insertedLecturers.find((l) => l.departmentId === c.departmentId)?.id || insertedLecturers[0].id,
          sessionId: currentSession.id,
          semester: c.semesterName === 'First' ? 'first' : 'second',
          date: `2025-11-${pad(d + 1, 2)}`,
          status: rand() > 0.15 ? 'present' : pick(['absent','late','excused']),
        });
      }
    }
  }
  for (let i = 0; i < attRows.length; i += 500) {
    await db.insert(attendance).values(attRows.slice(i, i + 500)).onConflictDoNothing();
  }
  console.log(`   ✓ ${attRows.length} attendance records\n`);

  // ----------------------------------------------------------
  // 20. Books
  // ----------------------------------------------------------
  console.log('📚  Books…');
  const bookRows = [];
  for (let i = 0; i < 400; i++) {
    const title = BOOK_TITLES[i % BOOK_TITLES.length];
    const copies = randInt(1, 8);
    bookRows.push({
      title: `${title}${i > BOOK_TITLES.length - 1 ? ' (Vol. ' + (Math.floor(i / BOOK_TITLES.length) + 1) + ')' : ''}`,
      author: `${pick(FIRST_M)} ${pick(LAST)}`,
      isbn: `978-${randInt(100, 999)}-${randInt(10000, 99999)}-${i % 10}`,
      category: pick(BOOK_CATEGORIES),
      publisher: pick(PUBLISHERS),
      year: randInt(2000, 2025),
      copiesTotal: copies, copiesAvailable: copies,
      shelf: `SH-${String.fromCharCode(65 + (i % 12))}-${pad(i % 100, 2)}`,
    });
  }
  const insertedBooks = await db.insert(books).values(bookRows).returning();
  console.log(`   ✓ ${insertedBooks.length} books\n`);

  // ----------------------------------------------------------
  // 21. Borrows + fines
  // ----------------------------------------------------------
  console.log('📕  Borrows + fines…');
  const borrowRows = [];
  for (let i = 0; i < 40; i++) {
    const book = insertedBooks[i];
    const student = insertedStudents[i % insertedStudents.length];
    const borrowedAt = new Date(Date.now() - randInt(1, 60) * 24 * 3600 * 1000);
    const dueAt = new Date(borrowedAt.getTime() + 14 * 24 * 3600 * 1000);
    const returned = rand() > 0.5;
    borrowRows.push({
      bookId: book.id, userId: student.id,
      borrowedAt, dueAt,
      returnedAt: returned ? new Date() : null,
      status: returned ? 'returned' : (dueAt < new Date() ? 'overdue' : 'borrowed'),
      issuedBy: insertedPrincipals.find((p) => p.role === 'librarian')?.id || adminUser.id,
      receivedBy: returned ? (insertedPrincipals.find((p) => p.role === 'librarian')?.id || adminUser.id) : null,
    });
  }
  await db.insert(borrowRecords).values(borrowRows);

  const fineRows = [];
  for (let i = 0; i < 15; i++) {
    fineRows.push({
      userId: insertedStudents[i].id,
      amount: String(randInt(200, 1500)),
      reason: pick(['Late return','Damaged book','Lost book']),
      isPaid: rand() > 0.6,
      paidAt: rand() > 0.6 ? new Date() : null,
    });
  }
  await db.insert(libraryFines).values(fineRows);
  console.log(`   ✓ ${borrowRows.length} borrows + ${fineRows.length} fines\n`);

  // ----------------------------------------------------------
  // 22. Complaints
  // ----------------------------------------------------------
  console.log('💬  Complaints…');
  const complaintRows = [];
  for (let i = 0; i < 20; i++) {
    const st = insertedStudents[i % insertedStudents.length];
    complaintRows.push({
      userId: st.id,
      subject: pick(['Hostel facilities','Course materials','Exam timetable','Fee payment issue','Library services','Internet access']),
      body: 'Please look into this matter as soon as possible. Thank you.',
      category: pick(['academic','facility','finance','welfare']),
      status: pick(['open','in_review','resolved']),
    });
  }
  await db.insert(complaints).values(complaintRows);
  console.log(`   ✓ ${complaintRows.length} complaints\n`);

  // ----------------------------------------------------------
  // 23. Announcements
  // ----------------------------------------------------------
  console.log('📢  Announcements…');
  const annRows = [
    { title: 'Welcome to 2025/2026 Session',  body: 'Academic activities commence October 1st, 2025.', audience: 'all',     priority: 'high'   },
    { title: 'Course Registration Opens',     body: 'Registration closes on November 15, 2025.',        audience: 'student', priority: 'high'   },
    { title: 'Staff Meeting',                 body: 'Mandatory staff meeting Friday at 10 AM.',         audience: 'staff',   priority: 'normal' },
    { title: 'Exam Timetable Released',       body: 'First semester exams begin January 12, 2026.',     audience: 'student', priority: 'high'   },
    { title: 'Library Extended Hours',        body: 'The library will remain open until 10 PM.',        audience: 'all',     priority: 'normal' },
    { title: 'New Books Arrived',             body: 'Over 400 new titles added.',                       audience: 'all',     priority: 'low'    },
    { title: 'Fee Payment Deadline',          body: 'All fees must be paid before November 30, 2025.',  audience: 'student', priority: 'high'   },
    { title: 'Result Publication',            body: '2024/2025 results are now available.',             audience: 'student', priority: 'high'   },
  ].map((a) => ({ ...a, authorId: adminUser.id }));
  await db.insert(announcements).values(annRows);
  console.log(`   ✓ ${annRows.length} announcements\n`);

  // ----------------------------------------------------------
  // 24. Notifications (sample)
  // ----------------------------------------------------------
  console.log('🔔  Notifications…');
  const notifRows = [];
  for (const st of insertedStudents.slice(0, 30)) {
    notifRows.push({ userId: st.id, title: 'Welcome to FPU Portal', body: 'Your account is ready.', type: 'info' });
    notifRows.push({ userId: st.id, title: 'Fee Payment Reminder',  body: 'Please complete your fee payment.', type: 'warning' });
  }
  for (let i = 0; i < notifRows.length; i += 500) {
    await db.insert(notifications).values(notifRows.slice(i, i + 500));
  }
  console.log(`   ✓ ${notifRows.length} notifications\n`);

  // ----------------------------------------------------------
  // 25. Graduations (a few HND students)
  // ----------------------------------------------------------
  console.log('🎉  Graduations…');
  const gradRows = [];
  for (const st of insertedStudents.filter((s) => s.level === 'HND').slice(0, 8)) {
    gradRows.push({
      studentId: st.id, sessionId: currentSession.id,
      programmeId: st.programmeId, level: 'HND',
      cgpa: String((Math.round((2.5 + rand() * 1.4) * 100) / 100).toFixed(2)),
      classification: pick(['Upper Credit','Lower Credit','Distinction']),
      status: 'approved',
      approvedBy: insertedPrincipals.find((p) => p.role === 'registrar')?.id || adminUser.id,
      approvedAt: new Date(),
    });
  }
  if (gradRows.length) await db.insert(graduations).values(gradRows).onConflictDoNothing();
  console.log(`   ✓ ${gradRows.length} graduations\n`);

  // ----------------------------------------------------------
  // DONE
  // ----------------------------------------------------------
  console.log('✨  Seed complete!\n');
  console.log('   Logins:');
  console.log('     admin@fedpolyugep.edu.ng              / admin1234');
  console.log('     rector@fedpolyugep.edu.ng             / principal1234');
  console.log('     hod.csc@fedpolyugep.edu.ng            / hod1234');
  console.log('     (any lecturer email above)            / lecturer1234');
  console.log('     (any student email above)             / student1234');
  console.log('');
  console.log(`   Totals:  ${insertedSchools.length} schools · ${insertedDepts.length} depts · ${insertedProgs.length} programmes · ${insertedCount} courses`);
  console.log(`            ${insertedStudents.length} students · ${paymentRows.length} payments · ${resultRows.length} results`);
  console.log('');
}

// ============================================================
main()
  .then(async () => { await close(); process.exit(0); })
  .catch(async (err) => {
    console.error('❌  Seed failed:', err);
    try { await close(); } catch {}
    process.exit(1);
  });