/**
 * Homepage hero — fetch VIP slides from /api/hero-slides and render the slider.
 * VIDEO slides use HeroClickPlay (click-to-play); IMAGE slides render as linked stills.
 */
(function () {
  'use strict';

  var API_URL = '/api/hero-slides';
  var DEFAULT_POSTER = 'images/main-hero.png';
  var FALLBACK_SLIDES = [
    {
      mediaUrl: 'assets/video/intro.mp4',
      mediaType: 'VIDEO',
      title: 'پخش ویدیو معرفی سلام دکتر',
      ctaLink: null,
    },
  ];

  var PLAY_BTN_SVG =
    '<svg class="mr-[-3px] h-8 w-8 md:h-9 md:w-9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M8 5v14l11-7z"/>' +
    '</svg>';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  async function fetchHeroSlides() {
    var response = await fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new Error('Hero slides request failed (' + response.status + ')');
    }
    var payload = await response.json();
    if (!payload || !Array.isArray(payload.slides)) {
      throw new Error('Invalid hero slides payload');
    }
    return payload.slides;
  }

  function buildCtaLink(ctaLink, title) {
    if (!ctaLink) return '';
    var label = esc(title || 'مشاهده کلینیک');
    return (
      '<a class="hero-slide-cta" href="' +
      esc(ctaLink) +
      '" rel="noopener">' +
      label +
      ' <span aria-hidden="true">←</span></a>'
    );
  }

  function buildVideoSlide(slide, index, isActive) {
    var src = esc(slide.mediaUrl);
    var title = esc(slide.title || 'پخش ویدیو');
    var poster = esc(slide.posterUrl || DEFAULT_POSTER);
    var fetchPriority = index === 0 ? ' fetchpriority="high"' : '';
    var activeClass = isActive ? ' is-active' : '';

    return (
      '<div class="slide-item' +
      activeClass +
      '" data-slide-index="' +
      index +
      '">' +
      '<div class="hero-video-stage" data-hero-click-play data-video-src="' +
      src +
      '">' +
      '<button type="button" class="hero-video-cover group" data-hero-play-trigger aria-label="' +
      title +
      '">' +
      '<img src="' +
      poster +
      '" alt="' +
      title +
      '" width="1027" height="562" decoding="async"' +
      fetchPriority +
      ' class="absolute inset-0 h-full w-full object-cover" data-hero-cover>' +
      '<span class="absolute inset-0 bg-black/45 transition-colors group-hover:bg-black/55" aria-hidden="true"></span>' +
      '<span class="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#1294e0] shadow-lg ring-4 ring-white/30 transition-transform duration-300 animate-pulse group-hover:scale-110 group-hover:animate-none md:h-20 md:w-20" aria-hidden="true">' +
      PLAY_BTN_SVG +
      '</span>' +
      '</button>' +
      '<div class="hero-video-player hidden" data-hero-video-mount aria-hidden="true"></div>' +
      buildCtaLink(slide.ctaLink, slide.title) +
      '</div>' +
      '</div>'
    );
  }

  function buildImageSlide(slide, index, isActive) {
    var src = esc(slide.mediaUrl);
    var title = esc(slide.title || 'اسلاید تبلیغاتی');
    var fetchPriority = index === 0 ? ' fetchpriority="high"' : '';
    var activeClass = isActive ? ' is-active' : '';
    var img =
      '<img src="' +
      src +
      '" alt="' +
      title +
      '" width="1027" height="562" decoding="async"' +
      fetchPriority +
      ' class="absolute inset-0 h-full w-full object-cover">';

    var mediaInner = slide.ctaLink
      ? '<a class="hero-slide-image-link" href="' + esc(slide.ctaLink) + '" aria-label="' + title + '">' + img + '</a>'
      : img;

    return (
      '<div class="slide-item' +
      activeClass +
      '" data-slide-index="' +
      index +
      '">' +
      '<div class="hero-video-stage hero-video-stage--image">' +
      mediaInner +
      buildCtaLink(slide.ctaLink, slide.title) +
      '</div>' +
      '</div>'
    );
  }

  function buildSlideHtml(slide, index) {
    var mediaType = String(slide.mediaType || '').toUpperCase();
    var isActive = index === 0;
    if (mediaType === 'IMAGE') return buildImageSlide(slide, index, isActive);
    return buildVideoSlide(slide, index, isActive);
  }

  function buildSlidesHtml(slides) {
    return slides
      .map(function (slide, index) {
        return buildSlideHtml(slide, index);
      })
      .join('');
  }

  function setTrackState(track, state) {
    if (!track) return;
    track.classList.toggle('is-loading', state === 'loading');
    track.classList.toggle('is-error', state === 'error');
    track.setAttribute('data-hero-slides-state', state);
  }

  function initClickToPlay(track) {
    if (!window.HeroClickPlay || typeof window.HeroClickPlay.init !== 'function') return;
    var roots = track.querySelectorAll('[data-hero-click-play]');
    for (var i = 0; i < roots.length; i++) {
      window.HeroClickPlay.init(roots[i]);
    }
  }

  /**
   * Placeholder — initialize slider navigation (arrows / pagination dots).
   * Wire prev/next/dot handlers here when multiple slides are present.
   */
  function initSliderControls(sliderRoot, track) {
    if (!sliderRoot || !track) return null;

    var slides = track.querySelectorAll('.slide-item');
    if (slides.length <= 1) return { slideCount: slides.length };

    // Future: enable [data-hero-prev], [data-hero-next], [data-hero-dots]
    return {
      slideCount: slides.length,
      goTo: function (_index) {
        /* navigation logic placeholder */
      },
    };
  }

  function renderHeroSlides(track, slides) {
    if (!track) return;
    track.innerHTML = buildSlidesHtml(slides);
    setTrackState(track, 'ready');

    var sliderRoot = track.closest('[data-hero-slider]');
    initClickToPlay(track);
    initSliderControls(sliderRoot, track);
  }

  function renderFallback(track) {
    renderHeroSlides(track, FALLBACK_SLIDES);
    setTrackState(track, 'fallback');
  }

  async function loadAndRenderHeroSlides() {
    var track = qs('[data-hero-track]');
    if (!track) return;

    setTrackState(track, 'loading');

    try {
      var slides = await fetchHeroSlides();
      if (!slides.length) {
        renderFallback(track);
        return;
      }
      renderHeroSlides(track, slides);
    } catch (err) {
      console.warn('[hero-slides]', err && err.message ? err.message : err);
      renderFallback(track);
    }
  }

  window.HeroSlides = {
    fetchHeroSlides: fetchHeroSlides,
    renderHeroSlides: renderHeroSlides,
    initSliderControls: initSliderControls,
    load: loadAndRenderHeroSlides,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRenderHeroSlides);
  } else {
    loadAndRenderHeroSlides();
  }
})();
