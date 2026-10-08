// ============================================================
// scripts/tag-library-books.js
// Bulk-tag books with department_id and is_general.
// Uses the REAL department codes in this project's DB.
// ============================================================
'use strict';

// Allow pointing this script at .env.neon via env override
if (process.env.ENV_FILE) {
  require('dotenv').config({ path: process.env.ENV_FILE });
} else {
  require('dotenv').config();
}

const { db, pool, schema } = require('../db');
const { eq } = require('drizzle-orm');
const { books, departments } = schema;

// Story / fiction — visible to every student, no dept needed
const GENERAL_PATTERNS = [
  /fiction/i, /novel/i, /story/i, /stories/i, /biography/i,
  /autobiography/i, /memoir/i, /poetry/i, /drama/i, /plays/i,
  /short stories/i,
];

// Title/category keyword → department CODE (must exist in your
// departments table). First match wins, so order matters:
// more specific rules first.
const TITLE_RULES = [
  // ---- Engineering / Technology ----
  { match: /computer engineering|embedded|microprocessor|hardware design/i,        dept: 'CEN' },
  { match: /artificial intelligence|machine learning|neural|deep learning|ai\b/i,  dept: 'AIT' },
  { match: /computer|programming|software|algorithm|database|network|data structure|java|python|c\+\+|web|ict|information tech|data scien/i, dept: 'CSC' },
  { match: /mechanical|thermodynamic|machine|workshop|fluid mechanic/i,            dept: 'MEC' },
  { match: /electrical|electronic|circuit|power system|signal process/i,           dept: 'EEE' },
  { match: /civil|structures|surveying|concrete|soil mechanic/i,                   dept: 'CIV' },
  { match: /architectural|building design|urban design/i,                          dept: 'ARC' },
  { match: /urban|regional|town planning|planning/i,                               dept: 'URP' },

  // ---- Sciences ----
  { match: /agricultural|agric|farm|crop|animal husbandry|soil science|fisheries|animal science/i, dept: 'AGR' },
  { match: /animal science|fisheries|livestock|poultry/i,                          dept: 'ANS' },
  { match: /statistics|statistic|probability|sampling/i,                           dept: 'STA' },
  { match: /laboratory technology|science laboratory|chemistry|biochemistry|physics|biology|botany|zoology|microbiology|ecology|organic|inorganic|calculus|algebra|mathematics|maths/i, dept: 'SLT' },

  // ---- Business & Management ----
  { match: /accounting|auditing|taxation|bookkeeping|financial accounting/i,      dept: 'ACC' },
  { match: /business admin|management|marketing|entrepreneur|business/i,          dept: 'BAM' },
  { match: /marketing|consumer behaviour|advertising|sales/i,                     dept: 'MKT' },
  { match: /public admin|public administration|government|political science/i,    dept: 'PAD' },
  { match: /entrepreneurship|startup|small business|innovation/i,                 dept: 'ENT' },
  { match: /hospitality|tourism|hotel|travel/i,                                   dept: 'HTM' },

  // ---- Arts & design ----
  { match: /fine art|painting|sculpture|visual art/i,                             dept: 'FAD' },
  { match: /fashion|textile|garment/i,                                            dept: 'FAS' },
  { match: /graphics|graphic design|typography|layout/i,                          dept: 'GRD' },

  // ---- Health / environment ----
  { match: /environmental health|public health|sanitation|epidemiology/i,         dept: 'EVH' },

  // ---- Library science ----
  { match: /library|cataloguing|archival|information science/i,                   dept: 'LIS' },

  // ---- Vocational / general studies ----
  { match: /vocational|technical education|workshop practice|trade/i,             dept: 'VOC' },
  { match: /general studies|gns|communication in english|use of english|citizenship/i, dept: 'GNS' },
];

(async () => {
  const url = process.env.DATABASE_URL || '';
  const target = /neon\.tech/.test(url) ? 'Neon (production)' : /localhost|127\.0\.0\.1/.test(url) ? 'LOCAL Docker' : 'unknown';
  console.log(`\n▶ DATABASE_URL points at: ${target}`);
  if (target === 'LOCAL Docker') {
    console.warn('⚠  This is your local DB, not Neon. If you meant Neon, set ENV_FILE=.env.neon');
  }

  try {
    const depts = await db.select().from(departments);
    console.log(`\nDepartments (${depts.length}):`);
    const byCode = new Map();
    depts.forEach((d) => {
      byCode.set(String(d.code).toUpperCase(), d.id);
      console.log(`  ${d.id.toString().padStart(3)}  ${d.code.padEnd(5)}  ${d.name}`);
    });

    if (!depts.length) {
      console.error('\n✖ No departments found.');
      process.exitCode = 1;
      return;
    }

    const allBooks = await db.select().from(books);
    console.log(`\nTagging ${allBooks.length} books…\n`);

    let deptCount = 0, generalCount = 0, hidden = 0;
    const summary = {};

    for (const b of allBooks) {
      let newDeptId = null;
      let newIsGeneral = false;

      // Story / general — check category then title
      if (b.category && GENERAL_PATTERNS.some((re) => re.test(b.category))) {
        newIsGeneral = true;
      } else if (GENERAL_PATTERNS.some((re) => re.test(b.title))) {
        newIsGeneral = true;
      } else {
        for (const rule of TITLE_RULES) {
          if (rule.match.test(b.title) || rule.match.test(b.category || '')) {
            const id = byCode.get(rule.dept);
            if (id) { newDeptId = id; break; }
          }
        }
      }

      if (!newDeptId && !newIsGeneral) { hidden++; continue; }

      await db.update(books).set({
        departmentId: newDeptId,
        isGeneral: newIsGeneral,
      }).where(eq(books.id, b.id));

      if (newIsGeneral) {
        generalCount++;
      } else {
        deptCount++;
        const code = [...byCode.entries()].find(([, id]) => id === newDeptId)?.[0] || '?';
        summary[code] = (summary[code] || 0) + 1;
      }
    }

    console.log('\n✔ Done.');
    console.log(`  Department books:  ${deptCount}`);
    console.log(`  General/story:     ${generalCount}`);
    console.log(`  Hidden (no match): ${hidden}`);
    if (Object.keys(summary).length) {
      console.log('\n  By department:');
      Object.entries(summary).sort().forEach(([code, n]) => console.log(`    ${code.padEnd(5)} ${n}`));
    }
} catch (err) {
  console.error('\n✖ FAILED');
  console.error('  message:', err.message);
  if (err.cause) console.error('  cause:  ', err.cause.message || err.cause);
  if (err.query) console.error('  query:  ', err.query);
  if (err.stack) console.error('\n' + err.stack.split('\n').slice(0, 8).join('\n'));
  process.exitCode = 1;
}
})();