/**
 * Inject local-hub SEO tags on static HTML pages.
 *
 * Usage (body):
 *   <div id="local-hub-root" data-city="tehran" data-service="hair-transplant"></div>
 *   <script src="/assets/js/local-hub-seo.js" defer></script>
 *
 * Or call directly:
 *   LocalHubSeo.inject('tehran', 'hair-transplant');
 */
(function (global) {
  'use strict';

  var API = '/api/seo/local-hub';

  function injectHeadHtml(html) {
    if (!html) return;
    var marker = '<!-- DYNAMIC_SEO_TAGS -->';
    if (document.head.innerHTML.indexOf(marker) !== -1) {
      document.head.innerHTML = document.head.innerHTML.replace(marker, html);
      return;
    }
    var tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    var nodes = tpl.content.childNodes;
    while (nodes.length) {
      document.head.appendChild(nodes[0]);
    }
  }

  function setRobots(content) {
    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', content);
  }

  function applyMeta(payload) {
    if (!payload) return;
    if (payload.redirectTo && typeof payload.redirectTo === 'string') {
      window.location.replace(payload.redirectTo);
      return;
    }
    if (payload.noindex) {
      setRobots('noindex, follow');
    }
    if (payload.headHtml) {
      injectHeadHtml(payload.headHtml);
      if (payload.noindex) setRobots('noindex, follow');
      return;
    }
    if (payload.title) document.title = payload.title;
    var desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement('meta');
      desc.setAttribute('name', 'description');
      document.head.appendChild(desc);
    }
    if (payload.description) desc.setAttribute('content', payload.description);
    var h1 = document.querySelector('[data-local-hub-h1]');
    if (h1 && payload.h1) h1.textContent = payload.h1;
  }

  function inject(city, service) {
    if (!city || !service) return Promise.resolve(null);
    return fetch(API + '/' + encodeURIComponent(city) + '/' + encodeURIComponent(service), {
      credentials: 'same-origin',
    })
      .then(function (res) {
        if (!res.ok) throw new Error('seo_fetch_failed');
        return res.json();
      })
      .then(function (payload) {
        applyMeta(payload);
        return payload;
      });
  }

  function autoInit() {
    var root = document.getElementById('local-hub-root')
      || document.querySelector('[data-city][data-service]');
    if (!root) return;
    inject(root.getAttribute('data-city'), root.getAttribute('data-service'));
  }

  global.LocalHubSeo = { inject: inject, applyMeta: applyMeta };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : global);
