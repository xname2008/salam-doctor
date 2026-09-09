/**
 * Per-category Top Clinics (up to 10) + slider for landing / category pages.
 *
 * Markup can be static inside .category-monetize-root, or will be injected.
 * data-category-id — API category slug (required)
 * data-keywords — optional comma-separated service keywords for catalog fallback
 * data-tag-keywords — optional comma-separated keywords used to filter each
 *   clinic's own services into category-relevant tag chips (e.g. hair/eyebrow/
 *   beard, or laser brand names). Clinics with no matching service show no tags.
 * data-layout="premium-stack" — full-width premium clinic rows (category page)
 */
(function (window, document) {
  'use strict';

  var TOP_CLINICS_LIMIT = 10;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toPersianDigits(n) {
    return String(n).replace(/[0-9]/g, function (d) {
      return String.fromCharCode(0x06f0 + Number(d));
    });
  }

  var CATEGORY_LABELS = {
    hair: 'کاشت مو و ابرو',
    skin: 'جوانسازی و پوست',
    laser: 'لیزر موهای زائد',
    injection: 'تزریقات زیبایی',
    surgery: 'جراحی زیبایی',
    slimming: 'لاغری و پیکرتراشی',
    lasik: 'لیزیک',
    'femto-lasik': 'فمتولیزیک',
    prk: 'پی‌آر‌کی',
    products: 'محصولات زیبایی',
    pharmacy: 'داروخانه',
  };

  function clinicPhotoAlt(name) {
    var n = String(name || '').trim() || 'مرکز درمانی';
    return 'عکس کلینیک ' + n + ' در شیراز';
  }

  function categoryIconAlt(categoryId) {
    var label = CATEGORY_LABELS[categoryId] || 'زیبایی';
    return 'بهترین مراکز ' + label + ' در شیراز';
  }

  function parseKeywords(root) {
    var raw = root.getAttribute('data-keywords') || '';
    return raw
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  // Curated per-category tag keywords (e.g. "hair, eyebrow, beard" for the
  // hair-transplant page, or laser brand names for laser-hair). Distinct from
  // data-keywords, which is only used to select eligible clinics for the
  // catalog fallback. A clinic's own service list is filtered against these
  // keywords so only genuinely relevant tags are shown under each clinic; if
  // nothing matches, no tags are rendered for that clinic.
  function parseTagKeywords(root) {
    var raw = root.getAttribute('data-tag-keywords') || '';
    return raw
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function isPremiumLayout(root) {
    return root.getAttribute('data-layout') === 'premium-stack';
  }

  // data-hide-tags="1" — suppress the per-clinic service/tag chip list
  // entirely (falls back to the plain tagline, same as a clinic with no
  // matching services would show).
  function tagsHidden(root) {
    return root.getAttribute('data-hide-tags') === '1';
  }

  function markupTemplate(categoryId, premium) {
    var listClass = premium
      ? 'premium-clinic-stack'
      : 'featured-list';
    return [
      '<section class="section featured-section category-monetize-top5' +
        (premium ? ' is-premium-stack' : '') +
        '" aria-labelledby="cm-top5-title-' +
        escapeHtml(categoryId) +
        '">',
      '  <div class="container">',
      '    <h2 class="title" id="cm-top5-title-' +
        escapeHtml(categoryId) +
        '">مراکز برتر این دسته‌بندی</h2>',
      '    <p class="subtitle">منتخب مراکز همکار سلام دکتر در این حوزه</p>',
      '    <ol class="' +
        listClass +
        '" data-cm-top5-list aria-busy="true"></ol>',
      '    <p class="featured-empty" data-cm-top5-empty hidden>به‌زودی مراکز برتر این دسته‌بندی معرفی می‌شوند.</p>',
      '  </div>',
      '</section>',
      '<section class="section category-monetize-slider" aria-labelledby="cm-slider-title-' +
        escapeHtml(categoryId) +
        '">',
      '  <div class="container">',
      '    <h2 class="title" id="cm-slider-title-' +
        escapeHtml(categoryId) +
        '">گالری و پیشنهادهای ویژه</h2>',
      '    <p class="subtitle">اسلایدر اختصاصی این دسته‌بندی</p>',
      '    <div class="category-slider swiper doctor-slider" data-cm-slider>',
      '      <div class="swiper-wrapper" data-cm-slider-track></div>',
      '      <div class="swiper-button-prev"></div>',
      '      <div class="swiper-button-next"></div>',
      '      <div class="swiper-pagination"></div>',
      '    </div>',
      '    <p class="featured-empty" data-cm-slider-empty hidden>به‌زودی اسلایدر این دسته‌بندی فعال می‌شود.</p>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function ensureMarkup(root, categoryId) {
    if (!root.querySelector('[data-cm-top5-list]')) {
      root.innerHTML = markupTemplate(categoryId, isPremiumLayout(root));
      return;
    }
    if (isPremiumLayout(root)) {
      var section = root.querySelector('.category-monetize-top5');
      var list = root.querySelector('[data-cm-top5-list]');
      if (section) section.classList.add('is-premium-stack');
      if (list) {
        list.classList.remove('featured-list');
        list.classList.add('premium-clinic-stack');
      }
    }
  }

  function clinicMatchesKeywords(clinic, keywords) {
    if (!keywords.length) return true;
    if (!Array.isArray(clinic.services) || !clinic.services.length) return false;
    return clinic.services.some(function (service) {
      var text = '';
      if (typeof service === 'string') text = service.trim();
      else if (service && typeof service === 'object') {
        text = String(service.label || service.name || service.slug || '').trim();
      }
      if (!text || text === 'دارد') return false;
      return keywords.some(function (keyword) {
        return text.indexOf(keyword) !== -1;
      });
    });
  }

  function pickKeyServices(clinic, limit) {
    var max = limit || 4;
    if (!clinic || !Array.isArray(clinic.services)) return [];
    return clinic.services
      .map(function (s) {
        if (typeof s === 'string') return s.trim();
        if (s && typeof s === 'object') return String(s.label || s.name || '').trim();
        return '';
      })
      .filter(function (s) {
        return s && s !== 'دارد';
      })
      .slice(0, max);
  }

  function filterServicesByKeywords(services, keywords, limit) {
    var max = limit || 4;
    if (!Array.isArray(services) || !keywords || !keywords.length) return [];
    var out = [];
    services.forEach(function (s) {
      var text = '';
      if (typeof s === 'string') text = s.trim();
      else if (s && typeof s === 'object') {
        text = String(s.label || s.name || s.slug || '').trim();
      }
      if (!text || text === 'دارد') return;
      var matches = keywords.some(function (k) {
        return text.indexOf(k) !== -1;
      });
      if (matches && out.indexOf(text) === -1) out.push(text);
    });
    return out.slice(0, max);
  }

  function catalogFallback(keywords, limit) {
    var max = limit || TOP_CLINICS_LIMIT;
    var list = Array.isArray(window.clinicsData) ? window.clinicsData.slice() : [];
    if (typeof window.clinicsForDisplay === 'function') {
      list = window.clinicsForDisplay(list);
    } else if (typeof window.sortNahalFirst === 'function') {
      list = window.sortNahalFirst(list);
    }

    var filtered = keywords.length
      ? list.filter(function (c) {
          return clinicMatchesKeywords(c, keywords);
        })
      : list.slice();

    // Always prefer Nahal in rank 1 when present, then fill remaining slots
    var nahalId =
      typeof window.NAHAL_CLINIC_ID === 'number' ? window.NAHAL_CLINIC_ID : 114;
    var nahal = null;
    var rest = [];
    filtered.forEach(function (c) {
      if (Number(c.id) === nahalId) nahal = c;
      else rest.push(c);
    });
    if (!nahal) {
      var fromAll = list.find(function (c) {
        return Number(c.id) === nahalId;
      });
      if (fromAll) nahal = fromAll;
    }
    var ordered = (nahal ? [nahal] : []).concat(rest);

    // If keyword filter left too few samples, pad from full catalog (skip duplicates)
    if (ordered.length < max) {
      var seen = {};
      ordered.forEach(function (c) {
        seen[Number(c.id)] = true;
      });
      list.forEach(function (c) {
        if (ordered.length >= max) return;
        var id = Number(c.id);
        if (seen[id]) return;
        seen[id] = true;
        ordered.push(c);
      });
    }

    return ordered.slice(0, max).map(function (c, index) {
      return {
        id: 'fallback-' + c.id,
        clinic_id: c.id,
        rank: index + 1,
        name: (c.sliderTitle || c.name || '').trim(),
        tagline: (c.sliderTagline || '').trim(),
        image: c.image || 'images/sample-clinic-services.webp',
        link: (typeof window.clinicProfilePath === 'function')
          ? window.clinicProfilePath(c.id)
          : ('/doctor/clinic-' + encodeURIComponent(c.id)),
        badge: Number(c.id) === nahalId ? 'ویژه' : null,
        services: pickKeyServices(c, 4),
        _fallback: true,
      };
    });
  }

  function clinicProfileHref(c) {
    if (typeof window.clinicProfilePath === 'function') {
      if (c && c.clinic_id != null) return window.clinicProfilePath(c.clinic_id);
      if (c && c.id != null && String(c.id).indexOf('fallback-') !== 0) {
        return window.clinicProfilePath(c);
      }
    }
    if (c && c.link) {
      if (typeof window.rewriteLegacyProfileLink === 'function') {
        var rewritten = window.rewriteLegacyProfileLink(c.link);
        if (rewritten) return rewritten;
      }
      var raw = String(c.link).trim();
      if (/\/doctor\//.test(raw) || /^doctor\//i.test(raw)) {
        return raw.charAt(0) === '/' ? raw : '/' + raw;
      }
    }
    var id = c && (c.clinic_id != null ? c.clinic_id : c.id);
    if (id != null && String(id).indexOf('fallback-') !== 0) {
      return '/doctor/clinic-' + encodeURIComponent(id);
    }
    return '#';
  }

  /** Fire-and-forget click counter; navigation uses the real profile URL. */
  function trackTopClinicClick(categoryId, c) {
    if (!categoryId || !c || !c.id || c._fallback) return;
    var url =
      '/api/categories/' +
      encodeURIComponent(categoryId) +
      '/top5/click?id=' +
      encodeURIComponent(c.id) +
      '&noredirect=1';
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
        return;
      }
    } catch (_e) {}
    try {
      fetch(url, { method: 'GET', credentials: 'same-origin', keepalive: true }).catch(function () {});
    } catch (_e2) {}
  }

  function clinicHref(categoryId, c) {
    return clinicProfileHref(c);
  }

  function servicesHtml(c, hideTags) {
    var services = hideTags ? [] : (Array.isArray(c.services) ? c.services : []);
    if (!services.length && c.tagline) {
      return (
        '<p class="premium-clinic-tagline">' + escapeHtml(c.tagline) + '</p>'
      );
    }
    if (!services.length) return '';
    return (
      '<ul class="premium-clinic-services" aria-label="خدمات کلیدی">' +
      services
        .map(function (s) {
          return '<li>' + escapeHtml(s) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function renderPremiumRow(categoryId, c, hideTags) {
    var badge = c.badge
      ? '<span class="featured-badge">' + escapeHtml(c.badge) + '</span>'
      : '';
    var imgSrc = c.image || 'images/sample-clinic-services.webp';
    var href = clinicHref(categoryId, c);
    var trackAttrs =
      !c._fallback && c.id
        ? ' data-cm-track-id="' +
          escapeHtml(String(c.id)) +
          '" data-cm-track-cat="' +
          escapeHtml(String(categoryId || '')) +
          '"'
        : '';
    return (
      '<li class="premium-clinic-item">' +
      '<a class="premium-clinic-row" href="' +
      escapeHtml(href) +
      '"' +
      trackAttrs +
      '>' +
      '<div class="premium-clinic-media">' +
      '<span class="premium-clinic-rank" aria-label="رتبه ' +
      escapeHtml(String(c.rank)) +
      '">' +
      toPersianDigits(c.rank) +
      '</span>' +
      '<img class="premium-clinic-image" src="' +
      escapeHtml(imgSrc) +
      '" alt="' +
      escapeHtml(clinicPhotoAlt(c.name)) +
      '" width="480" height="360" loading="lazy" decoding="async">' +
      '</div>' +
      '<div class="premium-clinic-body">' +
      '<div class="premium-clinic-heading">' +
      '<h3 class="premium-clinic-name">' +
      escapeHtml(c.name) +
      badge +
      '</h3>' +
      '<div class="premium-clinic-rating" title="پیشنهادی سلام دکتر">' +
      '<span class="premium-clinic-stars" aria-hidden="true">★★★★★</span>' +
      '<span class="premium-clinic-rating-label">پیشنهادی</span>' +
      '</div>' +
      '</div>' +
      servicesHtml(c, hideTags) +
      '<div class="premium-clinic-actions">' +
      '<span class="btn btn-main premium-clinic-book">رزرو نوبت</span>' +
      '</div>' +
      '</div>' +
      '</a>' +
      '</li>'
    );
  }

  function renderCompactRow(categoryId, c) {
    var badge = c.badge
      ? '<span class="featured-badge">' + escapeHtml(c.badge) + '</span>'
      : '';
    var imgSrc = c.image || 'images/sample-clinic-services.webp';
    var href = clinicHref(categoryId, c);
    var trackAttrs =
      !c._fallback && c.id
        ? ' data-cm-track-id="' +
          escapeHtml(String(c.id)) +
          '" data-cm-track-cat="' +
          escapeHtml(String(categoryId || '')) +
          '"'
        : '';
    return (
      '<li>' +
      '<a class="featured-row" href="' +
      escapeHtml(href) +
      '"' +
      trackAttrs +
      '>' +
      '<div class="featured-rank">' +
      toPersianDigits(c.rank) +
      '</div>' +
      '<img class="featured-thumb" src="' +
      escapeHtml(imgSrc) +
      '" alt="' +
      escapeHtml(clinicPhotoAlt(c.name)) +
      '" width="112" height="112" loading="lazy" decoding="async">' +
      '<div class="featured-info">' +
      '<div class="featured-name">' +
      escapeHtml(c.name) +
      badge +
      '</div>' +
      '<div class="featured-tagline">' +
      escapeHtml(c.tagline || '') +
      '</div>' +
      '</div>' +
      '<div class="featured-cta"><span class="btn btn-main">مشاهده</span></div>' +
      '</a>' +
      '</li>'
    );
  }

  function enrichFromCatalog(items, tagKeywords) {
    if (!Array.isArray(items) || !Array.isArray(window.clinicsData)) return items || [];
    var byId = {};
    window.clinicsData.forEach(function (c) {
      if (c && c.id != null) byId[Number(c.id)] = c;
    });
    var keywords = Array.isArray(tagKeywords) ? tagKeywords : [];
    return items.map(function (item) {
      var clinic = byId[Number(item.clinic_id)];
      if (!clinic) return item;
      var next = Object.assign({}, item);
      if (!next.image) next.image = clinic.image || next.image;
      if (!next.name) next.name = clinic.sliderTitle || clinic.name || next.name;
      if (!next.tagline) next.tagline = clinic.sliderTagline || next.tagline;
      if (keywords.length) {
        // Show only tags relevant to this category (e.g. hair/eyebrow/beard,
        // or laser brand names); if the clinic has none, render no tags.
        next.services = filterServicesByKeywords(clinic.services, keywords, 4);
      } else if (!Array.isArray(next.services) || !next.services.length) {
        next.services = pickKeyServices(clinic, 4);
      }
      return next;
    });
  }

  function renderTop5(root, categoryId, items, tagKeywords) {
    var section = root.querySelector('.category-monetize-top5');
    var list = root.querySelector('[data-cm-top5-list]');
    var empty = root.querySelector('[data-cm-top5-empty]');
    if (!section || !list) return;

    section.hidden = false;
    list.setAttribute('aria-busy', 'false');

    var capped = enrichFromCatalog(
      Array.isArray(items) ? items.slice(0, TOP_CLINICS_LIMIT) : [],
      tagKeywords
    );

    if (!capped.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    var premium = isPremiumLayout(root);
    var hideTags = tagsHidden(root);
    list.innerHTML = capped
      .map(function (c) {
        return premium
          ? renderPremiumRow(categoryId, c, hideTags)
          : renderCompactRow(categoryId, c);
      })
      .join('');

    if (!list._cmTrackBound) {
      list._cmTrackBound = true;
      list.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest('a[data-cm-track-id]') : null;
        if (!a) return;
        trackTopClinicClick(a.getAttribute('data-cm-track-cat'), {
          id: a.getAttribute('data-cm-track-id'),
        });
      });
    }
  }

  function buildClinicSlide(item) {
    var name = escapeHtml(item.name || item.title || '');
    var summary = escapeHtml(item.tagline || item.caption || '');
    var image = escapeHtml(item.image || 'images/sample-clinic-services.webp');
    var href =
      (typeof window.clinicProfilePath === 'function' && item.clinic_id
        ? window.clinicProfilePath(item.clinic_id)
        : null) ||
      item.link ||
      (item.clinic_id
        ? '/doctor/clinic-' + encodeURIComponent(item.clinic_id)
        : '');
    var body =
      '<article class="doctor-card">' +
      '<img src="' +
      image +
      '" alt="' +
      escapeHtml(clinicPhotoAlt(item.name || item.title)) +
      '" width="400" height="300" loading="lazy" decoding="async">' +
      '<div class="doctor-body">' +
      '<b>' +
      name +
      '</b>' +
      (summary ? '<span>' + summary + '</span>' : '') +
      (href
        ? '<a class="btn btn-main" href="' +
          escapeHtml(href) +
          '">درخواست مشاوره</a>'
        : '') +
      '</div></article>';

    if (item._imageOnly) {
      var img =
        '<img src="' +
        image +
        '" alt="' +
        escapeHtml(
          item._categoryPromo
            ? categoryIconAlt(item._categoryId)
            : clinicPhotoAlt(item.name || item.title)
        ) +
        '" width="400" height="300" loading="lazy" decoding="async">';
      body = href ? '<a href="' + escapeHtml(href) + '">' + img + '</a>' : img;
    }

    return '<div class="swiper-slide">' + body + '</div>';
  }

  function initSwiper(sliderEl, count) {
    if (!window.Swiper || !sliderEl) return null;
    if (sliderEl._cmSwiper) {
      try {
        sliderEl._cmSwiper.destroy(true, true);
      } catch (e) {}
      sliderEl._cmSwiper = null;
    }
    sliderEl._cmSwiper = new window.Swiper(sliderEl, {
      loop: count > 1,
      watchOverflow: true,
      allowTouchMove: true,
      speed: 700,
      spaceBetween: 12,
      slidesPerView: Math.min(4, Math.max(1, count)),
      autoplay:
        count > 1
          ? {
              delay: 3200,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
      pagination: {
        el: sliderEl.querySelector('.swiper-pagination'),
        clickable: true,
      },
      navigation: {
        nextEl: sliderEl.querySelector('.swiper-button-next'),
        prevEl: sliderEl.querySelector('.swiper-button-prev'),
      },
      breakpoints: {
        0: { slidesPerView: 1 },
        640: { slidesPerView: Math.min(2, count) },
        1024: { slidesPerView: Math.min(4, count) },
      },
    });
    return sliderEl._cmSwiper;
  }

  function renderSlider(root, items, asClinicCards) {
    var section = root.querySelector('.category-monetize-slider');
    var track = root.querySelector('[data-cm-slider-track]');
    var sliderEl = root.querySelector('[data-cm-slider]');
    var empty = root.querySelector('[data-cm-slider-empty]');
    if (!section || !track || !sliderEl) return;

    section.hidden = false;

    if (!items || !items.length) {
      track.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    var slides = items.map(function (item) {
      if (asClinicCards || item._fallback || item.clinic_id) {
        return buildClinicSlide(item);
      }
      return buildClinicSlide({
        name: item.title || '',
        image: item.image,
        link: item.link,
        _imageOnly: true,
      });
    });
    track.innerHTML = slides.join('');

    function tryInit(attempt) {
      if (window.Swiper) {
        initSwiper(sliderEl, items.length);
        return;
      }
      if (attempt < 20) {
        setTimeout(function () {
          tryInit(attempt + 1);
        }, 100);
      }
    }
    tryInit(0);
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) return [];
      return r.json().catch(function () {
        return [];
      });
    });
  }

  function mountRoot(root) {
    var categoryId = String(root.getAttribute('data-category-id') || '')
      .trim()
      .toLowerCase();
    if (!categoryId) return;
    if (root.getAttribute('data-cm-mounted') === '1') return;
    root.setAttribute('data-cm-mounted', '1');

    ensureMarkup(root, categoryId);
    var keywords = parseKeywords(root);
    var tagKeywords = parseTagKeywords(root);

    var top5Section = root.querySelector('.category-monetize-top5');
    var sliderSection = root.querySelector('.category-monetize-slider');
    if (top5Section) top5Section.hidden = false;
    if (sliderSection) sliderSection.hidden = false;

    Promise.all([
      fetchJson('/api/categories/' + encodeURIComponent(categoryId) + '/top5'),
      fetchJson('/api/categories/' + encodeURIComponent(categoryId) + '/slider'),
    ])
      .then(function (results) {
        var top5 = Array.isArray(results[0]) ? results[0] : [];
        var slides = Array.isArray(results[1]) ? results[1] : [];
        var usedClinicFallback = false;

        if (!top5.length) {
          top5 = catalogFallback(keywords, TOP_CLINICS_LIMIT);
          usedClinicFallback = top5.length > 0;
        } else if (top5.length < TOP_CLINICS_LIMIT) {
          var pad = catalogFallback(keywords, TOP_CLINICS_LIMIT);
          var seen = {};
          top5.forEach(function (c) {
            seen[Number(c.clinic_id)] = true;
          });
          pad.forEach(function (c) {
            if (top5.length >= TOP_CLINICS_LIMIT) return;
            if (seen[Number(c.clinic_id)]) return;
            seen[Number(c.clinic_id)] = true;
            c.rank = top5.length + 1;
            top5.push(c);
          });
        }
        renderTop5(root, categoryId, top5, tagKeywords);

        if (slides.length) {
          renderSlider(root, slides, false);
        } else {
          var clinicSlides = usedClinicFallback
            ? top5
            : catalogFallback(keywords, 8);
          renderSlider(root, clinicSlides, true);
        }
      })
      .catch(function () {
        var fallback = catalogFallback(keywords, TOP_CLINICS_LIMIT);
        renderTop5(root, categoryId, fallback, tagKeywords);
        renderSlider(root, fallback, true);
      });
  }

  function initCategoryMonetize() {
    var roots = document.querySelectorAll('.category-monetize-root[data-category-id]');
    for (var i = 0; i < roots.length; i += 1) {
      var id = String(roots[i].getAttribute('data-category-id') || '').trim();
      if (id) mountRoot(roots[i]);
    }
  }

  window.initCategoryMonetize = initCategoryMonetize;

  function boot() {
    initCategoryMonetize();
    setTimeout(initCategoryMonetize, 0);
    setTimeout(function () {
      var roots = document.querySelectorAll(
        '.category-monetize-root[data-category-id]'
      );
      for (var i = 0; i < roots.length; i += 1) {
        if (roots[i].getAttribute('data-cm-mounted') === '1') continue;
        mountRoot(roots[i]);
      }
      for (var j = 0; j < roots.length; j += 1) {
        var root = roots[j];
        var list = root.querySelector('[data-cm-top5-list]');
        if (!list || list.children.length) continue;
        if (!Array.isArray(window.clinicsData) || !window.clinicsData.length)
          continue;
        var categoryId = String(
          root.getAttribute('data-category-id') || ''
        ).trim();
        var fb = catalogFallback(parseKeywords(root), TOP_CLINICS_LIMIT);
        if (fb.length) {
          renderTop5(root, categoryId, fb, parseTagKeywords(root));
          var track = root.querySelector('[data-cm-slider-track]');
          if (track && !track.children.length) renderSlider(root, fb, true);
        }
      }
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
