"""JSON-LD LocalBusiness + MedicalClinic for city/specialty hub pages."""

from __future__ import annotations

import json
from typing import Any

from .registry import CityInfo, SpecialtyInfo


def _postal_address(city: CityInfo) -> dict[str, Any]:
    return {
        "@type": "PostalAddress",
        "addressLocality": city.name_fa,
        "addressRegion": city.region_fa,
        "addressCountry": city.country,
    }


def _geo(city: CityInfo) -> dict[str, Any]:
    return {
        "@type": "GeoCoordinates",
        "latitude": city.latitude,
        "longitude": city.longitude,
    }


def local_business_schema(
    city: CityInfo,
    specialty: SpecialtyInfo,
    *,
    site_base: str,
    canonical_path: str,
    description: str | None = None,
) -> dict[str, Any]:
    url = site_base.rstrip("/") + canonical_path
    return {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": url + "#localbusiness",
        "name": f"سلام دکتر — {specialty.name_fa} {city.name_fa}",
        "description": description
        or f"دایرکتوری تخصصی مراکز {specialty.name_fa} در {city.name_fa} — پلتفرم سلام دکتر",
        "url": url,
        "image": f"{site_base.rstrip('/')}/images/hero-collage.png",
        "address": _postal_address(city),
        "geo": _geo(city),
        "areaServed": {
            "@type": "City",
            "name": city.name_fa,
            "geo": _geo(city),
        },
        "knowsAbout": specialty.name_fa,
        "inLanguage": "fa-IR",
    }


def medical_clinic_hub_schema(
    city: CityInfo,
    specialty: SpecialtyInfo,
    *,
    site_base: str,
    canonical_path: str,
    description: str | None = None,
) -> dict[str, Any]:
    """MedicalClinic schema for the hub (directory of clinics in city+specialty)."""
    url = site_base.rstrip("/") + canonical_path
    return {
        "@context": "https://schema.org",
        "@type": "MedicalClinic",
        "@id": url + "#medicalclinic",
        "name": f"مراکز {specialty.name_fa} در {city.name_fa}",
        "medicalSpecialty": specialty.name_fa,
        "description": description
        or f"فهرست کلینیک‌ها و مراکز درمانی {specialty.name_fa} در شهر {city.name_fa}",
        "url": url,
        "address": _postal_address(city),
        "geo": _geo(city),
        "areaServed": {
            "@type": "AdministrativeArea",
            "name": f"{city.name_fa}، {city.region_fa}",
            "geo": _geo(city),
        },
    }


def breadcrumb_schema(
    city: CityInfo,
    specialty: SpecialtyInfo,
    *,
    site_base: str,
    canonical_path: str,
    h1: str,
) -> dict[str, Any]:
    base = site_base.rstrip("/")
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "خانه", "item": base + "/"},
            {
                "@type": "ListItem",
                "position": 2,
                "name": city.name_fa,
                "item": base + f"/{city.slug}",
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": specialty.name_fa,
                "item": base + canonical_path,
            },
        ],
    }


def build_hub_json_ld(
    city: CityInfo,
    specialty: SpecialtyInfo,
    *,
    site_base: str,
    canonical_path: str,
    description: str | None = None,
    h1: str = "",
) -> list[dict[str, Any]]:
    return [
        local_business_schema(
            city, specialty, site_base=site_base, canonical_path=canonical_path, description=description
        ),
        medical_clinic_hub_schema(
            city, specialty, site_base=site_base, canonical_path=canonical_path, description=description
        ),
        breadcrumb_schema(
            city, specialty, site_base=site_base, canonical_path=canonical_path, h1=h1
        ),
    ]


def json_ld_script_tags(schemas: list[dict[str, Any]]) -> str:
    return "\n".join(
        f'<script type="application/ld+json">{json.dumps(s, ensure_ascii=False, separators=(",", ":"))}</script>'
        for s in schemas
    )
