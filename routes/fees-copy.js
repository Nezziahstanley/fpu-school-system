// ============================================================
// FPU — Fee structure "copy from prior session" endpoint
// Mounted at /api/admin/fees  (via routes/index.js)
// Add this line to routes/index.js if not already present:
//   router.post('/admin/fees/copy', require('./fees-copy').copy);
// ============================================================

'use strict';

const paymentQueries = require('../db/queries/payments');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

async function copy(req, res, next) {
  try {
    const { fromSessionId, toSessionId } = req.body || {};
    if (!fromSessionId || !toSessionId) {
      return res.status(400).json({ success: false, error: 'fromSessionId and toSessionId are required.' });
    }
    if (Number(fromSessionId) === Number(toSessionId)) {
      return res.status(400).json({ success: false, error: 'Source and target sessions must differ.' });
    }

    const source = await paymentQueries.listFeeStructures({ sessionId: Number(fromSessionId) });
    const existing = await paymentQueries.listFeeStructures({ sessionId: Number(toSessionId) });
    const existingKeys = new Set(existing.map((f) => f.programmeId + '-' + f.level));

    let copied = 0;
    for (const f of source) {
      const key = f.programmeId + '-' + f.level;
      if (existingKeys.has(key)) continue;
      await paymentQueries.createFeeStructure({
        programmeId: f.programmeId,
        level: f.level,
        sessionId: Number(toSessionId),
        tuition: f.tuition,
        acceptance: f.acceptance,
        medical: f.medical,
        library: f.library,
        ict: f.ict,
        sports: f.sports,
        other: f.other,
      });
      copied++;
    }

    await logAudit({
      req,
      action: 'fee.copy',
      after: { fromSessionId, toSessionId, copied },
    });

    return res.json({ success: true, copied });
  } catch (err) {
    return next(err);
  }
}

module.exports = { copy };
