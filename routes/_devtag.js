// Temporary route — DELETE after running once.
'use strict';
const express = require('express');
const router = express.Router();
const { db, schema } = require('../db');
const { eq } = require('drizzle-orm');
const { books, departments } = schema;

const GENERAL_PATTERNS = [
  /fiction/i, /novel/i, /story/i, /stories/i, /biography/i,
  /autobiography/i, /memoir/i, /poetry/i, /drama/i, /plays/i,
];

const TITLE_RULES = [
  { match: /computer engineering|embedded|microprocessor/i, dept: 'CEN' },
  { match: /artificial intelligence|machine learning|neural|deep learning/i, dept: 'AIT' },
  { match: /computer|programming|software|algorithm|database|network|data structure|java|python|c\+\+|web|ict|information tech|data scien/i, dept: 'CSC' },
  { match: /mechanical|thermodynamic|machine|workshop|fluid mechanic/i, dept: 'MEC' },
  { match: /electrical|electronic|circuit|power system|signal process/i, dept: 'EEE' },
  { match: /civil|structures|surveying|concrete|soil mechanic/i, dept: 'CIV' },
  { match: /architectural|building design|urban design/i, dept: 'ARC' },
  { match: /urban|regional|town planning|planning/i, dept: 'URP' },
  { match: /agricultural|agric|farm|crop|animal husbandry|soil science|fisheries|animal science/i, dept: 'AGR' },
  { match: /animal science|fisheries|livestock|poultry/i, dept: 'ANS' },
  { match: /statistics|statistic|probability|sampling/i, dept: 'STA' },
  { match: /laboratory technology|science laboratory|chemistry|biochemistry|physics|biology|botany|zoology|microbiology|ecology|organic|inorganic|calculus|algebra|mathematics|maths/i, dept: 'SLT' },
  { match: /accounting|auditing|taxation|bookkeeping|financial accounting/i, dept: 'ACC' },
  { match: /business admin|management|marketing|entrepreneur|business/i, dept: 'BAM' },
  { match: /marketing|consumer behaviour|advertising|sales/i, dept: 'MKT' },
  { match: /public admin|public administration|government|political science/i, dept: 'PAD' },
  { match: /entrepreneurship|startup|small business|innovation/i, dept: 'ENT' },
  { match: /hospitality|tourism|hotel|travel/i, dept: 'HTM' },
  { match: /fine art|painting|sculpture|visual art/i, dept: 'FAD' },
  { match: /fashion|textile|garment/i, dept: 'FAS' },
  { match: /graphics|graphic design|typography|layout/i, dept: 'GRD' },
  { match: /environmental health|public health|sanitation|epidemiology/i, dept: 'EVH' },
  { match: /library|cataloguing|archival|information science/i, dept: 'LIS' },
  { match: /vocational|technical education|workshop practice|trade/i, dept: 'VOC' },
  { match: /general studies|gns|communication in english|use of english|citizenship/i, dept: 'GNS' },
];

router.post('/run-once', async (req, res, next) => {
  try {
    const depts = await db.select().from(departments);
    const byCode = new Map(depts.map((d) => [String(d.code).toUpperCase(), d.id]));
    const allBooks = await db.select().from(books);

    let deptCount = 0, generalCount = 0, hidden = 0;
    const summary = {};

    for (const b of allBooks) {
      let newDeptId = null;
      let newIsGeneral = false;

      if (b.category && GENERAL_PATTERNS.some((re) => re.test(b.category))) newIsGeneral = true;
      else if (GENERAL_PATTERNS.some((re) => re.test(b.title))) newIsGeneral = true;
      else {
        for (const rule of TITLE_RULES) {
          if (rule.match.test(b.title) || rule.match.test(b.category || '')) {
            const id = byCode.get(rule.dept);
            if (id) { newDeptId = id; break; }
          }
        }
      }

      if (!newDeptId && !newIsGeneral) { hidden++; continue; }

      await db.update(books).set({ departmentId: newDeptId, isGeneral: newIsGeneral }).where(eq(books.id, b.id));

      if (newIsGeneral) generalCount++;
      else {
        deptCount++;
        const code = [...byCode.entries()].find(([, id]) => id === newDeptId)?.[0] || '?';
        summary[code] = (summary[code] || 0) + 1;
      }
    }

    res.json({
      success: true,
      total: allBooks.length,
      deptCount, generalCount, hidden,
      byDept: summary,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;