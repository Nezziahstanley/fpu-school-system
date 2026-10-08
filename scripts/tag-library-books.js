// ============================================================
// scripts/tag-library-books.js
// Bulk-tag books with department_id and is_general based on
// title keywords. Runs against DATABASE_URL from environment.
// Safe to re-run.
// ============================================================
'use strict';
require('dotenv').config();
const { db, pool, schema } = require('../db');
const { eq } = require('drizzle-orm');
const { books, departments } = schema;

// Order matters — first match wins. Put the more specific rules first.
const TITLE_RULES = [
  // Engineering / technology
  { match: /computer|programming|software|algorithm|database|network|data structure|java|python|c\+\+|web|ict|information tech/i, dept: 'CSE' },
  { match: /mechanical|thermodynamic|machine|workshop/i, dept: 'MEE' },
  { match: /electrical|electronic|circuit|power system/i, dept: 'EEE' },
  { match: /civil|structures|surveying|concrete|soil/i, dept: 'CEE' },
  { match: /agricultural|agric|farm|crop|animal husbandry|soil science/i, dept: 'ACE' },

  // Sciences
  { match: /mathematics|calculus|algebra|statistics|maths/i, dept: 'MTH' },
  { match: /physics|astronomy/i, dept: 'PHY' },
  { match: /chemistry|biochemistry|organic|inorganic/i, dept: 'CHM' },
  { match: /biology|botany|zoology|microbiology|ecology/i, dept: 'BIO' },

  // Business
  { match: /accounting|auditing|taxation|bookkeeping|financial accounting/i, dept: 'ACC' },
  { match: /business|management|marketing|entrepreneur/i, dept: 'BUS' },
  { match: /economics|banking|finance|insurance/i, dept: 'FIN' },

  // Arts / humanities
  { match: /english|literature|language|linguistic|grammar/i, dept: 'LAN' },
  { match: /history|civilisation|culture|government|political/i, dept: 'SOC' },
  { match: /sociology|social work|psychology/i, dept: 'SOC' },
  { match: /education|pedagogy|teaching|curriculum/i, dept: 'EDU' },

  // Health / environmental
  { match: /health|nursing|medical|anatomy|physiology/i, dept: 'HSC' },
  { match: /environment|geography|conservation/i, dept: 'ENV' },
  { match: /urban|regional|planning|architecture/i, dept: 'URP' },

  // Library science
  { match: /library|cataloguing|archival|information science/i, dept: 'LIB' },
];

// Story / fiction — visible to every student regardless of dept
const GENERAL_PATTERNS = [
  /fiction/i, /novel/i, /story/i, /stories/i, /biography/i,
  /autobiography/i, /memoir/i, /poetry/i, /drama/i, /plays/i,
];

(async () => {
  try {
    const depts = await db.select().from(departments);
    const byCode = new Map(depts.map((d) => [String(d.code).toUpperCase(), d.id]));
    console.log(`Departments found: ${depts.length}`);
    console.log([...byCode.keys()].join(', '));

    if (!depts.length) {
      console.error('\n✖ No departments in DB. Check DATABASE_URL — you might be pointed at the wrong database.');
      process.exitCode = 1;
      return;
    }

    const allBooks = await db.select().from(books);
    console.log(`\nTagging ${allBooks.length} books…`);

    let deptCount = 0, generalCount = 0, hidden = 0;
    const summary = {};

    for (const b of allBooks) {
      let newDeptId = null;
      let newIsGeneral = false;

      // 1. Story / fiction — check category first, then title
      if (b.category && GENERAL_PATTERNS.some((re) => re.test(b.category))) {
        newIsGeneral = true;
      } else if (GENERAL_PATTERNS.some((re) => re.test(b.title))) {
        newIsGeneral = true;
      }
      // 2. Otherwise, try title + category against dept rules
      else {
        for (const rule of TITLE_RULES) {
          if (rule.match.test(b.title) || rule.match.test(b.category || '')) {
            const id = byCode.get(rule.dept);
            if (id) { newDeptId = id; break; }
          }
        }
      }

      if (!newDeptId && !newIsGeneral) {
        hidden++;
        continue;
      }

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
    console.log(`  Department books tagged: ${deptCount}`);
    console.log(`  General/story books:     ${generalCount}`);
    console.log(`  Hidden (no match):       ${hidden}`);
    if (Object.keys(summary).length) {
      console.log('\n  By department:');
      Object.entries(summary).sort().forEach(([code, n]) => console.log(`    ${code}: ${n}`));
    }
    console.log('\nRe-run this script any time — it is idempotent.');
  } catch (err) {
    console.error('FAILED:', err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();