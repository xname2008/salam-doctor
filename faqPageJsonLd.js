'use strict';

/**
 * Build schema.org FAQPage JSON-LD from a list of Q&A dictionaries.
 *
 * Accepts { question, answer }, { q, a }, or { name, text }.
 * Empty or incomplete items are skipped.
 *
 * @example
 * const schema = buildFaqPageJsonLd([
 *   { question: 'آیا بیمه پوشش می‌دهد؟', answer: 'بسته به نوع خدمت و شرکت بیمه متفاوت است.' },
 *   { q: 'مدت انتظار نوبت چقدر است؟', a: 'معمولاً از همان روز تا چند روز کاری.' },
 * ]);
 */

function trimText(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeFaqItem(item) {
  if (!item || typeof item !== 'object') return null;
  const question = trimText(item.question || item.q || item.name);
  const answer = trimText(item.answer || item.a || item.text);
  if (!question || !answer) return null;
  return { question, answer };
}

function normalizeFaqList(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const qa = normalizeFaqItem(raw);
    if (!qa) continue;
    const key = qa.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(qa);
  }
  return out;
}

/**
 * @param {Array<object>} items
 * @returns {object|null} JSON-serializable FAQPage node, or null if none valid
 */
function buildFaqPageJsonLd(items) {
  const faqs = normalizeFaqList(items);
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer,
      },
    })),
  };
}

function defaultClinicProfileFaqs(ctx) {
  const name = trimText(ctx && ctx.name) || 'این مرکز';
  const city = trimText(ctx && ctx.city);
  const specialty = trimText(ctx && ctx.specialty);
  const loc = city ? ` در ${city}` : '';
  const service = specialty || 'خدمات این مرکز';
  return [
    {
      question: `آیا ${name} طرف قرارداد بیمه است؟`,
      answer: `پوشش بیمه در ${name} بسته به نوع خدمت و شرکت بیمه (پایه یا تکمیلی) متفاوت است. هنگام رزرو نوبت از کارشناسان سلام دکتر بپرسید کدام بیمه‌ها در این مرکز پذیرفته می‌شود و آیا نیاز به معرفی‌نامه دارید.`,
    },
    {
      question: `مدت انتظار برای نوبت ${service}${loc} چقدر است؟`,
      answer: `زمان انتظار در ${name} معمولاً از نوبت همان روز تا چند روز کاری متغیر است و به نوع خدمت و شلوغی مرکز بستگی دارد. برای نزدیک‌ترین نوبت خالی از دکمه «درخواست نوبت فوری» استفاده کنید.`,
    },
    {
      question: `چطور برای ${service} در ${name} نوبت بگیرم؟`,
      answer: `از دکمه درخواست نوبت در همین صفحه استفاده کنید یا با شماره تماس مرکز ارتباط بگیرید. کارشناسان سلام دکتر هم می‌توانند نزدیک‌ترین زمان خالی را هماهنگ کنند.`,
    },
    {
      question: `هزینه ویزیت و درمان در ${name} چقدر است؟`,
      answer: `تعرفه بسته به نوع خدمت، تجهیزات و طرح درمان پس از معاینه اعلام می‌شود. قبل از شروع درمان می‌توانید برآورد هزینه را از مرکز یا از مشاوره رایگان سلام دکتر بگیرید.`,
    },
  ];
}

function clinicProfileFaqs(clinic, ctx) {
  const custom = clinic && Array.isArray(clinic.faqs) ? clinic.faqs : [];
  const normalized = normalizeFaqList(custom);
  if (normalized.length) return normalized;
  return defaultClinicProfileFaqs(ctx);
}

/**
 * Accessible accordion markup (native details/summary).
 * Visible copy must match FAQPage JSON-LD.
 */
function faqAccordionHtml(items, opts) {
  const faqs = normalizeFaqList(items);
  const prefix = (opts && opts.idPrefix) || 'faq';
  if (!faqs.length) return '';
  return faqs
    .map((qa, i) => {
      const id = `${prefix}-${i + 1}`;
      return [
        `<details class="faq-accordion__item">`,
        `  <summary class="faq-accordion__summary" id="${id}-q">`,
        `    <span class="faq-accordion__question">${escapeHtml(qa.question)}</span>`,
        `    <span class="faq-accordion__icon" aria-hidden="true"></span>`,
        `  </summary>`,
        `  <div class="faq-accordion__panel" id="${id}-a" role="region" aria-labelledby="${id}-q">`,
        `    <p>${escapeHtml(qa.answer)}</p>`,
        `  </div>`,
        `</details>`,
      ].join('\n');
    })
    .join('\n');
}

module.exports = {
  buildFaqPageJsonLd,
  normalizeFaqList,
  normalizeFaqItem,
  defaultClinicProfileFaqs,
  clinicProfileFaqs,
  faqAccordionHtml,
};
