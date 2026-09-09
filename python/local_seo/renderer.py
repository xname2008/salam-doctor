"""Jinja2 renderer for local SEO hub pages."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .head import build_head_fragment
from .meta import build_hub_meta
from .router import LocalHubPage

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "local_hub"


class LocalHubRenderer:
    def __init__(self, template_dir: Path | None = None, site_base: str = "https://salam-doctor.com") -> None:
        root = template_dir or _TEMPLATE_DIR
        self.site_base = site_base.rstrip("/")
        self.env = Environment(
            loader=FileSystemLoader(str(root)),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def build_context(
        self,
        page: LocalHubPage,
        *,
        clinics: list[dict[str, Any]] | None = None,
        meta_overrides: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        overrides = meta_overrides or {}
        meta = build_hub_meta(
            page.city,
            page.specialty,
            title_override=overrides.get("title"),
            description_override=overrides.get("description"),
            h1_override=overrides.get("h1"),
        )
        head_html = build_head_fragment(
            page.city,
            page.specialty,
            site_base=self.site_base,
            canonical_path=page.canonical_path,
            meta=meta,
        )
        return {
            "page": page,
            "city": page.city,
            "specialty": page.specialty,
            "meta": meta,
            "h1": meta.h1,
            "head_html": head_html,
            "canonical": self.site_base + page.canonical_path,
            "site_base": self.site_base,
            "clinics": clinics or [],
        }

    def render(self, page: LocalHubPage, **kwargs: Any) -> str:
        ctx = self.build_context(page, **kwargs)
        return self.env.get_template("hub.html").render(**ctx)
