// ============================================================
// FPU — Partial inline-script executor (idempotent)
// ------------------------------------------------------------
// Load BEFORE admin-spa.js / portal-spa.js.
// Tracks executed <script> nodes via WeakSet so cached
// partials don't re-run their scripts on every navigation.
// Wraps inline scripts in try/catch so a partial error can't
// kill the SPA shell.
// ============================================================

(function () {
  'use strict';

  const EXECUTED = new WeakSet();

  window.FPU_EXECUTE_PARTIAL_SCRIPTS = function (view) {
    if (!view) return;
    view.querySelectorAll('script').forEach((old) => {
      if (EXECUTED.has(old)) return;
      EXECUTED.add(old);

      const s = document.createElement('script');
      if (old.src) {
        s.src = old.src;
        s.async = false;
      } else {
        s.textContent = `
          try {
            (function () {
              ${old.textContent}
            })();
          } catch (err) {
            console.error('[partial-script]', err);
            const view = document.getElementById('page-view');
            if (view) {
              const b = document.createElement('div');
              b.className = 'alert alert-warning';
              b.style.marginTop = '12px';
              b.innerHTML = '<strong>⚠️ Script error in this page.</strong><br/><span class="small">' +
                (err && err.message ? err.message : 'Unknown error') + '</span>';
              view.appendChild(b);
            }
          }
        `;
      }
      old.replaceWith(s);
    });
  };
})();