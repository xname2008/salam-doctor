/* ============================================================
   Shared front-end behaviors for سلام دکتر
   Loaded on index.html, category.html and profile.html.
   Every behavior guards against missing elements, so the file
   is safe to include on any page.
   ============================================================ */

(function ensureClinicHelpers() {
  if (typeof clinicsForDisplay === 'function') return;
  var NAHAL_CLINIC_ID = 114;
  window.clinicHasRealImage = function (clinic) {
    var img = clinic && clinic.image ? String(clinic.image).trim() : '';
    return img.length > 0 && !/clinic-placeholder/i.test(img);
  };
  window.sortNahalFirst = function (clinics) {
    return clinics.slice().sort(function (a, b) {
      if (a.id === NAHAL_CLINIC_ID) return -1;
      if (b.id === NAHAL_CLINIC_ID) return 1;
      return 0;
    });
  };
  window.clinicsForDisplay = function (clinics) {
    return window.sortNahalFirst(clinics.filter(window.clinicHasRealImage));
  };
})();

/** Replace English digits 0-9 with Persian ۰-۹ across text nodes (skip script/style). */
window.applyPersianDigits = function applyPersianDigits(root) {
  var PERSIAN = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  var skip = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1 };
  var scope = root && root.nodeType === 1 ? root : document.body;
  if (!scope) return;

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 1) {
      var tag = node.tagName;
      if (skip[tag]) return;
      if (node.isContentEditable) return;
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        walk(child);
        child = next;
      }
      return;
    }
    if (node.nodeType !== 3) return;
    var text = node.nodeValue;
    if (!text || !/[0-9]/.test(text)) return;
    node.nodeValue = text.replace(/[0-9]/g, function (d) {
      return PERSIAN[Number(d)];
    });
  }

  walk(scope);
};

function ensureNavMenuLinks() {
  var EXTRA_LINKS = [
    { file: '/shiraz/pharmacy', label: 'داروخانه', afterFile: 'products.html' },
    { file: 'faq.html', label: 'سوالات متداول', afterFile: '/shiraz/pharmacy' },
  ];

  function hrefPrefix(container) {
    var sample = container && container.querySelector('a[href*="index.html"]');
    if (!sample) return '';
    return sample.getAttribute('href').indexOf('/') === 0 ? '/' : '';
  }

  function hasLink(container, file) {
    return !!(container && container.querySelector('a[href*="' + file + '"]'));
  }

  function findAnchor(container, file) {
    return container ? container.querySelector('a[href*="' + file + '"]') : null;
  }

  function insertAfter(anchor, href, label) {
    if (!anchor || !anchor.parentNode) return null;
    var link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    anchor.insertAdjacentElement('afterend', link);
    return link;
  }

  function linkHref(prefix, file) {
    if (String(file || '').charAt(0) === '/') return file;
    return (prefix || '') + file;
  }

  function patchContainer(container) {
    if (!container) return;
    var prefix = hrefPrefix(container);
    EXTRA_LINKS.forEach(function (item) {
      if (hasLink(container, item.file)) return;
      var anchor = findAnchor(container, item.afterFile);
      if (!anchor) return;
      insertAfter(anchor, linkHref(prefix, item.file), item.label);
    });
  }

  var drawerBody = document.querySelector('#mobile-drawer .drawer-body');
  patchContainer(drawerBody);

  var topMenu = document.querySelector('header .menu');
  if (topMenu) {
    var menuPrefix = hrefPrefix(topMenu) || (drawerBody ? hrefPrefix(drawerBody) : '');
    EXTRA_LINKS.forEach(function (item) {
      if (hasLink(topMenu, item.file)) return;
      var anchor = findAnchor(topMenu, item.afterFile);
      if (!anchor) return;
      insertAfter(anchor, linkHref(menuPrefix, item.file), item.label);
    });
  }
}

