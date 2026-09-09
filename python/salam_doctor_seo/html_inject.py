"""Inject JSON-LD and SEO meta tags into HTML <head>."""

from __future__ import annotations

import html
import re
from typing import Any

from .jsonld import (
    JsonLdBuilder,
    default_clinic_profile_faqs,
    faq_accordion_html,
)
from .local_copy import format_local_booking_headline, local_booking_description
from .models import ClinicRecord

_PLACEHOLDER = "<!-- DYNAMIC_SEO_TAGS -->"
_H1_PLACEHOLDER_RE = re.compile(r"<!--\s*DYNAMIC_PROFILE_H1\s*-->")
_FAQ_PLACEHOLDER_RE = re.compile(r"<!--\s*DYNAMIC_PROFILE_FAQS\s*-->")
_HEAD_CLOSE_RE = re.compile(r"</head>", re.IGNORECASE)


class HtmlInjector:
    """
    Replace <!-- DYNAMIC_SEO_TAGS --> or append before </head>.

  Mirrors the Node `injectHeadSeo` contract used in profile.html.
    """

    def __init__(self, jsonld: JsonLdBuilder | None = None) -> None:
        self.jsonld = jsonld or JsonLdBuilder()

    @staticmethod
    def _esc(value: str) -> str:
        return html.escape(value or "", quote=True)

    def build_head_fragment(
        self,
        clinic: ClinicRecord,
        *,
        title: str | None = None,
        description: str | None = None,
        canonical: str | None = None,
        og_image: str | None = None,
        extra_schemas: list[dict[str, Any]] | None = None,
    ) -> str:
        cfg = self.jsonld.config
        city = clinic.city or cfg.address_locality
        neighborhood = clinic.neighborhood or ""
        headline = format_local_booking_headline(
            clinic.display_specialty or clinic.name,
            city,
            neighborhood,
        )
        page_title = title or headline
        page_desc = description or local_booking_description(headline, city, neighborhood)
        canon = canonical or cfg.absolute_url(
            clinic.url_path or cfg.clinic_profile_path(clinic.id)
        )
        image = cfg.absolute_image(og_image or clinic.image)

        schemas = self.jsonld.profile_graph(clinic)
        if extra_schemas:
            schemas.extend(extra_schemas)

        lines = [
            f"  <title>{self._esc(page_title)}</title>",
            f'  <meta name="description" content="{self._esc(page_desc)}">',
            f'  <link rel="canonical" href="{self._esc(canon)}">',
            f'  <meta property="og:type" content="website">',
            f'  <meta property="og:site_name" content="{self._esc(cfg.site_name_fa)}">',
            f'  <meta property="og:title" content="{self._esc(page_title)}">',
            f'  <meta property="og:description" content="{self._esc(page_desc)}">',
            f'  <meta property="og:url" content="{self._esc(canon)}">',
            f'  <meta property="og:image" content="{self._esc(image)}">',
            f'  <meta name="twitter:card" content="summary_large_image">',
            f'  <meta name="twitter:title" content="{self._esc(page_title)}">',
            f'  <meta name="twitter:description" content="{self._esc(page_desc)}">',
            f'  <meta name="twitter:image" content="{self._esc(image)}">',
        ]
        for schema in schemas:
            lines.append("  " + self.jsonld.to_script_tag(schema))
        return "\n".join(lines)

    def inject(self, html_doc: str, clinic: ClinicRecord, **kwargs: Any) -> str:
        fragment = self.build_head_fragment(clinic, **kwargs)
        cfg = self.jsonld.config
        headline = format_local_booking_headline(
            clinic.display_specialty or clinic.name,
            clinic.city or cfg.address_locality,
            clinic.neighborhood,
        )
        html_doc = _H1_PLACEHOLDER_RE.sub(html.escape(headline), html_doc, count=1)
        raw_faqs = clinic.extra.get("faqs") if clinic.extra else None
        faqs = list(raw_faqs) if raw_faqs else default_clinic_profile_faqs(
            clinic.name,
            clinic.city or cfg.address_locality,
            clinic.display_specialty,
        )
        html_doc = _FAQ_PLACEHOLDER_RE.sub(faq_accordion_html(faqs, id_prefix="profile-faq"), html_doc, count=1)
        if _PLACEHOLDER in html_doc:
            return html_doc.replace(_PLACEHOLDER, fragment, 1)
        if _HEAD_CLOSE_RE.search(html_doc):
            return _HEAD_CLOSE_RE.sub(fragment + "\n</head>", html_doc, count=1)
        return fragment + "\n" + html_doc
