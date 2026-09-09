/* Circular gallery + lightbox for clinic profile pages */
(function (global) {
  'use strict';

  var lightboxEl = null;
  var lightboxState = { items: [], index: 0 };
  var swipeState = { active: false, startX: 0, startY: 0, pointerId: null };

  function bindLightboxSwipe(stage) {
    if (!stage || stage.dataset.swipeBound === '1') return;
    stage.dataset.swipeBound = '1';

    stage.addEventListener('pointerdown', function (e) {
      if (lightboxState.items.length <= 1) return;
      swipeState.active = true;
      swipeState.startX = e.clientX;
      swipeState.startY = e.clientY;
      swipeState.pointerId = e.pointerId;
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointerup', function (e) {
      if (!swipeState.active || e.pointerId !== swipeState.pointerId) return;
      swipeState.active = false;
      swipeState.pointerId = null;
      var dx = e.clientX - swipeState.startX;
      var dy = e.clientY - swipeState.startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) showLightboxAt(lightboxState.index - 1);
      else showLightboxAt(lightboxState.index + 1);
    });

    stage.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== swipeState.pointerId) return;
      swipeState.active = false;
      swipeState.pointerId = null;
    });
  }

  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'clinic-lightbox';
    lightboxEl.setAttribute('hidden', '');
    lightboxEl.innerHTML =
      '<button type="button" class="clinic-lightbox__close" aria-label="بستن">×</button>'
      + '<div class="clinic-lightbox__stage">'
      + '<img class="clinic-lightbox__img" alt="">'
      + '<p class="clinic-lightbox__counter"></p>'
      + '</div>';
    document.body.appendChild(lightboxEl);

    var stage = lightboxEl.querySelector('.clinic-lightbox__stage');
    bindLightboxSwipe(stage);

    lightboxEl.querySelector('.clinic-lightbox__close').addEventListener('click', closeLightbox);
    lightboxEl.addEventListener('click', function (e) {
      if (e.target === lightboxEl) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (!lightboxEl.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') showLightboxAt(lightboxState.index - 1);
      if (e.key === 'ArrowLeft') showLightboxAt(lightboxState.index + 1);
    });
    return lightboxEl;
  }

  function showLightboxAt(index) {
    if (!lightboxState.items.length) return;
    var next = Math.max(0, Math.min(lightboxState.items.length - 1, index));
    lightboxState.index = next;
    var item = lightboxState.items[next];
    var root = ensureLightbox();
    var img = root.querySelector('.clinic-lightbox__img');
    var counter = root.querySelector('.clinic-lightbox__counter');
    img.src = item.src;
    img.alt = item.alt || '';
    counter.textContent = (next + 1) + ' از ' + lightboxState.items.length;
    counter.hidden = lightboxState.items.length <= 1;
  }

  function openLightbox(src, alt, options) {
    if (!src) return;
    var opts = options || {};
    var items = Array.isArray(opts.items) && opts.items.length
      ? opts.items
      : [{ src: src, alt: alt || '' }];
    var index = typeof opts.index === 'number' ? opts.index : items.findIndex(function (item) {
      return item.src === src;
    });
    if (index < 0) index = 0;
    lightboxState.items = items;
    lightboxState.index = index;
    ensureLightbox();
    showLightboxAt(index);
    lightboxEl.classList.add('is-open');
    lightboxEl.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('is-open');
    lightboxEl.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function CircularGallery(root, options) {
    if (!root || !options || !options.items || !options.items.length) return null;
    this.root = root;
    this.items = options.items;
    this.lightboxItems = options.lightboxItems || options.items.map(function (item) {
      return { src: item.fullSrc || item.src, alt: item.alt || item.caption || '' };
    });
    this.onSelect = options.onSelect || function (src, alt, index) {
      openLightbox(src, alt, { items: this.lightboxItems, index: index });
    }.bind(this);
    this.rotation = 0;
    this.velocity = 0;
    this.dragging = false;
    this.lastX = 0;
    this.autoSpin = options.autoSpin !== false;
    this.activeIndex = 0;
    this.gap = typeof options.gap === 'number' ? options.gap : 24;
    this.cardWidth = options.cardWidth || 180;
    this.cardHeight = options.cardHeight || 135;
    this.variant = options.variant || '';
    this._build();
    this._bind();
    this._tick();
    return this;
  }

  CircularGallery.prototype._itemAngle = function () {
    return 360 / this.items.length;
  };

  CircularGallery.prototype._snapTo = function (index) {
    var count = this.items.length;
    var normalized = ((index % count) + count) % count;
    this.activeIndex = normalized;
    this.rotation = -normalized * this._itemAngle();
    this.velocity = 0;
    this._applyRotation();
    this._updateDots();
  };

  CircularGallery.prototype._nearestIndex = function () {
    var step = this._itemAngle();
    var raw = -this.rotation / step;
    var index = Math.round(raw);
    var count = this.items.length;
    return ((index % count) + count) % count;
  };

  CircularGallery.prototype._computeRadius = function () {
    var n = this.items.length;
    if (n <= 1) return 260;
    var cardSize = Math.max(this.cardWidth, this.cardHeight);
    var radius = (cardSize + this.gap) / (2 * Math.sin(Math.PI / n));
    return Math.max(230, Math.min(Math.round(radius), 680));
  };

  CircularGallery.prototype._build = function () {
    var self = this;
    this.root.classList.add('circular-gallery');
    if (this.variant) this.root.classList.add('circular-gallery--' + this.variant);
    this.root.innerHTML = '';

    this.stage = document.createElement('div');
    this.stage.className = 'circular-gallery__stage';
    this.ring = document.createElement('div');
    this.ring.className = 'circular-gallery__ring';
    this.ring.style.setProperty('--count', String(this.items.length));
    this.ring.style.setProperty('--ring-radius', this._computeRadius() + 'px');
    this.ring.style.setProperty('--card-half-w', (this.cardWidth / 2) + 'px');
    this.ring.style.setProperty('--card-half-h', (this.cardHeight / 2) + 'px');

    this.items.forEach(function (item, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'circular-gallery__item';
      btn.style.setProperty('--i', String(index));
      btn.setAttribute('aria-label', item.alt || 'تصویر');

      var frame = document.createElement('span');
      frame.className = 'circular-gallery__frame';
      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 400;
      img.height = 300;
      frame.appendChild(img);
      btn.appendChild(frame);

      btn.addEventListener('click', function () {
        if (self.dragMoved) return;
        var full = item.fullSrc || item.src;
        self.onSelect(full, item.alt || '', index);
      });

      self.ring.appendChild(btn);
    });

    this.stage.appendChild(this.ring);
    this.root.appendChild(this.stage);
    this._snapTo(0);
  };

  CircularGallery.prototype._updateDots = function () {};

  CircularGallery.prototype._applyRotation = function () {
    var self = this;
    this.ring.style.transform = 'rotateY(' + this.rotation + 'deg)';
    var step = this._itemAngle();
    var active = this._nearestIndex();
    if (active !== this.activeIndex) {
      this.activeIndex = active;
      this._updateDots();
    }
    var items = this.ring.querySelectorAll('.circular-gallery__item');
    items.forEach(function (el, index) {
      var angle = ((index * step + self.rotation) % 360 + 360) % 360;
      var delta = Math.min(angle, 360 - angle);
      var focus = Math.max(0.35, 1 - delta / 95);
      el.style.opacity = String(focus);
      el.style.zIndex = String(Math.round(focus * 100));
    });
  };

  CircularGallery.prototype._bind = function () {
    var self = this;
    this.dragMoved = false;

    function onDown(clientX) {
      self.dragging = true;
      self.dragMoved = false;
      self.lastX = clientX;
      self.velocity = 0;
    }

    function onMove(clientX) {
      if (!self.dragging) return;
      var dx = clientX - self.lastX;
      if (Math.abs(dx) > 4) self.dragMoved = true;
      self.rotation += dx * 0.4;
      self.velocity = dx * 0.12;
      self.lastX = clientX;
      self._applyRotation();
    }

    function onUp() {
      if (!self.dragging) return;
      self.dragging = false;
      if (self.dragMoved) self._snapTo(self._nearestIndex());
    }

    this.stage.addEventListener('pointerdown', function (e) {
      this.setPointerCapture(e.pointerId);
      onDown(e.clientX);
    });
    this.stage.addEventListener('pointermove', function (e) {
      if (!self.dragging) return;
      onMove(e.clientX);
    });
    this.stage.addEventListener('pointerup', onUp);
    this.stage.addEventListener('pointercancel', onUp);
  };

  CircularGallery.prototype._tick = function () {
    var self = this;
    if (!this.dragging && this.autoSpin) {
      this.rotation += 0.03 + this.velocity;
      this.velocity *= 0.94;
      this._applyRotation();
    }
    requestAnimationFrame(function () { self._tick(); });
  };

  global.ClinicCircularGallery = CircularGallery;
  global.openClinicLightbox = openLightbox;
})(window);
