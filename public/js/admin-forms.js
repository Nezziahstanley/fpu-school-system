// ============================================================
// FPU Admin — Generic form handler
// ------------------------------------------------------------
// Binds every admin form partial by convention:
//   <form id="X-form"> → POST /api/admin/X
//
// Opt-out of the generic handler on a per-form basis by adding
//   data-skip-generic="1"
// to the <form> tag. Useful when a partial ships its own submit
// handler (e.g. session-form with edit/create branching).
//
// Override via data attributes:
//   data-endpoint="/api/admin/custom"
//   data-method="PUT"
//   data-redirect="students"   (SPA page key)
//   data-reset="1"
// ============================================================

(function () {
  'use strict';

  const A = window.FPU_ADMIN || {};

  const FORMS = {
    'student-form':       { endpoint: '/api/admin/students',       redirect: 'students' },
    'staff-form':         { endpoint: '/api/admin/staff',          redirect: 'staff' },
    'user-form':          { endpoint: '/api/admin/users',          redirect: 'users' },
    'course-form':        { endpoint: '/api/admin/courses',        redirect: 'courses' },
    'school-form':        { endpoint: '/api/admin/schools',        redirect: 'schools' },
    'department-form':    { endpoint: '/api/admin/departments',    redirect: 'departments' },
    'programme-form':     { endpoint: '/api/admin/programmes',     redirect: 'programmes' },
    'fee-form':           { endpoint: '/api/admin/fees',           redirect: 'fees' },
    'payment-form':       { endpoint: '/api/admin/payments',       redirect: 'payments' },
    'exam-form':          { endpoint: '/api/admin/exams',          redirect: 'exams' },
    'result-form':        { endpoint: '/api/admin/results',        redirect: 'results' },
    'book-form':          { endpoint: '/api/admin/library/books',  redirect: 'library' },
    'announcement-form':  { endpoint: '/api/admin/announcements',  redirect: 'announcements' },
    'graduation-form':    { endpoint: '/api/admin/graduation/queue', redirect: 'graduation' },
    'allocation-form':    { endpoint: '/api/admin/allocations',    redirect: 'allocations' },
    'application-form':   { endpoint: '/api/admin/applications',   redirect: 'applications' },
    'timetable-form':     { endpoint: '/api/admin/timetable',      redirect: 'timetable' },
    'bulk-allocation-form': {
      endpoint: '/api/admin/allocations/bulk',
      method: 'POST',
      transform: (fd) => {
        const raw = fd.get('rows');
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
          return { rows: parsed };
        } catch (e) {
          throw new Error('Invalid JSON: ' + e.message);
        }
      },
      redirect: 'allocations',
    },
    // NOTE: 'session-form' is intentionally omitted — it has its own
    // inline handler in public/admin/partials/sessions/session-form.html
    // because it branches between create and edit based on ?id=.
  };

  function navigate(key) {
    if (window.FPU_ADMIN_SPA && typeof window.FPU_ADMIN_SPA.navigateTo === 'function') {
      window.FPU_ADMIN_SPA.navigateTo(key);
      return true;
    }
    return false;
  }

  function bindForm(formId) {
    const form = document.getElementById(formId);
    if (!form || form.__fpuBound) return;

    // Opt-out: partials with custom submit handlers can set
    //   data-skip-generic="1"
    if (form.dataset.skipGeneric === '1') return;

    form.__fpuBound = true;

    const config = FORMS[formId] || {};
    const endpoint = form.dataset.endpoint || config.endpoint;
    const method = (form.dataset.method || config.method || 'POST').toUpperCase();
    const redirect = form.dataset.redirect || config.redirect;

    if (!endpoint) {
      console.warn('[forms] no endpoint for', formId);
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      let payload;
      try {
        payload = config.transform
          ? config.transform(fd)
          : Object.fromEntries(fd.entries());
      } catch (err) {
        if (A.showToast) A.showToast('❌ ' + err.message, 'error');
        return;
      }

      // Coerce checkboxes ("on" → boolean)
      form.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        if (cb.name) payload[cb.name] = cb.checked;
      });

      // Coerce numeric fields
      form.querySelectorAll('input[type="number"]').forEach((inp) => {
        if (inp.name && payload[inp.name] !== '' && payload[inp.name] != null) {
          const n = Number(payload[inp.name]);
          if (Number.isFinite(n)) payload[inp.name] = n;
        }
      });

      const submitBtn = form.querySelector('button[type="submit"]');
      const original = submitBtn ? submitBtn.textContent : null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
      }

      try {
        const res = await A.adminFetch(endpoint, {
          method,
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Request failed');

        if (A.showToast) A.showToast('✅ Saved successfully.');

        if (form.dataset.reset === '1' || !redirect) form.reset();

        if (redirect && navigate(redirect)) return;

        // Fallback: soft reload
        const listLoader = window.FPU_ADMIN_SPA && window.FPU_ADMIN_SPA.reload;
        if (typeof listLoader === 'function') listLoader();
      } catch (err) {
        if (A.showToast) A.showToast('❌ ' + (err.message || 'Save failed.'), 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = original;
        }
      }
    });
  }

  function bindAll(root) {
    const scope = root || document;
    scope.querySelectorAll('form[id$="-form"]').forEach((f) => bindForm(f.id));
  }

  window.FPU_ADMIN_FORMS = { bindAll, bindForm, FORMS };

  document.addEventListener('DOMContentLoaded', () => {
    bindAll();
    const view = document.getElementById('page-view');
    if (view) {
      const obs = new MutationObserver(() => bindAll(view));
      obs.observe(view, { childList: true });
    }
  });

  window.addEventListener('hashchange', () => {
    setTimeout(() => bindAll(), 50);
  });
})();