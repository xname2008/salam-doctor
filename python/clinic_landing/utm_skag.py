"""SKAG (Single Keyword Ad Group) copy resolution from UTM / query params."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import parse_qs, unquote_plus

# EDIT: map ad keywords / devices / services → headline + CTA (Persian)
DEFAULT_SKAG_PRESETS: dict[str, dict[str, str]] = {
    "candela": {
        "h1": "لیزر کندلا تیتانیوم در {city} — {clinic}",
        "cta_primary": "رزرو فوری لیزر کندلا",
        "cta_secondary": "مشاوره رایگان کندلا",
    },
    "hair-transplant": {
        "h1": "کاشت مو {technique} در {city} — {clinic}",
        "cta_primary": "رزرو مشاوره کاشت مو",
        "cta_secondary": "برآورد هزینه کاشت مو",
    },
    "botox": {
        "h1": "تزریق بوتاکس تخصصی در {city} — {clinic}",
        "cta_primary": "رزرو نوبت بوتاکس",
        "cta_secondary": "مشاهده تعرفه بوتاکس",
    },
    "fotona": {
        "h1": "لیزر فوتونا در {city} — {clinic}",
        "cta_primary": "رزرو لیزر فوتونا",
        "cta_secondary": "مشاوره قبل از درمان",
    },
    "hifu": {
        "h1": "هایفوتراپی دابلو گلد در {city} — {clinic}",
        "cta_primary": "رزرو جلسه هایفو",
        "cta_secondary": "مقایسه پکیج‌ها",
    },
}

_PARAM_KEYS = (
    "utm_term",
    "utm_content",
    "utm_campaign",
    "service",
    "device",
    "keyword",
    "skag",
)


def _slugify(value: str) -> str:
    v = value.strip().lower()
    v = re.sub(r"[^\w\u0600-\u06FF]+", "-", v, flags=re.UNICODE)
    return v.strip("-")[:80]


def _first_param(params: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        raw = params.get(key)
        if raw is None:
            continue
        if isinstance(raw, (list, tuple)):
            raw = raw[0] if raw else None
        if raw is None:
            continue
        text = unquote_plus(str(raw)).strip()
        if text:
            return text
    return None


@dataclass(frozen=True)
class SkagCopy:
    """Resolved headline and CTA labels for a landing visit."""

    keyword: str | None
    preset_key: str | None
    h1: str
    cta_primary: str
    cta_secondary: str
    technique: str | None = None
    device: str | None = None


def resolve_skag_copy(
    params: Mapping[str, Any],
    *,
    clinic_name: str,
    city: str = "شیراز",
    default_h1: str | None = None,
    default_cta_primary: str = "رزرو فوری نوبت",
    default_cta_secondary: str = "مشاوره رایگان",
    presets: dict[str, dict[str, str]] | None = None,
) -> SkagCopy:
    """
    Resolve H1 / CTA from UTM params.

    Priority: skag > utm_term > keyword > device > service slug > utm_content.
    """
    presets = presets or DEFAULT_SKAG_PRESETS
    keyword = _first_param(params, *_PARAM_KEYS)
    preset_key = _slugify(keyword) if keyword else None

    # Try exact preset, then partial match on slug keys
    preset = presets.get(preset_key or "", {})
    if not preset and preset_key:
        for k, v in presets.items():
            if k in preset_key or preset_key in k:
                preset = v
                preset_key = k
                break

    fmt = {
        "clinic": clinic_name,
        "city": city,
        "keyword": keyword or clinic_name,
        "technique": _first_param(params, "technique") or "FIT",
        "device": _first_param(params, "device") or keyword or "",
    }

    if preset:
        h1 = preset.get("h1", "").format(**fmt)
        cta_primary = preset.get("cta_primary", default_cta_primary).format(**fmt)
        cta_secondary = preset.get("cta_secondary", default_cta_secondary).format(**fmt)
    else:
        if keyword:
            h1 = f"{keyword} در {city} — {clinic_name}"
            cta_primary = f"رزرو فوری {keyword}"
        else:
            h1 = default_h1 or f"کلینیک {clinic_name} — {city}"
            cta_primary = default_cta_primary
        cta_secondary = default_cta_secondary

    return SkagCopy(
        keyword=keyword,
        preset_key=preset_key,
        h1=h1,
        cta_primary=cta_primary,
        cta_secondary=cta_secondary,
        technique=fmt.get("technique"),
        device=fmt.get("device") or None,
    )


def parse_skag_from_request(query_string: str, **kwargs: Any) -> SkagCopy:
    """Parse query string (e.g. '?utm_term=candela') into SkagCopy."""
    params = parse_qs(query_string.lstrip("?"))
    flat = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
    return resolve_skag_copy(flat, **kwargs)
