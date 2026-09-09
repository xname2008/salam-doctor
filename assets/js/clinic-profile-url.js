(function (root) {
  /**
   * Build canonical /doctor/:slug profile URLs.
   * Never returns legacy /profile.html?id= links (those 301 — avoid in hrefs).
   */
  function slugFromId(id) {
    if (id == null || id === '') return null;
    var map = root.CLINIC_SLUGS || {};
    var key = String(id);
    if (map[key]) return String(map[key]);
    var n = Number(id);
    if (Number.isFinite(n) && n > 0) return 'clinic-' + n;
    return null;
  }

  function rewriteLegacyProfileLink(link) {
    if (!link) return null;
    var s = String(link).trim();
    if (!s) return null;
    s = s.replace(/^https?:\/\/[^/]+/i, '');
    var m = s.match(/profile\.html\?(?:[^#]*&)?(?:id|clinic_id)=(\d+)/i);
    if (!m) m = s.match(/profiles\.html\?(?:[^#]*&)?(?:id|clinic_id)=(\d+)/i);
    if (m) {
      var slug = slugFromId(m[1]);
      return slug ? '/doctor/' + slug : null;
    }
    return null;
  }

  function ensureDoctorPath(path) {
    if (!path) return '/';
    var s = String(path).trim();
    if (!s) return '/';
    var legacy = rewriteLegacyProfileLink(s);
    if (legacy) return legacy;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf('/doctor/') !== -1) {
      if (s.charAt(0) !== '/') s = '/' + s.replace(/^\/+/, '');
      return s;
    }
    if (/^doctor\//i.test(s)) return '/' + s;
    return s.charAt(0) === '/' ? s : '/' + s;
  }

  function clinicProfilePath(clinic) {
    if (!clinic) return '/';

    if (typeof clinic === 'string' || typeof clinic === 'number') {
      var asLink = rewriteLegacyProfileLink(clinic);
      if (asLink) return asLink;
      var fromMap = slugFromId(clinic);
      if (fromMap) return '/doctor/' + encodeURIComponent(fromMap);
      return '/';
    }

    if (clinic.slug) {
      return '/doctor/' + encodeURIComponent(String(clinic.slug).trim());
    }

    var id = clinic.id != null ? clinic.id : clinic.clinic_id;
    var mapped = slugFromId(id);
    if (mapped) return '/doctor/' + encodeURIComponent(mapped);

    if (clinic.link) {
      return ensureDoctorPath(clinic.link);
    }

    return '/';
  }

  root.clinicProfilePath = clinicProfilePath;
  root.rewriteLegacyProfileLink = rewriteLegacyProfileLink;
})(typeof window !== 'undefined' ? window : this);
