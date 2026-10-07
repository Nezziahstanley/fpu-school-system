// ============================================================
// FPU Admin — Populate <select> from lookup endpoints
// ============================================================

(function () {
  'use strict';

  const A = window.FPU_ADMIN || {};

  const ENDPOINTS = {
    schools:           '/api/admin/lookups/schools',
    departments:       '/api/admin/lookups/departments',
    programmes:        '/api/admin/lookups/programmes',
    courses:           '/api/admin/lookups/courses',
    sessions:          '/api/admin/lookups/sessions',
    students:          '/api/admin/lookups/students',
    lecturers:         '/api/admin/lookups/lecturers',
    'fee-structures':  '/api/admin/lookups/fee-structures',
    books:             '/api/admin/lookups/books',
    users:             '/api/admin/lookups/users',
    countries:         '/api/admin/lookups/countries',
    states:            '/api/admin/lookups/states',
    lgas:              '/api/admin/lookups/lgas',
  };

  const CACHE = new Map();
  const CACHE_MS = 30_000;

  function cacheKey(endpoint, params) {
    return endpoint + '?' + new URLSearchParams(params).toString();
  }

  async function fetchLookup(type, params = {}) {
    const endpoint = ENDPOINTS[type];
    if (!endpoint) throw new Error('Unknown lookup type: ' + type);

    const key = cacheKey(endpoint, params);
    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    const res = await A.adminFetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Lookup failed');

    CACHE.set(key, { at: Date.now(), data: json.data || [] });
    return json.data || [];
  }

  const LABEL = {
    schools:           (r) => `${r.code} — ${r.name}`,
    departments:       (r) => `${r.code} — ${r.name}`,
    programmes:        (r) => `${r.code} — ${r.name} (${r.level})`,
    courses:           (r) => `${r.code} — ${r.title} (${r.unit} units)`,
    sessions:          (r) => `${r.name}${r.isCurrent ? ' (current)' : ''}`,
    students:          (r) => `${r.matricNumber || '—'} — ${r.firstName} ${r.lastName}`,
    lecturers:         (r) => `${r.firstName} ${r.lastName}`,
    'fee-structures':  (r) => `#${r.id} — Programme ${r.programmeId} · ${r.level}`,
    books:             (r) => `${r.title}${r.author ? ' — ' + r.author : ''}`,
    users:             (r) => `${r.firstName} ${r.lastName} (${r.role})`,
    countries:         (r) => r.name,
    states:            (r) => r.name,
    lgas:              (r) => r.name,
  };

  async function populate(select) {
    if (!select || select.__fpuPopulating) return;
    select.__fpuPopulating = true;

    const type = select.dataset.lookup;
    const params = {};
    const dependsOn = select.dataset.dependsOn;
    if (dependsOn) {
      const parentKey = select.dataset.param || dependsOn;
      const parent = document.getElementById(dependsOn);
      if (parent && parent.value) params[parentKey] = parent.value;
    }
    if (select.dataset.extraParams) {
      try {
        Object.assign(params, JSON.parse(select.dataset.extraParams));
      } catch { /* ignore */ }
    }

    const placeholder = select.dataset.placeholder || 'Select…';
    const keepValue = select.dataset.keep === '1';

    select.innerHTML = `<option value="">${placeholder}</option>`;

    try {
      const rows = await fetchLookup(type, params);
      const formatter = LABEL[type] || ((r) => r.name || r.id);
      const options = rows.map((r) => {
        const opt = document.createElement('option');
        // Geo lookups use `code` or `name`; DB lookups use `id`.
        opt.value = r.id != null ? r.id : (r.code != null ? r.code : r.name);
        opt.textContent = formatter(r);
        return opt;
      });
      options.forEach((o) => select.appendChild(o));

      if (keepValue && select.dataset.initialValue) {
        select.value = select.dataset.initialValue;
      }
    } catch (err) {
      select.innerHTML = `<option value="">Could not load: ${A.escapeHtml(err.message)}</option>`;
    } finally {
      select.__fpuPopulating = false;
    }
  }

  function populateAll(root) {
    const scope = root || document;
    scope.querySelectorAll('select[data-lookup]').forEach(populate);
  }

  function bindDependencies(root) {
    const scope = root || document;
    scope.querySelectorAll('select[data-lookup][data-depends-on]').forEach((child) => {
      const parent = document.getElementById(child.dataset.dependsOn);
      if (!parent || parent.__fpuDepBound) return;
      parent.__fpuDepBound = true;
      parent.addEventListener('change', () => {
        scope.querySelectorAll(`select[data-depends-on="${parent.id}"]`).forEach((c) => {
          c.innerHTML = `<option value="">${c.dataset.placeholder || 'Select…'}</option>`;
          populate(c);
        });
      });
    });
  }

  window.FPU_LOOKUPS = {
    fetchLookup,
    populate,
    populateAll,
    bindDependencies,
    invalidateCache() { CACHE.clear(); },
  };

  document.addEventListener('DOMContentLoaded', () => {
    populateAll();
    bindDependencies();
    const view = document.getElementById('page-view');
    if (view) {
      const obs = new MutationObserver(() => {
        populateAll(view);
        bindDependencies(view);
      });
      obs.observe(view, { childList: true, subtree: false });
    }
  });

  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      populateAll();
      bindDependencies();
    }, 60);
  });
})();