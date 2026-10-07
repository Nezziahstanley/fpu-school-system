// ============================================================
// FPU — IP guard middleware
// Enforces security_ip_rules from settings.
// ============================================================

'use strict';

const settingsQueries = require('../db/queries/settings');

const CACHE_MS = 30_000;
let _cache = null;
let _cacheAt = 0;

async function loadRules() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_MS) return _cache;
  try {
    const raw = await settingsQueries.get('security_ip_rules', '{"rules":[]}');
    const parsed = JSON.parse(raw);
    _cache = parsed.rules || [];
    _cacheAt = now;
    return _cache;
  } catch {
    _cache = [];
    _cacheAt = now;
    return _cache;
  }
}

function normalize(ip) {
  return String(ip || '').replace(/^::ffff:/, '');
}

function cidrMatch(ip, cidr) {
  // Very light IPv4 CIDR check. Only used when a "/" is present.
  const [range, bitsRaw] = String(cidr).split('/');
  const bits = Number(bitsRaw);
  if (!bits || bits < 0 || bits > 32) return false;

  const ipToInt = (s) => {
    const parts = String(s).split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
    return (parts[0] * 2 ** 24) + (parts[1] * 2 ** 16) + (parts[2] * 2 ** 8) + parts[3];
  };

  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  if (ipInt === null || rangeInt === null) return false;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

async function ipGuard(req, res, next) {
  try {
    const rules = await loadRules();
    if (!rules.length) return next();

    const ip = normalize(
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      ''
    );
    if (!ip) return next();

    const now = Date.now();

    for (const rule of rules) {
      if (rule.expiresAt && new Date(rule.expiresAt).getTime() < now) continue;

      const target = String(rule.ipAddress || '');
      const hit = target.includes('/') ? cidrMatch(ip, target) : target === ip;

      if (!hit) continue;

      if (rule.rule === 'block') {
        return res.status(403).json({
          success: false,
          error: 'Access from your IP has been blocked.',
        });
      }
      // 'allow' rule — short-circuit: treat as trusted
      return next();
    }

    return next();
  } catch {
    return next();
  }
}

module.exports = ipGuard;
module.exports.invalidateCache = () => { _cache = null; _cacheAt = 0; };