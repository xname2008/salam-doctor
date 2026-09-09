/**
 * Click-to-play hero video — defers video load until user interaction (LCP/SEO).
 * Usage: [data-hero-click-play] with [data-hero-play-trigger] and [data-hero-video-mount]
 */
(function () {
  'use strict';

  var DEFAULT_SRC = 'assets/video/intro.mp4';

  function createVideo(src) {
    var video = document.createElement('video');
    video.className = 'absolute inset-0 h-full w-full object-cover';
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('preload', 'metadata');
    video.src = src;
    return video;
  }

  function initHeroClickPlay(root) {
    if (!root || root.getAttribute('data-hero-initialized') === 'true') return;

    var trigger = root.querySelector('[data-hero-play-trigger]');
    var mount = root.querySelector('[data-hero-video-mount]');
    if (!trigger || !mount) return;

    var src = root.getAttribute('data-video-src') || DEFAULT_SRC;

    function playVideo() {
      if (root.getAttribute('data-playing') === 'true') return;
      root.setAttribute('data-playing', 'true');

      trigger.classList.add('is-hiding');
      window.setTimeout(function () {
        trigger.setAttribute('hidden', '');
        trigger.setAttribute('aria-hidden', 'true');

        var video = createVideo(src);
        mount.innerHTML = '';
        mount.appendChild(video);
        mount.classList.remove('hidden');
        mount.classList.add('is-visible');
        mount.setAttribute('aria-hidden', 'false');

        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {
            /* controls remain usable if autoplay blocked */
          });
        }
      }, 380);
    }

    trigger.addEventListener('click', playVideo);
    trigger.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        playVideo();
      }
    });

    root.setAttribute('data-hero-initialized', 'true');
  }

  function initAll() {
    var nodes = document.querySelectorAll('[data-hero-click-play]');
    for (var i = 0; i < nodes.length; i++) initHeroClickPlay(nodes[i]);
  }

  window.HeroClickPlay = { init: initHeroClickPlay, initAll: initAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
