import { useCallback, useEffect, useRef, useState } from 'react';
import './ImageGallery.css';

const SWIPE_THRESHOLD = 40;

/**
 * RTL-friendly gallery: native horizontal scroll + snap.
 * Stage uses direction:rtl so swipe matches Persian reading order.
 */
export default function ImageGallery({
  items = [],
  altPrefix = 'Gallery image',
  className = '',
}) {
  const safeItems = Array.isArray(items)
    ? items.filter((item) => item && item.imageUrl)
    : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef(null);
  const indexRef = useRef(0);
  const scrollSyncRef = useRef(false);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startScroll: 0,
    moved: false,
  });

  useEffect(() => {
    if (!safeItems.length) return;
    setActiveIndex((prev) => {
      const next = Math.min(prev, safeItems.length - 1);
      indexRef.current = next;
      return next;
    });
  }, [safeItems.length]);

  const goTo = useCallback((nextIndex, smooth) => {
    if (!safeItems.length) return;
    const clamped = Math.max(0, Math.min(safeItems.length - 1, nextIndex));
    indexRef.current = clamped;
    setActiveIndex(clamped);

    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth || 1;
    scrollSyncRef.current = true;

    // With direction:rtl, browsers differ on scrollLeft sign — use scrollTo on the slide.
    const slide = track.children[clamped];
    if (slide && typeof slide.scrollIntoView === 'function') {
      slide.scrollIntoView({
        behavior: smooth === false ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    } else {
      track.scrollTo({
        left: clamped * width,
        behavior: smooth === false ? 'auto' : 'smooth',
      });
    }

    window.setTimeout(function () {
      scrollSyncRef.current = false;
    }, smooth === false ? 0 : 340);
  }, [safeItems.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || safeItems.length <= 1) return undefined;

    function readScrollIndex() {
      const width = track.clientWidth || 1;
      const raw = track.scrollLeft;
      // Chrome RTL often uses negative scrollLeft
      const pos = Math.abs(raw);
      return Math.max(
        0,
        Math.min(safeItems.length - 1, Math.round(pos / width))
      );
    }

    function syncIndexFromScroll() {
      if (scrollSyncRef.current) return;
      const next = readScrollIndex();
      if (next !== indexRef.current) {
        indexRef.current = next;
        setActiveIndex(next);
      }
    }

    function onPointerDown(e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: track.scrollLeft,
        moved: false,
      };
      try {
        track.setPointerCapture(e.pointerId);
      } catch (_err) {}
    }

    function onPointerMove(e) {
      if (e.pointerType !== 'mouse') return;
      const state = dragRef.current;
      if (!state.active || e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.startX;
      if (Math.abs(dx) > 4) state.moved = true;
      e.preventDefault();
      // RTL: dragging right should feel like going toward previous (index - 1)
      track.scrollLeft = state.startScroll + dx;
    }

    function endPointerDrag(e) {
      if (e.pointerType !== 'mouse') return;
      const state = dragRef.current;
      if (!state.active || e.pointerId !== state.pointerId) return;
      state.active = false;
      state.pointerId = null;
      try {
        track.releasePointerCapture(e.pointerId);
      } catch (_err) {}

      const dx = e.clientX - state.startX;
      if (!state.moved || Math.abs(dx) < SWIPE_THRESHOLD) {
        syncIndexFromScroll();
        return;
      }
      // Finger moved right → show previous in RTL carousel
      if (dx > 0) goTo(indexRef.current - 1);
      else goTo(indexRef.current + 1);
    }

    track.addEventListener('scroll', syncIndexFromScroll, { passive: true });
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove, { passive: false });
    track.addEventListener('pointerup', endPointerDrag);
    track.addEventListener('pointercancel', endPointerDrag);

    return () => {
      track.removeEventListener('scroll', syncIndexFromScroll);
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', endPointerDrag);
      track.removeEventListener('pointercancel', endPointerDrag);
    };
  }, [safeItems.length, goTo]);

  if (!safeItems.length) {
    return null;
  }

  const clampedIndex = Math.min(activeIndex, safeItems.length - 1);
  const canSwipe = safeItems.length > 1;

  return (
    <div className={`image-gallery ${className}`.trim()} dir="rtl">
      <div
        className="image-gallery__stage"
        role="region"
        aria-roledescription="carousel"
        aria-label={altPrefix}
      >
        <div
          ref={trackRef}
          className="image-gallery__track"
        >
          {safeItems.map((item, index) => (
            <div className="image-gallery__slide" key={item.id}>
              <img
                className="image-gallery__hero"
                src={item.imageUrl}
                alt={`${altPrefix} ${index + 1}`}
                width={1280}
                height={720}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable="false"
              />
            </div>
          ))}
        </div>

        {canSwipe ? (
          <>
            <button
              type="button"
              className="image-gallery__nav image-gallery__nav--prev"
              aria-label="تصویر قبلی"
              disabled={clampedIndex <= 0}
              onClick={() => goTo(clampedIndex - 1)}
            >
              ›
            </button>
            <button
              type="button"
              className="image-gallery__nav image-gallery__nav--next"
              aria-label="تصویر بعدی"
              disabled={clampedIndex >= safeItems.length - 1}
              onClick={() => goTo(clampedIndex + 1)}
            >
              ‹
            </button>
          </>
        ) : null}
      </div>

      <div className="image-gallery__thumbs" role="list">
        {safeItems.map((item, index) => {
          const isActive = index === clampedIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={`image-gallery__thumb${isActive ? ' is-active' : ''}`}
              aria-label={`نمایش تصویر ${index + 1}`}
              aria-pressed={isActive}
              onClick={() => goTo(index)}
            >
              <img
                src={item.imageUrl}
                alt={`${altPrefix} ${index + 1}`}
                width={160}
                height={160}
                loading="lazy"
                decoding="async"
                draggable="false"
              />
            </button>
          );
        })}
      </div>

      <div className="image-gallery__dots" aria-hidden="true">
        {safeItems.map((item, index) => (
          <span
            key={`dot-${item.id}`}
            className={`image-gallery__dot${index === clampedIndex ? ' is-active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
