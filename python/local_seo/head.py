"""Build <head> fragment with dynamic meta + JSON-LD injection."""

from __future__ import annotations

import html

from .jsonld import build_hub_json_ld, json_ld_script_tags
from .meta import HubMeta, build_hub_meta
from .registry import CityInfo, SpecialtyInfo


def _esc(value: str) -> str:
    return html.escape(value or "", quote=True)


def build_head_fragment(
    city: CityInfo,
    specialty: SpecialtyInfo,
    *,
    site_base: str,
    canonical_path: str,
    meta: HubMeta | None = None,
    og_image: str | None = None,
) -> str:
    meta = meta or build_hub_meta(city, specialty)
    canonical = site_base.rstrip("/") + canonical_path
    image = og_image or f"{site_base.rstrip('/')}/images/hero-collage.png"

    schemas = build_hub_json_ld(
        city,
        specialty,
        site_base=site_base,
        canonical_path=canonical_path,
        description=meta.description,
        h1=meta.h1,
    )

    lines = [
        f"  <title>{_esc(meta.title)}</title>",
        f'  <meta name="description" content="{_esc(meta.description)}">',
        f'  <link rel="canonical" href="{_esc(canonical)}">',
        f'  <meta name="robots" content="index, follow, max-image-preview:large">',
        f'  <meta property="og:type" content="website">',
        f'  <meta property="og:locale" content="fa_IR">',
        f'  <meta property="og:site_name" content="سلام دکتر">',
        f'  <meta property="og:title" content="{_esc(meta.og_title)}">',
        f'  <meta property="og:description" content="{_esc(meta.og_description)}">',
        f'  <meta property="og:url" content="{_esc(canonical)}">',
        f'  <meta property="og:image" content="{_esc(image)}">',
        f'  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{_esc(meta.og_title)}">',
        f'  <meta name="twitter:description" content="{_esc(meta.og_description)}">',
        f'  <meta name="twitter:image" content="{_esc(image)}">',
    ]
    for tag in json_ld_script_tags(schemas).splitlines():
        lines.append("  " + tag)
    return "\n".join(lines)
