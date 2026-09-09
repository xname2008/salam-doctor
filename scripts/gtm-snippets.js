'use strict';

/**
 * Canonical Google Tag Manager snippets for salam-doctor static HTML pages.
 * Container: GTM-NL3KJ8ZQ
 *
 * Usage:
 *   const { GTM_ID, GTM_HEAD_HTML, GTM_BODY_HTML } = require('./gtm-snippets');
 */

const GTM_ID = process.env.GTM_CONTAINER_ID || 'GTM-NL3KJ8ZQ';

const GTM_HEAD_HTML = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');</script>
<!-- End Google Tag Manager -->`;

const GTM_BODY_HTML = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

const GTM_HEAD_MARKER = '<!-- Google Tag Manager -->';
const GTM_BODY_MARKER = '<!-- Google Tag Manager (noscript) -->';

module.exports = {
  GTM_ID,
  GTM_HEAD_HTML,
  GTM_BODY_HTML,
  GTM_HEAD_MARKER,
  GTM_BODY_MARKER,
};
