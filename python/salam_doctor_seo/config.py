"""Central configuration — override via environment variables."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path


def _project_root() -> Path:
    # python/salam_doctor_seo/config.py → repo root
    return Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class SeoConfig:
    """Runtime paths and site constants."""

    site_base: str = "https://salam-doctor.com"
    site_name_fa: str = "سلام دکتر"
    default_og_image: str = "/images/hero-collage.png"
    address_locality: str = "شیراز"
    address_region: str = "فارس"
    address_country: str = "IR"

    # Data sources (override in Docker via env)
    project_root: Path = field(default_factory=_project_root)
    sqlite_path: Path | None = None
    catalog_js_path: Path | None = None
    sitemap_output_path: Path | None = None
    postgres_dsn: str | None = None
    _clinic_slugs: dict[str, str] = field(default_factory=dict, repr=False, compare=False)

    def __post_init__(self) -> None:
        root = self.project_root
        object.__setattr__(
            self,
            "sqlite_path",
            Path(os.environ.get("LEADS_DB_PATH", root / "leads.db")),
        )
        object.__setattr__(
            self,
            "catalog_js_path",
            Path(os.environ.get("CLINICS_CATALOG_PATH", root / "data.min.js")),
        )
        object.__setattr__(
            self,
            "sitemap_output_path",
            Path(os.environ.get("SITEMAP_OUTPUT_PATH", root / "sitemap.xml")),
        )
        object.__setattr__(
            self,
            "postgres_dsn",
            os.environ.get("DATABASE_URL") or None,
        )
        object.__setattr__(
            self,
            "site_base",
            os.environ.get("SITE_BASE", self.site_base).rstrip("/"),
        )
        slugs: dict[str, str] = {}
        slug_file = root / "data" / "clinic-slugs.json"
        try:
            slugs = json.loads(slug_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            slugs = {}
        object.__setattr__(self, "_clinic_slugs", slugs if isinstance(slugs, dict) else {})

    def absolute_url(self, path: str) -> str:
        raw = (path or "/").strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        if not raw.startswith("/"):
            raw = "/" + raw
        return self.site_base + raw

    def absolute_image(self, path: str | None) -> str:
        return self.absolute_url(path or self.default_og_image)

    def clinic_profile_path(self, clinic_id: int | str, slug: str | None = None) -> str:
        key = str(clinic_id)
        mapped = slug or getattr(self, "_clinic_slugs", {}).get(key) or f"clinic-{clinic_id}"
        return f"/doctor/{mapped}"
