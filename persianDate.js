'use strict';

function parseIsoDateLocal(iso) {
  const value = String(iso || '').trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format an ISO date string as Persian Jalali for display (e.g. ۱۰ شهریور ۱۴۰۵).
 * JSON-LD / datetime attributes should keep the original ISO value.
 */
function formatPersianJalaliDate(iso, opts = {}) {
  if (!iso) return '—';
  const date = parseIsoDateLocal(iso);
  if (!date) return '—';

  const options = {
    calendar: 'persian',
    numberingSystem: 'arabext',
    year: 'numeric',
    month: opts.shortMonth ? 'short' : 'long',
    day: 'numeric',
  };

  if (opts.time) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  try {
    return new Intl.DateTimeFormat('fa-IR', options).format(date);
  } catch {
    try {
      return date.toLocaleDateString('fa-IR-u-ca-persian');
    } catch {
      return '—';
    }
  }
}

module.exports = {
  formatPersianJalaliDate,
  parseIsoDateLocal,
};
