/**
 * Commercial landing page — SKAG client fallback + lead form POST.
 */
(function () {
  'use strict';

  var cfg = window.__LANDING_SKAG__ || {};

  function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function applySkagFromUrl() {
    var keyword =
      qp('skag') ||
      qp('utm_term') ||
      qp('keyword') ||
      qp('device') ||
      qp('service') ||
      qp('utm_content');
    if (!keyword || !cfg.clinicId) return;

    fetch(
      '/api/landing/skag?' +
        new URLSearchParams({
          package: cfg.packageSlug || '',
          clinicId: String(cfg.clinicId),
          utm_term: keyword,
          utm_source: qp('utm_source') || '',
          utm_medium: qp('utm_medium') || '',
          utm_campaign: qp('utm_campaign') || '',
          utm_content: qp('utm_content') || '',
        }).toString(),
      { credentials: 'same-origin' }
    )
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data) return;
        var h1 = document.getElementById('skag-h1');
        if (h1 && data.h1) h1.textContent = data.h1;
        document.querySelectorAll('[data-skag="cta-primary"]').forEach(function (el) {
          if (data.ctaPrimary) el.textContent = data.ctaPrimary;
        });
        document.querySelectorAll('[data-skag="cta-secondary"]').forEach(function (el) {
          if (data.ctaSecondary) el.textContent = data.ctaSecondary;
        });
      })
      .catch(function () {
        /* server-rendered copy is enough */
      });
  }

  function collectUtm() {
    var utm = cfg.utm || {};
    return {
      utm_source: qp('utm_source') || utm.utm_source || null,
      utm_medium: qp('utm_medium') || utm.utm_medium || null,
      utm_campaign: qp('utm_campaign') || utm.utm_campaign || null,
      utm_term: qp('utm_term') || utm.utm_term || null,
      utm_content: qp('utm_content') || utm.utm_content || null,
    };
  }

  function openModal() {
    var modal = document.getElementById('lead-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    var modal = document.getElementById('lead-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
  }

  function bindLeadForm() {
    var form = document.getElementById('lead-form');
    if (!form) return;

    document.querySelectorAll('[data-open-lead-form]').forEach(function (btn) {
      btn.addEventListener('click', openModal);
    });
    var closeBtn = document.getElementById('lead-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var errEl = document.getElementById('lead-form-error');
      var okEl = document.getElementById('lead-form-success');
      if (errEl) {
        errEl.classList.add('hidden');
        errEl.textContent = '';
      }
      if (okEl) {
        okEl.classList.add('hidden');
        okEl.textContent = '';
      }

      var payload = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        service: (cfg.service || cfg.packageSlug || 'مشاوره').trim(),
        desc: form.desc.value.trim(),
        clinicId: cfg.clinicId,
        packageSlug: cfg.packageSlug,
        landingPath: window.location.pathname,
        utm: collectUtm(),
      };

      fetch('/api/landing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { status: res.status, body: body };
          });
        })
        .then(function (result) {
          if (result.status === 201 && result.body.success) {
            if (okEl) {
              okEl.textContent = result.body.message || 'ثبت شد.';
              okEl.classList.remove('hidden');
            }
            form.reset();
            if (window.dataLayer) {
              window.dataLayer.push({
                event: 'landing_lead_submit',
                clinic_id: cfg.clinicId,
                package_slug: cfg.packageSlug,
              });
            }
            return;
          }
          var msg =
            (result.body && result.body.error) ||
            'خطا در ثبت درخواست. لطفاً دوباره تلاش کنید.';
          if (result.body && result.body.fields) {
            msg += ' (' + Object.keys(result.body.fields).join(', ') + ')';
          }
          if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
          }
        })
        .catch(function () {
          if (errEl) {
            errEl.textContent = 'خطای شبکه. اتصال اینترنت را بررسی کنید.';
            errEl.classList.remove('hidden');
          }
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applySkagFromUrl();
      bindLeadForm();
    });
  } else {
    applySkagFromUrl();
    bindLeadForm();
  }

  if (cfg.keyword && window.dataLayer) {
    window.dataLayer.push({
      event: 'skag_landing_view',
      skag_keyword: cfg.keyword,
      clinic_id: cfg.clinicId,
      package_slug: cfg.packageSlug,
    });
  }
})();
