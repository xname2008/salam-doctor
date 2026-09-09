/**
 * Category landing — full-width video hero (slider-ready).
 * Usage: <section data-category-hero data-specialty="کاشت مو" ...>
 */
(function () {
  'use strict';

  var DEFAULT_CITY = 'شیراز';
  var DEFAULT_CTA_LABEL = 'رزرو آنلاین نوبت';

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  function qsa(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  function buildTitle(specialty, city) {
    var name = String(specialty || '').trim() || 'خدمات زیبایی';
    var loc = String(city || DEFAULT_CITY).trim() || DEFAULT_CITY;
    return name + ' در ' + loc;
  }

  function applyCopy(root) {
    var specialty = root.getAttribute('data-specialty') || '';
    var city = root.getAttribute('data-city') || DEFAULT_CITY;
    var titleEl = qs(root, '[data-hero-title]');
    var subtitleEl = qs(root, '[data-hero-subtitle]');
    var ctaEl = qs(root, '[data-hero-cta]');

    var title = root.getAttribute('data-hero-title-text') || buildTitle(specialty, city);
    if (titleEl) titleEl.textContent = title;

    var subtitle =
      root.getAttribute('data-hero-subtitle-text') ||
      (subtitleEl && subtitleEl.textContent.trim()) ||
      '';
    if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;

    if (ctaEl) {
      var href = root.getAttribute('data-cta-href');
      var label = root.getAttribute('data-cta-label') || DEFAULT_CTA_LABEL;
      if (href) ctaEl.setAttribute('href', href);
      ctaEl.textContent = label;
    }
  }

  function syncSlideVideos(track, activeIndex) {
    qsa(track, '.slide-item').forEach(function (slide, index) {
      var video = qs(slide, 'video');
      if (!video) return;
      if (index === activeIndex) {
        slide.classList.add('is-active');
        slide.hidden = false;
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {
            /* autoplay blocked — poster remains visible */
          });
        }
      } else {
        slide.classList.remove('is-active');
        slide.hidden = true;
        video.pause();
        try {
          video.currentTime = 0;
        } catch (_err) {
          /* ignore */
        }
      }
    });
  }

  function initSlider(root) {
    var track = qs(root, '[data-hero-track]');
    if (!track) return;

    var slides = qsa(track, '.slide-item');
    if (slides.length <= 1) {
      syncSlideVideos(track, 0);
      return null;
    }

    var state = { index: 0 };
    var prevBtn = qs(root, '[data-hero-prev]');
    var nextBtn = qs(root, '[data-hero-next]');
    var dotsRoot = qs(root, '[data-hero-dots]');

    function goTo(index) {
      var total = slides.length;
      state.index = ((index % total) + total) % total;
      syncSlideVideos(track, state.index);
      if (dotsRoot) {
        qsa(dotsRoot, '[data-hero-dot]').forEach(function (dot, i) {
          dot.setAttribute('aria-selected', i === state.index ? 'true' : 'false');
          dot.classList.toggle('is-active', i === state.index);
        });
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        goTo(state.index - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goTo(state.index + 1);
      });
    }

    goTo(0);
    return { goTo: goTo };
  }

  function initHero(root) {
    if (!root || root.getAttribute('data-hero-initialized') === 'true') return;
    applyCopy(root);
    initSlider(root);
    root.setAttribute('data-hero-initialized', 'true');
  }

  function initAll() {
    qsa(document, '[data-category-hero]').forEach(initHero);
  }

  window.CategoryHero = {
    init: initHero,
    initAll: initAll,
    buildTitle: buildTitle,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
