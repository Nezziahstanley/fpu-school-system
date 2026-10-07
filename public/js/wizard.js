/* ============================================================
   FPU — Multi-Step Wizard Engine
   ------------------------------------------------------------
   Standalone, dependency-free. Turns a single <form> with
   [data-step] sections into a wizard with:
     - Next / Back / Submit navigation
     - Per-step validation
     - Progress indicator sync (active / done classes)
     - Optional "review" step that mirrors entered values
     - Public API: next(), prev(), goto(), validate(), reset()
   ------------------------------------------------------------
   Markup contract:
     <form id="myForm" data-wizard>
       <div class="wizard-progress">
         <div class="wizard-step-indicator" data-step-indicator="0">1</div>
         ...
       </div>
       <div class="wizard-step" data-step="0"> ... </div>
       <div class="wizard-step" data-step="1"> ... </div>
       ...
       <div class="wizard-nav">
         <button type="button" data-wizard-prev>Back</button>
         <button type="button" data-wizard-next>Next</button>
         <button type="submit" data-wizard-submit hidden>Submit</button>
       </div>
     </form>
   ------------------------------------------------------------
   Any input with [required] is validated when trying to advance.
   Any input with [data-review="Label"] gets mirrored into the
   review step (if one exists with [data-review-container]).
   ============================================================ */

