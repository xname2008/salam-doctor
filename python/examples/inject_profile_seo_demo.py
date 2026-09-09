#!/usr/bin/env python3
"""
Practical demo: fetch clinic 114 (Nahal), build JSON-LD, inject into profile.html.

Run from repo root:
    python3 python/examples/inject_profile_seo_demo.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from salam_doctor_seo import ClinicRepository, HtmlInjector, JsonLdBuilder, SitemapManager
from salam_doctor_seo.config import SeoConfig


def main() -> None:
    config = SeoConfig(project_root=ROOT)
    repo = ClinicRepository(config)
    builder = JsonLdBuilder(config)
    injector = HtmlInjector(builder)

    clinic_id = 114
    clinic = repo.get_by_id(clinic_id)
    if not clinic:
        raise SystemExit(f"Clinic {clinic_id} not found in catalog")

    print("=== ClinicRecord ===")
    print(f"  name:      {clinic.name}")
    print(f"  specialty: {clinic.display_specialty}")
    print(f"  phone:     {clinic.phone}")
    print(f"  address:   {clinic.address}")
    print(f"  reviews:   {clinic.reviews}")

    print("\n=== JSON-LD (MedicalClinic) ===")
    schema = builder.medical_clinic_schema(clinic)
    print(builder.to_script_tag(schema))

    template = (ROOT / "profile.html").read_text(encoding="utf-8")
    rendered = injector.inject(template, clinic)
    out = ROOT / "python" / "examples" / "output" / f"profile-{clinic_id}-seo.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(rendered, encoding="utf-8")
    print(f"\n=== Injected HTML written to ===\n  {out}")

    sitemap_path = SitemapManager(config, repo).write(ROOT / "python" / "examples" / "output" / "sitemap-demo.xml")
    print(f"\n=== Demo sitemap ===\n  {sitemap_path}")


if __name__ == "__main__":
    main()
