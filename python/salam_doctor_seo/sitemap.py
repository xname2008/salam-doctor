"""Sitemap.xml generation and auto-refresh on new clinic landings."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Callable

from .config import SeoConfig
from .repository import ClinicRepository

# Static pages mirrored from seoInfra.js CATEGORY_PAGES + core routes
STATIC_PATHS: list[tuple[str, str, str]] = [
    ("/", "1.0", "daily"),
    ("/category.html", "0.6", "weekly"),
    ("/articles.html", "0.7", "weekly"),
    ("/about.html", "0.6", "monthly"),
    ("/faq.html", "0.5", "monthly"),
    ("/clinic-promote.html", "0.7", "weekly"),
    ("/hair-transplant.html", "0.9", "weekly"),
    ("/skin-rejuvenation.html", "0.9", "weekly"),
    ("/laser-hair.html", "0.9", "weekly"),
    ("/injection.html", "0.9", "weekly"),
    ("/cosmetic-surgery.html", "0.9", "weekly"),
    ("/slimming.html", "0.9", "weekly"),
    ("/lasik.html", "0.9", "weekly"),
    ("/femto-lasik.html", "0.9", "weekly"),
    ("/prk.html", "0.9", "weekly"),
    ("/products.html", "0.9", "weekly"),
    ("/pharmacy.html", "0.9", "weekly"),
    ("/eye.html", "0.9", "weekly"),
]


@dataclass
class SitemapEntry:
    loc: str
    lastmod: str
    priority: str = "0.7"
    changefreq: str | None = None


def _iso_date(value: date | datetime | str | None = None) -> str:
    if value is None:
        return date.today().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


class SitemapManager:
    """
    Build and persist sitemap.xml.

    Call `on_clinic_landing_created(clinic_id)` after saving a new landing
    in admin/API — it regenerates the full sitemap immediately.
    """

    def __init__(
        self,
        config: SeoConfig | None = None,
        repository: ClinicRepository | None = None,
        extra_urls: Callable[[], list[SitemapEntry]] | None = None,
    ) -> None:
        self.config = config or SeoConfig()
        self.repository = repository or ClinicRepository(self.config)
        self.extra_urls = extra_urls
        self._output = self.config.sitemap_output_path

    def clinic_entry(self, clinic_id: int) -> SitemapEntry | None:
        record = self.repository.get_by_id(clinic_id)
        if not record:
            return None
        path = record.url_path or self.config.clinic_profile_path(clinic_id)
        return SitemapEntry(
            loc=self.config.absolute_url(path),
            lastmod=_iso_date(record.updated_at),
            priority="0.8",
            changefreq="weekly",
        )

    def collect_entries(self) -> list[SitemapEntry]:
        today = _iso_date()
        seen: set[str] = set()
        entries: list[SitemapEntry] = []

        def add(path: str, priority: str, changefreq: str, lastmod: str = today) -> None:
            loc = self.config.absolute_url(path)
            if loc in seen:
                return
            seen.add(loc)
            entries.append(
                SitemapEntry(loc=loc, lastmod=lastmod, priority=priority, changefreq=changefreq)
            )

        for path, priority, changefreq in STATIC_PATHS:
            add(path, priority, changefreq)

        for clinic in self.repository.list_all():
            path = clinic.url_path or self.config.clinic_profile_path(clinic.id)
            add(
                path,
                "0.8",
                "weekly",
                _iso_date(clinic.updated_at),
            )

        if self.extra_urls:
            for entry in self.extra_urls():
                if entry.loc not in seen:
                    seen.add(entry.loc)
                    entries.append(entry)

        return entries

    @staticmethod
    def render_xml(entries: list[SitemapEntry]) -> str:
        urlset = ET.Element(
            "urlset",
            attrib={
                "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
                "xmlns:xhtml": "http://www.w3.org/1999/xhtml",
            },
        )
        for entry in entries:
            url_el = ET.SubElement(urlset, "url")
            ET.SubElement(url_el, "loc").text = entry.loc
            ET.SubElement(url_el, "lastmod").text = entry.lastmod
            if entry.changefreq:
                ET.SubElement(url_el, "changefreq").text = entry.changefreq
            ET.SubElement(url_el, "priority").text = entry.priority

        ET.indent(urlset, space="  ")
        xml_body = ET.tostring(urlset, encoding="unicode")
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_body + "\n"

    def write(self, output_path: Path | None = None) -> Path:
        target = output_path or self._output
        if not target:
            raise ValueError("sitemap output path is not configured")
        target = Path(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        xml = self.render_xml(self.collect_entries())
        target.write_text(xml, encoding="utf-8")
        return target

    def on_clinic_landing_created(self, clinic_id: int) -> Path:
        """
        Hook: invoke right after a clinic landing page is published.

        Regenerates the entire sitemap (fast for <500 URLs) and returns the file path.
        """
        entry = self.clinic_entry(clinic_id)
        if not entry:
            raise ValueError(f"clinic {clinic_id} not found in catalog")
        return self.write()

    def refresh(self) -> Path:
        """Full rebuild — suitable for cron or deploy hooks."""
        return self.write()
