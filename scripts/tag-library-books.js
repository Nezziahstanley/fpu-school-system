// ============================================================
// scripts/tag-library-books.js
// Bulk-tag books with department_id and is_general.
// ============================================================
'use strict';
require('dotenv').config();
const { db, pool, schema } = require('../db');
const { eq } = require('drizzle-orm');
const { books, departments } = schema;

// Story / fiction — visible to every student
const GENERAL_PATTERNS = [
  /fiction/i, /novel/i, /story/i, /stories/i, /biography/i,
  /autobiography/i, /memoir/i, /poetry/i, /drama/i, /plays/i,
];

// Title keyword → department code keywords to match against the
// `name` field of `departments` (safer than relying on codes)
const TITLE_RULES = [
  // Engineering & technology
  { match: /computer|programming|software|algorithm|database|network|data structure|java|python|c\+\+|web|ict|information tech/i, deptName: /computer|software|ict|information tech/i },
  { match: /mechanical|thermodynamic|machine|workshop/i, deptName: /mechanical/i },
  { match: /electrical|electronic|circuit|power system/i, deptName: /electrical|electronic/i },
  { match: /civil|structures|surveying|concrete|soil/i, deptName: /civil/i },
  { match: /agricultural|agric|farm|crop|animal husbandry|soil science/i, deptName: /agric/i },

  // Sciences
  { match: /mathematics|calculus|algebra|statistics|maths/i, deptName: /math|statistic/i },
  { match: /physics|astronomy/i, deptName: /physics/i },
  { match: /chemistry|biochemistry|organic|inorganic/i, deptName: /chem/i },
  { match: /biology|botany|zoology|microbiology|ecology/i, deptName: /biolog/i },

  // Business
  { match: /accounting|auditing|taxation|bookkeeping|financial accounting/i, deptName: /account/i },
  { match: /business|management|marketing|entrepreneur/i, deptName: /business|management|marketing/i },
  { match: /economics|banking|finance|insurance/i, deptName: /economic|banking|finance/i },

  // Arts & humanities
  { match: /english|literature|language|linguistic|grammar/i, deptName: /english|language|literature/i },
  { match: /history|civilisation|culture|government|political/i, deptName: /history|government|political/i },
  { match: /sociology|social work|psychology/i, deptName: /sociolog|social|psycholog/i },
  { match: /education|pedagogy|teaching|curriculum/i, deptName: /education/i },

  // Health & environment
  { match: /health|nursing|medical|anatomy|physiology/i, deptName: /health|nursing|medical/i },
  { match: /environment|geography|conservation/i, deptName: /environment|geograph/i },
  { match: /urban|regional|planning|architecture/i, deptName: /urban|regional|planning|architect/i },

  // Library science
  { match: /library|cataloguing|archival|information science/i, deptName: /library/i },
];

(async () => {
  try {
    const depts = await db.select().from(departments);
    console.log(`\nDepartments (${depts.length}):`);
    depts.forEach((d) => console.log(`  ${d.id}  ${d.code}  ${d.name}`));

    if (!depts.length) {
      console.error('\n✖ No departments found. Check DATABASE_URL.');
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

      // Story / general check — category first, then title
      if (b.category && GENERAL_PATTERNS.some((re) => re.test(b.category))) {
        newIsGeneral = true;
      } else if (GENERAL_PATTERNS.some((re) => re.test(b.title))) {
        newIsGeneral = true;
      } else {
        // Match against department by NAME (not code)
        for (const rule of TITLE_RULES) {
          if (rule.match.test(b.title) || rule.match.test(b.category || '')) {
            const match = depts.find((d) => rule.deptName.test(d.name));
            if (match) { newDeptId = match.id; break; }
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
        const match = depts.find((d) => d.id === newDeptId);
        const label = match ? `${match.code} (${match.name})` : '?';
        summary[label] = (summary[label] || 0) + 1;
      }
    }

    console.log('\n✔ Done.');
    console.log(`  Department books:  ${deptCount}`);
    console.log(`  General/story:     ${generalCount}`);
    console.log(`  Hidden (no match): ${hidden}`);
    if (Object.keys(summary).length) {
      console.log('\n  By department:');
      Object.entries(summary).sort().forEach(([k, n]) => console.log(`    ${k}: ${n}`));
    }
  } catch (err) {
    console.error('FAILED:', err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();