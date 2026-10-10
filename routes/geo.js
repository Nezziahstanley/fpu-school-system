// ============================================================
// FPU — Public geo API (countries, states, LGAs)
// Mounted at /api/geo  (no auth — used by apply.html)
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const GEO = require('../config/geo');

// ------------------------------------------------------------
// GET /api/geo/countries
// ------------------------------------------------------------
router.get('/countries', (_req, res) => {
  return res.json({ success: true, data: GEO.COUNTRIES });
});

// ------------------------------------------------------------
// GET /api/geo/states?country=Nigeria
//   Accepts country NAME ("Nigeria") or CODE ("NG")
// ------------------------------------------------------------
router.get('/states', (req, res) => {
  const q = String(req.query.country || 'Nigeria').trim();

  // Resolve to a country code
  let code = null;
  if (q.length === 2) code = q.toUpperCase();
  else {
    const found = (GEO.COUNTRIES || []).find(
      (c) => c.name.toLowerCase() === q.toLowerCase()
    );
    if (found) code = found.code;
  }

  const states = (code && GEO.STATES[code]) || [];
  return res.json({
    success: true,
    country: code,
    data: states.map((name) => ({ name })),
  });
});

// ------------------------------------------------------------
// GET /api/geo/lgas?country=Nigeria&state=Abia
// ------------------------------------------------------------
router.get('/lgas', (req, res) => {
  const q = String(req.query.country || 'Nigeria').trim();
  const stateName = String(req.query.state || '').trim();

  let code = null;
  if (q.length === 2) code = q.toUpperCase();
  else {
    const found = (GEO.COUNTRIES || []).find(
      (c) => c.name.toLowerCase() === q.toLowerCase()
    );
    if (found) code = found.code;
  }

  if (!code || !stateName) {
    return res.json({ success: true, data: [] });
  }

  // LGAS might be keyed by country → state, or flat; handle both
  let lgAs = [];
  const byCountry = GEO.LGAS[code];
  if (byCountry) {
    if (Array.isArray(byCountry)) lgAs = byCountry;
    else if (byCountry[stateName]) lgAs = byCountry[stateName];
  }
  // Fallback: if LGAS is a flat map keyed by state name
  if (!lgAs.length && GEO.LGAS[stateName]) {
    lgAs = GEO.LGAS[stateName];
  }

  return res.json({
    success: true,
    country: code,
    state: stateName,
    data: lgAs.map((name) => ({ name })),
  });
});

module.exports = router;