function applySiteSettings(settings) {
  if (!settings) return;
  var supportTel = settings.support_tel || 'tel:+989007000462';
  var supportDisplay = settings.support_phone_display || '۰۹۰۰۷۰۰۰۴۶۲';
  var salesTel = settings.sales_tel || supportTel;
  var salesDisplay = settings.sales_phone_display || supportDisplay;

  document.querySelectorAll('[data-site-phone="support"]').forEach(function (el) {
    if (el.tagName === 'A') el.setAttribute('href', supportTel);
    if (el.classList.contains('phone') || el.dataset.sitePhoneText === '1') {
      el.textContent = supportDisplay;
    } else if (/پشتیبانی|تماس|۰|0/.test(el.textContent || '')) {
      el.textContent = 'پشتیبانی سایت: ' + supportDisplay;
    }
  });

  document.querySelectorAll('[data-site-phone-label="support"]').forEach(function (el) {
    el.textContent = 'پشتیبانی سایت: ' + supportDisplay;
  });

  document.querySelectorAll('[data-site-phone="sales"]').forEach(function (el) {
    if (el.tagName === 'A') el.setAttribute('href', salesTel);
    if (el.dataset.sitePhoneText === '1' || el.classList.contains('phone')) {
      el.textContent = salesDisplay;
    } else {
      el.textContent = 'واحد فروش و رزرو جایگاه: ' + salesDisplay;
    }
  });

  document.querySelectorAll('[data-site-phone-label="sales"]').forEach(function (el) {
    el.textContent = 'واحد فروش و رزرو جایگاه: ' + salesDisplay;
  });
}

function loadSiteSettings() {
  return fetch('/api/site-settings')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (data) applySiteSettings(data);
      return data;
    })
    .catch(function () { return null; });
}

