/**
 * Latest / static articles — listing, homepage cards, and sidebars.
 *
 * Catalog is AUTO-GENERATED: run `npm run articles:sync` after adding articles/*.html
 * Source of truth: articles/*.html + assets/js/articles-catalog.generated.js
 *
 * Dates: ISO in datetime/JSON-LD; Persian Jalali computed at render time.
 */
(function (root) {
  'use strict';

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseIsoDateLocal(iso) {
    var value = String(iso || '').trim();
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  var formatPersianJalaliDate =
    typeof root.formatPersianJalaliDate === 'function'
      ? root.formatPersianJalaliDate
      : function (iso) {
          if (!iso) return '';
          var date = parseIsoDateLocal(iso);
          if (!date) return '';
          try {
            return new Intl.DateTimeFormat('fa-IR', {
              calendar: 'persian',
              numberingSystem: 'arabext',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(date);
          } catch (e) {
            return '';
          }
        };

  /** Normalize catalog entry: ISO date + computed Persian label. */
  function enrichArticle(a) {
    if (!a) return a;
    var iso = String(a.datePublished || a.published_at || '').slice(0, 10);
    var jalali = a.jalaliLabel || '';
    return {
      slug: a.slug || '',
      title: a.title || '',
      summary: a.summary || '',
      category: a.category || '',
      cover_image: a.cover_image || '',
      url: a.url || (a.slug ? 'articles/' + a.slug + '.html' : ''),
      datePublished: iso,
      jalaliLabel: jalali,
      dateLabel: jalali || formatPersianJalaliDate(iso),
    };
  }

  function withAssetVersion(src, article) {
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    var token = encodeURIComponent(article.datePublished || article.slug || '1');
    return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + token;
  }

  function loadCatalog() {
    var raw = root.ARTICLES_CATALOG;
    if (!Array.isArray(raw)) return [];
    return sortByDate(
      raw
        .map(enrichArticle)
        .filter(function (a) {
          return a.slug && a.title;
        }),
    );
  }

  var LATEST_ARTICLES = loadCatalog();

  function resolveUrl(article, base) {
    var href = article.url || ('articles/' + article.slug + '.html');
    if (!base) return href;
    if (base === 'articles/') return href.replace(/^articles\//, '');
    if (base === '../') return '../' + href.replace(/^\//, '');
    return base.replace(/\/?$/, '/') + href.replace(/^\//, '');
  }

  function dateSortKey(iso) {
    var match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return 0;
    return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
  }

  function sortByDate(list) {
    return list.slice().sort(function (a, b) {
      return dateSortKey(b.datePublished) - dateSortKey(a.datePublished);
    });
  }

  function getLatestArticles(limit) {
    var list = sortByDate(LATEST_ARTICLES);
    if (limit && limit > 0) return list.slice(0, limit);
    return list;
  }

  function mergeWithApiItems(apiItems, limit) {
    var seen = {};
    var out = [];
    getLatestArticles().forEach(function (a) {
      seen[a.slug] = true;
      seen[a.url] = true;
      out.push(a);
    });
    (apiItems || []).forEach(function (a) {
      if (!a) return;
      var key = a.slug || a.url;
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(
        enrichArticle({
          slug: a.slug || '',
          title: a.title || '',
          summary: a.summary || a.metaDescription || '',
          category: a.category || a.categoryName || '',
          cover_image: a.cover_image || a.featuredImageUrl || '',
          url: a.url || (a.slug ? '/article/' + encodeURIComponent(a.slug) : '#'),
          datePublished: (a.published_at || a.publishedAt || a.datePublished || '').toString().slice(0, 10),
          jalaliLabel: a.jalaliLabel || '',
        }),
      );
    });
    out = sortByDate(out);
    if (limit && limit > 0) return out.slice(0, limit);
    return out;
  }

  function renderHomeCard(a, base) {
    var article = enrichArticle(a);
    var url = resolveUrl(article, base || '');
    var cover = article.cover_image
      ? '<img class="article-card-cover" src="' +
        escapeHtml(withAssetVersion(article.cover_image, article)) +
        '" alt="' +
        escapeHtml(article.title) +
        '" loading="lazy" width="640" height="360" decoding="async">'
      : '<span class="article-card-placeholder" aria-hidden="true"></span>';
    var chip = article.category
      ? '<span class="article-chip">' + escapeHtml(article.category) + '</span>'
      : '';
    var summary = article.summary ? '<p>' + escapeHtml(article.summary) + '</p>' : '';
    var timeHtml = article.datePublished
      ? '<time class="article-card-date" datetime="' +
        escapeHtml(article.datePublished) +
        '"' +
        (article.jalaliLabel
          ? ' data-jalali-label="' + escapeHtml(article.jalaliLabel) + '"'
          : '') +
        '></time>'
      : '';
    return (
      '<article class="article-card">' +
      cover +
      '<div class="article-card-body">' +
      chip +
      timeHtml +
      '<h3><a href="' +
      escapeHtml(url) +
      '">' +
      escapeHtml(article.title) +
      '</a></h3>' +
      summary +
      '<a class="btn btn-main" href="' +
      escapeHtml(url) +
      '">مطالعه مقاله</a></div></article>'
    );
  }

  function renderSidebarWidget(opts) {
    opts = opts || {};
    var exclude = opts.excludeSlug || '';
    var items = getLatestArticles(opts.limit || 8).filter(function (a) {
      return a.slug !== exclude;
    });
    if (!items.length) return '';

    var list = items
      .map(function (a) {
        var href = resolveUrl(a, opts.base || '../');
        return (
          '<li class="border-b border-slate-100 last:border-0">' +
          '<a href="' +
          escapeHtml(href) +
          '" class="group block py-3 transition hover:bg-sky-50/80 rounded-lg px-1 -mx-1">' +
          '<span class="block text-sm font-bold leading-snug text-slate-800 group-hover:text-sky-700">' +
          escapeHtml(a.title) +
          '</span>' +
          (a.datePublished
            ? '<time datetime="' +
              escapeHtml(a.datePublished) +
              '"' +
              (a.jalaliLabel
                ? ' data-jalali-label="' + escapeHtml(a.jalaliLabel) + '"'
                : '') +
              ' class="mt-1.5 block text-xs font-medium text-slate-500"></time>'
            : '') +
          '</a></li>'
        );
      })
      .join('');

    return (
      '<div class="latest-articles-sidebar rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="latest-articles-heading">' +
      '<h2 id="latest-articles-heading" class="mb-1 text-base font-extrabold text-slate-900">مقالات تازه</h2>' +
      '<p class="mb-4 text-xs text-slate-500">جدیدترین مطالب آموزشی سلام دکتر</p>' +
      '<ul class="list-none m-0 p-0 space-y-0">' +
      list +
      '</ul>' +
      '<a href="' +
      escapeHtml((opts.base || '../') + 'articles.html') +
      '" class="mt-4 inline-flex text-xs font-bold text-sky-700 hover:text-sky-800">همه مقالات ←</a>' +
      '</div>'
    );
  }

  function mountSidebars(rootEl) {
    var scope = rootEl || document;
    var nodes = scope.querySelectorAll('[data-latest-articles-sidebar]');
    nodes.forEach(function (el) {
      el.innerHTML = renderSidebarWidget({
        base: el.getAttribute('data-base') || '../',
        excludeSlug: el.getAttribute('data-exclude') || '',
        limit: Number(el.getAttribute('data-limit') || 8) || 8,
      });
      if (root.renderPersianDates) root.renderPersianDates(el);
    });
  }

  function mountArticleListingGrids(opts) {
    opts = opts || {};
    var gridId = opts.gridId;
    var emptyId = opts.emptyId;
    var limit = opts.limit;
    var base = opts.base || '';
    var staticOnly = opts.staticOnly === true;

    var grid = gridId ? document.getElementById(gridId) : null;
    var empty = emptyId ? document.getElementById(emptyId) : null;
    if (!grid) return;

    function render(items) {
      grid.setAttribute('aria-busy', 'false');
      var cardFn = root.renderHomeArticleCard;
      if (!cardFn) {
        if (empty) empty.hidden = false;
        grid.innerHTML = '';
        return;
      }
      if (!items || !items.length) {
        if (empty) empty.hidden = false;
        grid.innerHTML = '';
        return;
      }
      if (empty) empty.hidden = true;
      grid.innerHTML = items
        .map(function (a) {
          return cardFn(a, base);
        })
        .join('');
      if (root.renderPersianDates) root.renderPersianDates(grid);
    }

    var staticLatest = getLatestArticles(limit);
    render(staticLatest);

    if (staticOnly) return;

    fetch('/api/articles')
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (items) {
        if (!Array.isArray(items)) items = [];
        var merged = mergeWithApiItems(items, limit);
        render(merged.length ? merged : staticLatest);
      })
      .catch(function () {
        render(staticLatest);
      });
  }

  function refreshCatalog() {
    LATEST_ARTICLES = loadCatalog();
  }

  root.LATEST_ARTICLES = LATEST_ARTICLES;
  root.getLatestArticles = getLatestArticles;
  root.mergeLatestArticlesWithApi = mergeWithApiItems;
  root.renderHomeArticleCard = renderHomeCard;
  root.renderLatestArticlesSidebar = renderSidebarWidget;
  root.mountLatestArticlesSidebars = mountSidebars;
  root.mountArticleListingGrids = mountArticleListingGrids;
  root.resolveLatestArticleUrl = resolveUrl;
  root.formatPersianJalaliDate = formatPersianJalaliDate;
  root.refreshArticlesCatalog = refreshCatalog;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        mountSidebars();
      });
    } else {
      mountSidebars();
    }
  }
})(typeof window !== 'undefined' ? window : this);
