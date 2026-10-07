// ============================================================
// FPU — Client-side pagination helper
// ------------------------------------------------------------
// Usage:
//   const pg = FPU_PAGINATE.mount(tbody, rows, { pageSize: 25, renderRow });
//   pg.setRows(newRows);
//   pg.destroy();
// ============================================================

(function () {
  'use strict';

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function mount(tbody, rows, opts = {}) {
    if (!tbody) return { setRows() {}, destroy() {}, goTo() {} };

    const pageSize = opts.pageSize || 25;
    const renderRow = opts.renderRow || ((r) => `<tr><td>${escapeHtml(JSON.stringify(r))}</td></tr>`);
    const emptyMarkup = opts.emptyMarkup || '<tr><td colspan="99" class="empty">No data.</td></tr>';
    const onRowClick = opts.onRowClick || null;

    let current = 1;
    let data = rows || [];
    const panel = tbody.closest('.panel') || tbody.parentElement;

    let bar = panel.querySelector('.pagination-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pagination-bar';
      bar.innerHTML = '<div class="pg-info"></div><div class="pg-controls"></div>';
      panel.appendChild(bar);
    }

    const infoEl = bar.querySelector('.pg-info');
    const ctrlEl = bar.querySelector('.pg-controls');

    function totalPages() {
      return Math.max(1, Math.ceil(data.length / pageSize));
    }

    function render() {
      const start = (current - 1) * pageSize;
      const slice = data.slice(start, start + pageSize);

      tbody.innerHTML = slice.length ? slice.map(renderRow).join('') : emptyMarkup;

      if (onRowClick) {
        tbody.querySelectorAll('tr[data-row-index]').forEach((tr) => {
          tr.addEventListener('click', () => {
            const idx = Number(tr.dataset.rowIndex);
            onRowClick(data[idx], idx);
          });
        });
      }

      if (data.length === 0) {
        infoEl.textContent = 'No records';
      } else {
        const end = Math.min(start + pageSize, data.length);
        infoEl.textContent = `Showing ${start + 1}–${end} of ${data.length}`;
      }

      const pages = totalPages();
      const btns = [];
      btns.push(`<button data-pg="prev" ${current === 1 ? 'disabled' : ''}>‹</button>`);

      const windowSize = 5;
      let from = Math.max(1, current - Math.floor(windowSize / 2));
      let to = Math.min(pages, from + windowSize - 1);
      from = Math.max(1, to - windowSize + 1);

      if (from > 1) {
        btns.push(`<button data-pg="1">1</button>`);
        if (from > 2) btns.push(`<span style="padding:0 6px;color:#94a3b8;">…</span>`);
      }

      for (let i = from; i <= to; i++) {
        btns.push(`<button data-pg="${i}" class="${i === current ? 'active' : ''}">${i}</button>`);
      }

      if (to < pages) {
        if (to < pages - 1) btns.push(`<span style="padding:0 6px;color:#94a3b8;">…</span>`);
        btns.push(`<button data-pg="${pages}">${pages}</button>`);
      }

      btns.push(`<button data-pg="next" ${current === pages ? 'disabled' : ''}>›</button>`);

      ctrlEl.innerHTML = btns.join('');
      ctrlEl.querySelectorAll('button[data-pg]').forEach((b) => {
        b.addEventListener('click', () => {
          const v = b.dataset.pg;
          if (v === 'prev') goTo(current - 1);
          else if (v === 'next') goTo(current + 1);
          else goTo(Number(v));
        });
      });
    }

    function goTo(n) {
      const pages = totalPages();
      current = Math.max(1, Math.min(pages, n));
      render();
      if (opts.scrollOnPageChange !== false) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function setRows(newRows) {
      data = newRows || [];
      current = 1;
      render();
    }

    function destroy() {
      bar.remove();
    }

    render();

    return { setRows, destroy, goTo, get rows() { return data; } };
  }

  window.FPU_PAGINATE = { mount };
})();