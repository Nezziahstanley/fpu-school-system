/* ============================================================
   FPU School Management System — Public site JavaScript
   ------------------------------------------------------------
   This file is intentionally small. Every public page has its
   own inline handlers (apply.html, apply-hnd.html, contact.html,
   apply-status.html, register.html, announcements.html,
   index.html). main.js only provides:
     - scroll-in animations
     - a shared toast + fetch wrapper on window.FPU
   ============================================================ */

(function () {
  'use strict';

  function toast(message, type = 'info') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:4000;display:flex;flex-direction:column;gap:.5rem;';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.style.cssText = 'background:#fff;padding:.75rem .95rem;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.12);border-left:4px solid ' +
      (type === 'success' ? '#059669' : type === 'error' ? '#b91c1c' : type === 'warning' ? '#f59e0b' : '#065f46') +
      ';min-width:220px;font-size:.9rem;';
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  async function api(path, { method = 'GET', body, headers } = {}) {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...(headers || {}) } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text }; }
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `Request failed (${res.status})`);
    }
    return json;
  }

  function initScrollAnimations() {
    const items = Array.from(document.querySelectorAll('[data-animate]'));
    if (!('IntersectionObserver' in window) || items.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.style.transition = 'opacity .5s ease, transform .5s ease';
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.15 });
    items.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      io.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
  });

  window.FPU = { toast, api, initScrollAnimations };
})();

/* ============================================================
   Public header — mobile menu + search toggle
   ============================================================ */
(function () {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('navLinks');
  const searchToggle = document.getElementById('searchToggle');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('siteSearchInput');

  if (toggle && nav) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = nav.classList.toggle('active');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? '\u2715' : '\u2630';
      if (open && searchPanel) {
        searchPanel.classList.remove('open');
        searchToggle && searchToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (searchToggle && searchPanel) {
    searchToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = searchPanel.classList.toggle('open');
      searchToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        if (nav) { nav.classList.remove('active'); toggle && (toggle.textContent = '\u2630'); }
        setTimeout(() => searchInput && searchInput.focus(), 50);
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (nav && nav.classList.contains('active') && !nav.contains(e.target) && !(toggle && toggle.contains(e.target))) {
      nav.classList.remove('active');
      if (toggle) { toggle.textContent = '\u2630'; toggle.setAttribute('aria-expanded', 'false'); }
    }
    if (searchPanel && searchPanel.classList.contains('open') && !searchPanel.contains(e.target) && !(searchToggle && searchToggle.contains(e.target))) {
      searchPanel.classList.remove('open');
      searchToggle && searchToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (nav && nav.classList.contains('active')) {
      nav.classList.remove('active');
      if (toggle) { toggle.textContent = '\u2630'; toggle.setAttribute('aria-expanded', 'false'); }
    }
    if (searchPanel && searchPanel.classList.contains('open')) {
      searchPanel.classList.remove('open');
      searchToggle && searchToggle.setAttribute('aria-expanded', 'false');
    }
  });

  if (nav) {
    nav.querySelectorAll('.has-dropdown > a').forEach((a) => {
      a.addEventListener('click', (ev) => {
        if (window.innerWidth > 980) return;
        const parent = a.parentElement;
        if (parent.querySelector('.dropdown-menu')) {
          ev.preventDefault();
          parent.classList.toggle('open');
        }
      });
    });
  }
})();
