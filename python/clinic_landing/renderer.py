"""Jinja2 renderer for clinic commercial landing pages."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from .context import LandingContext

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "clinic_landing"


def _tojson_filter(value: Any) -> Markup:
    """JSON for <script type="application/ld+json"> — Unicode-escape HTML metachars."""
    dumped = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    dumped = dumped.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return Markup(dumped)


class LandingRenderer:
    def __init__(self, template_dir: Path | None = None) -> None:
        root = template_dir or _TEMPLATE_DIR
        self.env = Environment(
            loader=FileSystemLoader(str(root)),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["tojson"] = _tojson_filter
        self.env.globals["abs_url"] = self._abs_url_factory

    @staticmethod
    def _abs_url_factory(site_base: str):
        def abs_url(path: str) -> str:
            if path.startswith("http"):
                return path
            return site_base.rstrip("/") + "/" + path.lstrip("/")

        return abs_url

    def render(self, template_name: str, context: LandingContext | dict[str, Any]) -> str:
        data = context.to_dict() if isinstance(context, LandingContext) else dict(context)
        site_base = data.get("site_base", "")

        def abs_url(path: str) -> str:
            if path.startswith("http"):
                return path
            return site_base.rstrip("/") + "/" + path.lstrip("/")

        data["abs_url"] = abs_url
        return self.env.get_template(template_name).render(**data)

    def render_landing(self, context: LandingContext) -> str:
        return self.render("landing.html", context)
