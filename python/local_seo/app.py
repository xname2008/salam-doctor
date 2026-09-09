#!/usr/bin/env python3
"""Optional FastAPI sidecar for local SEO hub routes."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import HTMLResponse, Response
except ImportError as e:
    raise SystemExit("Install: pip install fastapi uvicorn") from e

from local_seo import LocalHubRenderer, LocalSeoRouter
from salam_doctor_seo import ClinicRepository
from salam_doctor_seo.config import SeoConfig

SITE_BASE = os.environ.get("SITE_BASE", "https://salam-doctor.com")
REPO_ROOT = Path(__file__).resolve().parents[2]
router = LocalSeoRouter(site_base=SITE_BASE)
renderer = LocalHubRenderer(site_base=SITE_BASE)
repo = ClinicRepository(SeoConfig(project_root=REPO_ROOT))

app = FastAPI(title="Salam Doctor Local SEO", version="1.0.0")


def _clinics_for_hub(city_slug: str, limit: int = 10) -> list[dict]:
    """Filter catalog clinics — extend with city field when multi-city data exists."""
    records = repo.list_all()[:limit]
    return [{"id": r.id, "name": r.name, "address": r.address} for r in records]


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "local-seo"}


@app.get("/{city}/{specialty}", response_class=HTMLResponse)
def local_hub(city: str, specialty: str, request: Request) -> HTMLResponse:
    path = f"/{city}/{specialty}"
    page = router.match(path)
    if not page:
        raise HTTPException(status_code=404, detail="Hub not found")

    clinics = _clinics_for_hub(page.city_slug)
    html = renderer.render(page, clinics=clinics)
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            "X-Local-Seo-City": page.city_slug,
            "X-Local-Seo-Specialty": page.specialty_slug,
        },
    )


@app.get("/sitemap-local.xml")
def sitemap_local() -> Response:
    from local_seo.jsonld import json_ld_script_tags  # noqa: F401 — keep import path
    from xml.etree.ElementTree import Element, SubElement, tostring

    urlset = Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for entry in router.to_sitemap_entries():
        url_el = SubElement(urlset, "url")
        SubElement(url_el, "loc").text = entry["loc"]
        SubElement(url_el, "priority").text = entry.get("priority", "0.8")
    body = '<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(urlset, encoding="unicode")
    return Response(content=body, media_type="application/xml")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8020")))