document.addEventListener('DOMContentLoaded', function () {
  ensureNavMenuLinks();
  loadSiteSettings();

  // Convert English digits → Persian after first paint / late dynamic injects
  if (typeof window.applyPersianDigits === 'function') {
    window.applyPersianDigits(document.body);
    window.setTimeout(function () {
      window.applyPersianDigits(document.body);
    }, 600);
  }

  // --- Mobile bottom nav: hide on scroll down, show on scroll up ---
  var mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) {
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      if (window.innerWidth > 760) return;
      var y = window.scrollY;
      var down = y > lastY && y > 80;
      mobileNav.classList.toggle('hide', down);
      lastY = y;
    });
  }

  // --- Chat widget open/close ---
  var chatWidget = document.getElementById('chat-widget');
  var chatToggle = document.getElementById('chat-toggle');
  var chatClose = document.getElementById('chat-close');
  if (chatWidget && chatToggle && chatClose) {
    var baleFloat = document.querySelector('.bale-float');
    var toggleChat = function (forceOpen) {
      var open = typeof forceOpen === 'boolean' ? forceOpen : !chatWidget.classList.contains('open');
      chatWidget.classList.toggle('open', open);
      chatWidget.setAttribute('aria-hidden', String(!open));
      if (baleFloat) baleFloat.style.opacity = open ? '0' : '1';
      if (baleFloat) baleFloat.style.pointerEvents = open ? 'none' : 'auto';
    };
    chatToggle.addEventListener('click', function () { toggleChat(); });
    chatClose.addEventListener('click', function () { toggleChat(false); });
  }

  // --- Mobile hamburger drawer ---
  (function initMobileDrawer(){
    var hamburger = document.getElementById('nav-hamburger');
    var drawer = document.getElementById('mobile-drawer');
    var overlay = document.getElementById('drawer-overlay');
    var closeBtn = document.getElementById('drawer-close');
    if (!hamburger || !drawer || !overlay) return;
    function openDrawer(){
      drawer.classList.add('is-open');
      overlay.hidden = false;
      requestAnimationFrame(function(){ overlay.classList.add('show'); });
      hamburger.classList.add('is-open');
      hamburger.setAttribute('aria-expanded','true');
      drawer.setAttribute('aria-hidden','false');
      document.documentElement.classList.add('drawer-locked');
      document.body.classList.add('drawer-locked');
    }
    function closeDrawer(){
      drawer.classList.remove('is-open');
      overlay.classList.remove('show');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded','false');
      drawer.setAttribute('aria-hidden','true');
      document.documentElement.classList.remove('drawer-locked');
      document.body.classList.remove('drawer-locked');
      setTimeout(function(){ overlay.hidden = true; }, 280);
    }
    function toggleDrawer(){
      if (drawer.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    }
    hamburger.addEventListener('click', toggleDrawer);
    overlay.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    // Close on Escape key
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });
    // Accordion submenus inside the drawer
    var accordions = drawer.querySelectorAll('.drawer-acc');
    accordions.forEach(function(acc){
      acc.addEventListener('click', function(){
        var sub = acc.nextElementSibling;
        var isOpen = acc.classList.contains('open');
        acc.classList.toggle('open', !isOpen);
        acc.setAttribute('aria-expanded', String(!isOpen));
        if (sub && sub.classList.contains('drawer-sub')) {
          sub.classList.toggle('open', !isOpen);
        }
      });
    });
    // Close drawer when any real link inside it is clicked
    drawer.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', function(){ closeDrawer(); });
    });
  })();

  // --- Rotating ad banner (pages with .ad-banner-wrap) ---
  // Supports desktopImageUrl + mobileImageUrl via <picture media="(max-width: 768px)">
  (function loadAdBanner() {
    function escapeAttr(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
    }

    function buildAdPictureHtml(ad, wrap) {
      var desktop =
        ad.desktopImageUrl || ad.image || '';
      var mobile =
        ad.mobileImageUrl || desktop;
      var alt = ad.title && String(ad.title).trim()
        ? String(ad.title).trim()
        : 'تبلیغ';
      if (!desktop) return '';

      var isHome =
        wrap &&
        (wrap.classList.contains('ad-banner-wrap--home') ||
          wrap.classList.contains('hero-ad-banner'));
      var isPortrait =
        wrap && wrap.classList.contains('ad-banner-wrap--portrait');
      var w = isPortrait ? '576' : '1024';
      var h = isPortrait ? '1024' : isHome ? '512' : '126';

      var sourceHtml = '';
      if (mobile && mobile !== desktop) {
        sourceHtml =
          '<source media="(max-width: 768px)" srcset="' +
          escapeAttr(mobile) +
          '">';
      }

      return (
        '<picture class="ad-banner-picture">' +
        sourceHtml +
        '<img class="ad-banner-img" src="' +
        escapeAttr(desktop) +
        '" alt="' +
        escapeAttr(alt) +
        '" loading="lazy" decoding="async" width="' +
        w +
        '" height="' +
        h +
        '">' +
        '</picture>'
      );
    }

    function currentClinicId() {
      try {
        var raw = new URLSearchParams(window.location.search).get('id');
        var id = parseInt(raw, 10);
        return Number.isFinite(id) ? id : null;
      } catch (err) {
        return null;
      }
    }

    function isClinicProfilePage() {
      return !!document.querySelector('.profile-page') ||
        /(?:^|\/)profile\.html$/i.test(window.location.pathname || '');
    }

    document.querySelectorAll('.ad-banner-wrap').forEach(function (wrap) {
      var slot = wrap.getAttribute('data-ad-slot') || 'global';
      var link = wrap.querySelector('.ad-banner-link');
      if (!link) return;

      if (isClinicProfilePage() || slot === 'profile') {
        if (currentClinicId() !== 114) {
          wrap.hidden = true;
          if (wrap.parentElement && wrap.parentElement.classList.contains('page-ad-rail')) {
            wrap.parentElement.hidden = true;
          }
          return;
        }
      }

      var fallbackImg = wrap.querySelector('.ad-banner-img');
      if (fallbackImg && fallbackImg.getAttribute('src')) {
        wrap.hidden = false;
        if (wrap.parentElement && wrap.parentElement.classList.contains('page-ad-rail')) {
          wrap.parentElement.hidden = false;
        }
      }

      fetch('/api/ads?slot=' + encodeURIComponent(slot))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (ad) {
          if (!ad || !ad.id) return;
          var desktop = ad.desktopImageUrl || ad.image;
          if (!desktop) return;

          link.innerHTML = buildAdPictureHtml(ad, wrap);
          var img = link.querySelector('.ad-banner-img');
          if (img) {
            img.onerror = function () {
              wrap.hidden = true;
            };
          }
          link.href = ad.link || '/';
          link.setAttribute('aria-label', ad.title || 'تبلیغات');
          link.addEventListener('click', function () {
            var trackUrl =
              '/api/ads/click?id=' + encodeURIComponent(ad.id);
            if (navigator.sendBeacon) {
              navigator.sendBeacon(trackUrl);
            } else {
              fetch(trackUrl, {
                method: 'GET',
                keepalive: true,
                credentials: 'same-origin',
              }).catch(function () {});
            }
          });
          wrap.hidden = false;
        })
        .catch(function () {
          /* leave hidden on error */
        });
    });
  })();

  // --- Live chat over Socket.IO ---
  // Quick-reply chips work offline; messages are sent when Socket.IO is available.
  (function initLiveChat() {
    var chatWidgetEl = document.getElementById('chat-widget');
    var chatMessagesEl = document.getElementById('chat-messages');
    var chatInputEl = document.getElementById('chat-input');
    var chatSendEl = document.getElementById('chat-send');
    var chatStatusEl = document.querySelector('#chat-widget .chat-status');
    if (!chatMessagesEl || !chatInputEl || !chatSendEl) return;

    var CHAT_QUICK_REPLIES = [
      {
        q: 'آیا مشاوره رایگان است؟',
        a: 'بله. مشاوره اولیه و معرفی مرکز در سلام دکتر کاملاً رایگان است. هزینه درمان در خود مرکز انتخاب‌شده مشخص می‌شود.'
      },
      {
        q: 'چطور مرکز مناسب معرفی می‌شود؟',
        a: 'پس از تماس یا ثبت درخواست، کارشناسان ما نوع خدمت، بودجه و موقعیت شما را بررسی می‌کنند و چند گزینه معتبر در شیراز پیشنهاد می‌دهند.'
      },
      {
        q: 'ویزیت در منزل دارید؟',
        a: 'بله. ویزیت پزشک، پرستاری، وصل سرم و برخی خدمات درمانی در منزل در شیراز قابل هماهنگی است. با ۰۹۰۰۷۰۰۰۴۶۲ تماس بگیرید.'
      },
      {
        q: 'فقط شیراز پوشش داده می‌شود؟',
        a: 'تمرکز اصلی ما معرفی مراکز در شیراز است. برای سایر شهرها می‌توانید راهنمایی کلی دریافت کنید.'
      },
      {
        q: 'چطور درخواست ثبت کنم؟',
        a: 'از طریق تماس با ۰۹۰۰۷۰۰۰۴۶۲، پیام در چت آنلاین، بله، یا فرم مشاوره در صفحه اصلی می‌توانید درخواست ثبت کنید.'
      },
      {
        q: 'محصول یا دارو چطور سفارش دهم؟',
        a: 'فعلاً سفارش محصولات زیبایی و داروخانه به‌صورت تلفنی یا از طریق بله ثبت می‌شود. خرید آنلاین به‌زودی فعال می‌شود.'
      }
    ];

    var quickRepliesEl = document.getElementById('chat-quick-replies');
    if (!quickRepliesEl && chatWidgetEl) {
      quickRepliesEl = document.createElement('div');
      quickRepliesEl.id = 'chat-quick-replies';
      quickRepliesEl.className = 'chat-quick-replies';
      quickRepliesEl.setAttribute('aria-label', 'سوالات پرتکرار');
      var chatInputWrap = chatWidgetEl.querySelector('.chat-input');
      if (chatInputWrap) chatWidgetEl.insertBefore(quickRepliesEl, chatInputWrap);
    }

    function appendChatBubble(text, role) {
      var bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (role === 'user' ? 'user' : 'operator');
      bubble.textContent = text;
      chatMessagesEl.appendChild(bubble);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    function setChatStatus(connected) {
      if (!chatStatusEl) return;
      chatStatusEl.style.background = connected ? '#22c55e' : '#ef4444';
    }

    function hideQuickReplies() {
      if (quickRepliesEl) quickRepliesEl.classList.add('is-hidden');
    }

    function renderQuickReplies() {
      if (!quickRepliesEl) return;
      quickRepliesEl.innerHTML = '';
      var label = document.createElement('span');
      label.className = 'chat-quick-label';
      label.textContent = 'سوالات پرتکرار:';
      quickRepliesEl.appendChild(label);
      CHAT_QUICK_REPLIES.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-quick-btn';
        btn.textContent = item.q;
        btn.addEventListener('click', function () {
          handleQuickReply(item);
        });
        quickRepliesEl.appendChild(btn);
      });
    }

    function emitChatMessage(text) {
      if (socket && socket.connected) {
        socket.emit('chat:message', { text: text });
      }
    }

    function handleQuickReply(item) {
      appendChatBubble(item.q, 'user');
      emitChatMessage(item.q);
      window.setTimeout(function () {
        appendChatBubble(item.a, 'operator');
      }, 350);
      hideQuickReplies();
    }

    function sendChatMessage() {
      var text = chatInputEl.value.trim();
      if (!text) return;
      emitChatMessage(text);
      appendChatBubble(text, 'user');
      chatInputEl.value = '';
      hideQuickReplies();
    }

    renderQuickReplies();

    if (typeof io !== 'function') {
      setChatStatus(false);
      chatSendEl.addEventListener('click', sendChatMessage);
      chatInputEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          sendChatMessage();
        }
      });
      return;
    }

    var socket = io();

    socket.on('connect', function () {
      setChatStatus(true);
    });

    socket.on('disconnect', function () {
      setChatStatus(false);
    });

    socket.on('chat:welcome', function (message) {
      if (message && message.text) appendChatBubble(message.text, 'operator');
    });

    socket.on('chat:reply', function (message) {
      if (message && message.text) appendChatBubble(message.text, 'operator');
    });

    chatSendEl.addEventListener('click', sendChatMessage);
    chatInputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
      }
    });
  })();

  // --- Consultation form submit (only on pages that have the form) ---
  (function () {
    var consultationForm = document.getElementById('consultation-form');
    if (!consultationForm) return;

    var phonePattern = /^09[0-9]{9}$/;
    var submitBtn = document.getElementById('form-submit');
    var messageEl = document.getElementById('form-message');
    var defaultBtnText = submitBtn ? submitBtn.textContent : 'ارسال';

    function showFormMessage(text, isSuccess) {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.style.display = 'block';
      messageEl.style.color = isSuccess ? '#15803d' : '#dc2626';
      messageEl.style.background = isSuccess ? '#f0fdf4' : '#fef2f2';
      messageEl.style.border = isSuccess ? '1px solid #bbf7d0' : '1px solid #fecaca';
      messageEl.style.borderRadius = '10px';
      messageEl.style.padding = '12px 14px';
      messageEl.style.marginTop = '10px';
    }

    function hideFormMessage() {
      if (!messageEl) return;
      messageEl.style.display = 'none';
      messageEl.textContent = '';
      messageEl.style.background = '';
      messageEl.style.border = '';
      messageEl.style.borderRadius = '';
      messageEl.style.padding = '';
      messageEl.style.marginTop = '';
    }

    function resetSubmitButton() {
      if (!submitBtn) return;
      submitBtn.disabled = false;
      submitBtn.textContent = defaultBtnText;
    }

    function toEnglishDigits(str) {
      return String(str)
        .replace(/[۰-۹]/g, function (ch) {
          return String(ch.charCodeAt(0) - 0x06f0);
        })
        .replace(/[٠-٩]/g, function (ch) {
          return String(ch.charCodeAt(0) - 0x0660);
        })
        .replace(/[\s\-]/g, '');
    }

    /** Accept 09…, +98…, 0098…, 98… and normalize to 09xxxxxxxxx */
    function normalizeIranMobile(raw) {
      var phone = toEnglishDigits(raw).replace(/[^\d+]/g, '');
      if (!phone) return '';
      if (phone.charAt(0) === '+') phone = phone.slice(1);
      if (phone.indexOf('0098') === 0) phone = phone.slice(4);
      else if (phone.indexOf('98') === 0 && phone.length >= 12) phone = phone.slice(2);
      if (phone.charAt(0) === '9' && phone.length === 10) phone = '0' + phone;
      return phone;
    }

    var phoneInput = document.getElementById('form-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', function (e) {
        var normalized = toEnglishDigits(e.target.value);
        if (e.target.value !== normalized) {
          e.target.value = normalized;
        }
      });
      phoneInput.addEventListener('blur', function (e) {
        var normalized = normalizeIranMobile(e.target.value);
        if (normalized && /^09[0-9]{9}$/.test(normalized)) {
          e.target.value = normalized;
        }
      });
    }

    consultationForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = document.getElementById('form-name').value.trim();
      var phone = normalizeIranMobile(document.getElementById('form-phone').value.trim());
      var service = document.getElementById('form-service').value;
      var desc = document.getElementById('form-desc').value.trim();

      if (!name) {
        showFormMessage('لطفاً نام خود را وارد کنید.', false);
        return;
      }

      if (!phone) {
        showFormMessage('لطفاً شماره موبایل را وارد کنید.', false);
        return;
      }

      if (!phonePattern.test(phone)) {
        showFormMessage('شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹ یا +989123456789', false);
        return;
      }

      if (phoneInput) phoneInput.value = phone;

      if (!service) {
        showFormMessage('لطفاً نوع خدمت را انتخاب کنید.', false);
        return;
      }

      hideFormMessage();
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ در حال ثبت درخواست...';

      fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          phone: phone,
          service: service,
          desc: desc
        })
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('bad_status');
          }
          return response.json().catch(function () {
            return {};
          });
        })
        .then(function () {
          showFormMessage('✅ درخواست شما ثبت شد! معمولاً ظرف ۳۰ دقیقه با شما تماس می‌گیریم.', true);
          if (messageEl) messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          consultationForm.reset();
        })
        .catch(function () {
          showFormMessage('خطا در ارسال اطلاعات. لطفاً مجدداً تلاش کنید.', false);
        })
        .finally(function () {
          resetSubmitButton();
        });
    });
  })();

  // --- Related clinics on SEO landing pages ---
  // Renders clinic cards from clinicsData into #related-clinics, filtered by
  // the comma-separated keywords in its data-keywords attribute. Guards against
  // a missing element or missing data, so it is safe on any page.
  (function initRelatedClinics() {
    var holder = document.getElementById('related-clinics');
    if (!holder || typeof clinicsData === 'undefined' || !Array.isArray(clinicsData)) return;

    var keywords = (holder.getAttribute('data-keywords') || '')
      .split(',')
      .map(function (k) { return k.trim(); })
      .filter(Boolean);
    var limit = parseInt(holder.getAttribute('data-limit'), 10) || 6;

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function matches(clinic) {
      if (!keywords.length) return true;
      if (!Array.isArray(clinic.services)) return false;
      return clinic.services.some(function (service) {
        var text = '';
        if (typeof service === 'string') text = service.trim();
        else if (service && typeof service === 'object') {
          text = String(service.label || service.name || service.slug || '').trim();
        }
        if (!text || text === 'دارد') return false;
        return keywords.some(function (kw) { return text.indexOf(kw) !== -1; });
      });
    }

    var filtered = typeof clinicsForDisplay === 'function'
      ? clinicsForDisplay(clinicsData.filter(matches))
      : clinicsData.filter(matches).slice(0, limit);
    if (limit > 0) filtered = filtered.slice(0, limit);
    if (!filtered.length) {
      holder.innerHTML = '<p style="color:var(--muted)">به‌زودی مراکز این بخش اضافه می‌شوند.</p>';
      return;
    }

    holder.innerHTML = filtered.map(function (clinic) {
      var name = escapeHtml((clinic.sliderTitle || clinic.name || '').trim());
      var tag = escapeHtml((clinic.sliderTagline || 'مرکز درمانی و زیبایی').trim());
      var image = escapeHtml(clinic.image || 'images/sample-clinic-services.webp');
      var profileUrl = (typeof window.clinicProfilePath === 'function')
        ? window.clinicProfilePath(clinic)
        : ('/doctor/clinic-' + encodeURIComponent(clinic.id));
      return [
        '<article class="landing-clinic-card">',
        '  <img src="' + image + '" alt="عکس کلینیک ' + name + ' در شیراز" width="400" height="300" loading="lazy" decoding="async">',
        '  <div class="lc-body">',
        '    <span class="lc-name">' + name + '</span>',
        '    <span class="lc-tag">' + tag + '</span>',
        '    <a class="btn btn-main" href="' + profileUrl + '">مشاهده مرکز</a>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  })();

  // --- Table of Contents / jump-links helper ---
  // If an anchor link (ToC or otherwise) points at, or into, a collapsed
  // <details> element, open it so the target content is actually visible.
  (function initTocDetailsExpand() {
    function openDetailsFor(hash) {
      if (!hash || hash.length < 2) return;
      var id = decodeURIComponent(hash.slice(1));
      var el = document.getElementById(id);
      if (!el) return;
      var details = el.tagName === 'DETAILS' ? el : el.closest('details');
      if (details && !details.open) details.open = true;
    }

    if (window.location.hash) openDetailsFor(window.location.hash);

    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('.toc-list a[href^="#"]') : null;
      if (!link) return;
      openDetailsFor(link.getAttribute('href'));
    });

    window.addEventListener('hashchange', function () {
      openDetailsFor(window.location.hash);
    });
  })();
});