(function () {
  'use strict';

  class Wizard {
    constructor(formEl, options = {}) {
      this.form = typeof formEl === 'string' ? document.querySelector(formEl) : formEl;
      if (!this.form) {
        console.error('[wizard] form not found:', formEl);
        return;
      }

      this.options = Object.assign(
        {
          stepAttr: 'data-step',
          stepSelector: '.wizard-step',
          indicatorSelector: '[data-step-indicator]',
          navPrevSelector: '[data-wizard-prev]',
          navNextSelector: '[data-wizard-next]',
          navSubmitSelector: '[data-wizard-submit]',
          reviewContainerSelector: '[data-review-container]',
          scrollToTop: true,
          validateOnNext: true,
          onStepChange: null, // (index, total, wizard) => void
          onBeforeSubmit: null, // (wizard) => boolean | Promise<boolean>
        },
        options
      );

      this.steps = Array.from(this.form.querySelectorAll(this.options.stepSelector));
      this.indicators = Array.from(this.form.querySelectorAll(this.options.indicatorSelector));
      this.currentIndex = 0;
      this.total = this.steps.length;

      if (!this.total) {
        console.warn('[wizard] no steps found in', this.form);
        return;
      }

      // Auto-wire nav buttons if they live inside the form
      this.prevBtn = this.form.querySelector(this.options.navPrevSelector);
      this.nextBtn = this.form.querySelector(this.options.navNextSelector);
      this.submitBtn = this.form.querySelector(this.options.navSubmitSelector);

      this._wireEvents();
      this._render();
    }

    /* ---------------- events ---------------- */
    _wireEvents() {
      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.prev();
        });
      }
      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.next();
        });
      }

      // Prevent Enter key from advancing the wizard accidentally
      // (except on textarea, where Enter should make a newline)
      this.form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          const isSubmitStep = this.currentIndex === this.total - 1;
          const isButton = e.target.tagName === 'BUTTON';
          if (!isSubmitStep && !isButton) {
            e.preventDefault();
            this.next();
          }
        }
      });

      // Live validation: clear error on input
      this.form.addEventListener('input', (e) => {
        const field = e.target;
        if (field.matches('[required], [data-required]')) {
          if (this._isFieldValid(field)) {
            this._clearFieldError(field);
          }
        }
        this._refreshReviewStep();
      });
      this.form.addEventListener('change', (e) => {
        if (e.target.matches('[required], [data-required], select, input[type="radio"], input[type="checkbox"]')) {
          if (this._isFieldValid(e.target)) this._clearFieldError(e.target);
        }
        this._refreshReviewStep();
      });
    }

    /* ---------------- public API ---------------- */
    next() {
      if (this.currentIndex >= this.total - 1) return;
      if (this.options.validateOnNext && !this.validate()) return;
      this.goto(this.currentIndex + 1);
    }

    prev() {
      if (this.currentIndex <= 0) return;
      this.goto(this.currentIndex - 1);
    }

    goto(index) {
      if (index < 0 || index >= this.total) return;
      this.currentIndex = index;
      this._render();

      if (this.options.scrollToTop) {
        const top = this.form.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }

      if (typeof this.options.onStepChange === 'function') {
        try {
          this.options.onStepChange(index, this.total, this);
        } catch (err) {
          console.error('[wizard] onStepChange error:', err);
        }
      }

      // Fire a DOM event too, so page scripts can listen
      this.form.dispatchEvent(
        new CustomEvent('wizard:step-change', {
          detail: { index, total: this.total },
          bubbles: true,
        })
      );
    }

    validate() {
      const step = this.steps[this.currentIndex];
      if (!step) return true;

      const fields = Array.from(step.querySelectorAll('[required], [data-required]'));
      let firstInvalid = null;
      let ok = true;

      for (const field of fields) {
        // Skip fields in hidden containers (e.g. conditional sections)
        if (field.offsetParent === null) continue;

        if (!this._isFieldValid(field)) {
          ok = false;
          this._showFieldError(field);
          if (!firstInvalid) firstInvalid = field;
        } else {
          this._clearFieldError(field);
        }
      }

      if (!ok && firstInvalid) {
        firstInvalid.focus({ preventScroll: false });
        // Gently scroll into view
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return ok;
    }

    reset() {
      this.currentIndex = 0;
      this._render();
    }

    /* ---------------- internals ---------------- */
    _render() {
      // Panels
      this.steps.forEach((stepEl, i) => {
        stepEl.classList.toggle('active', i === this.currentIndex);
      });

      // Indicators
      this.indicators.forEach((indEl, i) => {
        indEl.classList.remove('active', 'done');
        if (i < this.currentIndex) indEl.classList.add('done');
        if (i === this.currentIndex) indEl.classList.add('active');
      });

      // Nav buttons
      const isFirst = this.currentIndex === 0;
      const isLast = this.currentIndex === this.total - 1;

      if (this.prevBtn) this.prevBtn.disabled = isFirst;
      if (this.nextBtn) this.nextBtn.hidden = isLast;
      if (this.submitBtn) this.submitBtn.hidden = !isLast;

      // Refresh review step when entering last step
      if (isLast) this._refreshReviewStep();

      // Ensure the form is always "clean" for native validation
      // (we handle validation ourselves)
      this.form.setAttribute('novalidate', 'novalidate');
    }

    _isFieldValid(field) {
      if (!field) return true;

      // Hidden / disabled → skip
      if (field.disabled) return true;
      if (field.offsetParent === null && field.type !== 'hidden') return true;

      // Checkbox / radio
      if (field.type === 'checkbox') {
        if (field.hasAttribute('required') || field.hasAttribute('data-required')) {
          return field.checked;
        }
        return true;
      }
      if (field.type === 'radio') {
        const group = this.form.querySelectorAll(`[name="${field.name}"]`);
        if (field.hasAttribute('required') || field.hasAttribute('data-required')) {
          return Array.from(group).some((r) => r.checked);
        }
        return true;
      }

      // Value presence
      const value = (field.value || '').trim();
      if (!value) return false;

      // Email
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return false;
      }

      // Number ranges
      if (field.type === 'number') {
        const n = parseFloat(value);
        if (Number.isNaN(n)) return false;
        if (field.min !== '' && n < parseFloat(field.min)) return false;
        if (field.max !== '' && n > parseFloat(field.max)) return false;
      }

      // Custom pattern
      if (field.pattern) {
        try {
          if (!new RegExp(`^(?:${field.pattern})$`).test(value)) return false;
        } catch (e) {
          // ignore malformed pattern
        }
      }

      return true;
    }

    _showFieldError(field) {
      field.classList.add('is-invalid');
      let err = field.parentElement.querySelector('.wizard-field-error');
      if (!err) {
        err = document.createElement('div');
        err.className = 'wizard-field-error';
        field.parentElement.appendChild(err);
      }
      err.textContent =
        field.dataset.errorMessage ||
        field.getAttribute('data-error-message') ||
        field.validationMessage ||
        'This field is required.';
      err.style.display = 'block';
    }

    _clearFieldError(field) {
      field.classList.remove('is-invalid');
      const err = field.parentElement.querySelector('.wizard-field-error');
      if (err) err.style.display = 'none';
    }

    _refreshReviewStep() {
      const container = this.form.querySelector(this.options.reviewContainerSelector);
      if (!container) return;

      const reviewed = Array.from(this.form.querySelectorAll('[data-review]'));
      if (!reviewed.length) return;

      container.innerHTML = reviewed
        .map((field) => {
          const label = field.getAttribute('data-review') || field.name || 'Field';
          let value = '';

          if (field.type === 'checkbox') {
            value = field.checked ? 'Yes' : 'No';
          } else if (field.type === 'radio') {
            const checked = this.form.querySelector(`[name="${field.name}"]:checked`);
            value = checked ? (checked.getAttribute('data-label') || checked.value) : '—';
          } else if (field.tagName === 'SELECT') {
            const opt = field.options[field.selectedIndex];
            value = opt ? (opt.textContent || opt.value).trim() : '—';
          } else {
            value = (field.value || '').trim();
          }

          if (!value) value = '—';

          return `
            <div class="wizard-review-row">
              <span class="wizard-review-label">${this._escape(label)}</span>
              <span class="wizard-review-value">${this._escape(value)}</span>
            </div>`;
        })
        .join('');
    }

    _escape(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  /* ---------- auto-init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-wizard]').forEach((form) => {
      if (form.__wizard) return; // already initialised
      form.__wizard = new Wizard(form);
    });
  });

  /* ---------- exports ---------- */
  window.Wizard = Wizard;
})();