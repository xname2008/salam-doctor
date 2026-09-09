/**
 * Client-side Persian (Jalali) date rendering for static pages.
 *
 * Reads ISO Gregorian dates from <time datetime="YYYY-MM-DD"> and fills
 * the visible label. JSON-LD datePublished stays ISO — do not change those.
 *
 * Include before other site scripts:
 *   <script src="/assets/js/persian-date.js"></script>
 */
(function (root) {
  'use strict';

  var ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

  function parseIsoDateLocal(iso) {
    var value = String(iso || '').trim();
    var match = ISO_DATE_RE.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatPersianJalaliDate(iso, opts) {
    if (!iso) return '';
    var date = parseIsoDateLocal(iso);
    if (!date) return '';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        calendar: 'persian',
        numberingSystem: 'arabext',
        year: 'numeric',
        month: opts && opts.shortMonth ? 'short' : 'long',
        day: 'numeric',
      }).format(date);
    } catch (e) {
      try {
        return date.toLocaleDateString('fa-IR-u-ca-persian');
      } catch (e2) {
        return '';
      }
    }
  }

  /** Fill all <time datetime="YYYY-MM-DD"> elements with Persian Jalali text. */
  function renderPersianDates(scope) {
    var rootEl = scope || (typeof document !== 'undefined' ? document : null);
    if (!rootEl || !rootEl.querySelectorAll) return;

    rootEl.querySelectorAll('time[datetime]').forEach(function (el) {
      var iso = el.getAttribute('datetime');
      if (!iso || !ISO_DATE_RE.test(iso)) return;
      var override = el.getAttribute('data-jalali-label');
      var label = override || formatPersianJalaliDate(iso);
      if (label) el.textContent = label;
    });
  }

  root.formatPersianJalaliDate = formatPersianJalaliDate;
  root.renderPersianDates = renderPersianDates;

  if (typeof document !== 'undefined') {
    function boot() {
      renderPersianDates(document);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : this);
