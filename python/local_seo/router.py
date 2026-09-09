"""URL parsing and route matching for /{city}/{specialty} local hubs."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .registry import CityInfo, SpecialtyInfo, get_city, get_specialty

# /tehran/hair-transplant  |  /shiraz/botox/
_LOCAL_PATH_RE = re.compile(
    r"^/(?P<city>[a-z0-9]+(?:-[a-z0-9]+)*)/(?P<specialty>[a-z0-9]+(?:-[a-z0-9]+)*)/?$",
    re.IGNORECASE,
)

# Legacy Node namespace: /shiraz/:slug (city fixed in first segment)
_LEGACY_SHIRAZ_RE = re.compile(
    r"^/shiraz/(?P<specialty>[a-z0-9]+(?:-[a-z0-9]+)*)/?$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class LocalHubPage:
    """Resolved local SEO hub page."""

    city: CityInfo
    specialty: SpecialtyInfo
    path: str
    canonical_path: str
    legacy_shiraz: bool = False

    @property
    def city_slug(self) -> str:
        return self.city.slug

    @property
    def specialty_slug(self) -> str:
        return self.specialty.slug


def parse_local_path(path: str) -> tuple[str, str] | None:
    """Return (city_slug, specialty_slug) or None."""
    raw = (path or "").split("?", 1)[0].strip()
    if not raw.startswith("/"):
        raw = "/" + raw

    m = _LOCAL_PATH_RE.match(raw)
    if m:
        return m.group("city").lower(), m.group("specialty").lower()

    m = _LEGACY_SHIRAZ_RE.match(raw)
    if m:
        return "shiraz", m.group("specialty").lower()

    return None


class LocalSeoRouter:
    """
    Match incoming paths to local hub pages.

    Supports:
      - /{city}/{specialty}  e.g. /tehran/hair-transplant
      - /shiraz/{specialty}    legacy alias (same as /shiraz/{specialty} via general pattern)
    """

    def __init__(self, *, site_base: str = "https://salam-doctor.com") -> None:
        self.site_base = site_base.rstrip("/")

    def match(self, path: str) -> LocalHubPage | None:
        parsed = parse_local_path(path)
        if not parsed:
            return None
        city_slug, specialty_slug = parsed
        city = get_city(city_slug)
        specialty = get_specialty(specialty_slug)
        if not city or not specialty:
            return None

        canonical_path = f"/{city.slug}/{specialty.slug}"
        legacy = path.strip().lower().startswith("/shiraz/") and city.slug == "shiraz"

        return LocalHubPage(
            city=city,
            specialty=specialty,
            path=path.split("?", 1)[0] or canonical_path,
            canonical_path=canonical_path,
            legacy_shiraz=legacy,
        )

    def resolve_or_404(self, path: str) -> LocalHubPage:
        page = self.match(path)
        if not page:
            raise KeyError(f"no local hub for path: {path}")
        return page

    def all_routes(self) -> list[LocalHubPage]:
        from .registry import CITIES, SPECIALTIES

        routes: list[LocalHubPage] = []
        for city in CITIES.values():
            for specialty in SPECIALTIES.values():
                routes.append(
                    LocalHubPage(
                        city=city,
                        specialty=specialty,
                        path=f"/{city.slug}/{specialty.slug}",
                        canonical_path=f"/{city.slug}/{specialty.slug}",
                    )
                )
        return routes

    def to_sitemap_entries(self) -> list[dict[str, Any]]:
        entries = []
        for page in self.all_routes():
            entries.append(
                {
                    "loc": f"{self.site_base}{page.canonical_path}",
                    "priority": "0.85",
                    "changefreq": "weekly",
                }
            )
        return entries
