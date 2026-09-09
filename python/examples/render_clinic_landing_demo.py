#!/usr/bin/env python3
"""Render sample clinic landing (Nahal #114) with SKAG UTM params."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python"))

from clinic_landing import LandingRenderer, build_landing_context
from clinic_landing.context import DoctorCredential, PricingLineItem, PricingPackage
from salam_doctor_seo import ClinicRepository, JsonLdBuilder
from salam_doctor_seo.config import SeoConfig


def load_clinic_114() -> dict:
    repo = ClinicRepository(SeoConfig(project_root=ROOT))
    record = repo.get_by_id(114)
    if not record:
        raise SystemExit("Clinic 114 not found")

    builder = JsonLdBuilder(SeoConfig(project_root=ROOT))
    schema = builder.medical_clinic_schema(record)

    return {
        "id": record.id,
        "name": record.name,
        "phone": record.phone or "09007000462",
        "address": record.address,
        "image": record.image,
        "contact_info": {"phone": record.phone, "whatsapp": "https://wa.me/989007000462"},
        "subheadline": "کاشت مو، لیزر و زیبایی با تجهیزات روز — مشاوره رایگان و تعرفه شفاف قبل از شروع درمان.",
        "hero_3d_asset": None,  # EDIT: "/clinics/114/models/hair.glb"
        "doctors": [
            {
                "name": "دکتر [نام پزشک]",
                "title": "متخصص پوست و مو · جراح زیبایی",
                "license_number": "۱۲۳۴۵۶",
                "board_specialty": "متخصص پوست و مو",
                "fellowships": ["فلوشیپ جراحی پلاستیک صورت", "دوره پیشرفته کاشت مو FUE"],
                "years_experience": 15,
                "publications_count": 12,
            }
        ],
        "pricing_packages": [
            {
                "name": "مشاوره و طرح درمان",
                "total": "رایگان",
                "items": [
                    {"label": "ویزیت تخصصی", "amount": "۰ تومان", "included": True},
                    {"label": "اسکن و آنالیز پوست/مو", "amount": "۰ تومان", "included": True},
                ],
            },
            {
                "name": "کاشت مو FIT (نمونه)",
                "total": "از ۴۵٬۰۰۰٬۰۰۰ تومان",
                "per_session": "شامل ۳ ویزیت پیگیری",
                "highlight": True,
                "items": [
                    {"label": "گرفت و کاشت", "amount": "بر اساس تعداد گرفت", "included": True},
                    {"label": "PRP تقویتی", "amount": "شامل پکیج", "included": True},
                    {"label": "دارو و شامپوی پس از عمل", "amount": "جداگانه", "included": False},
                ],
            },
        ],
        "json_ld": schema,
        "gtm_id": None,
    }


def main() -> None:
    utm = {}
    if len(sys.argv) > 1:
        # e.g. python render_demo.py 'utm_term=candela'
        from urllib.parse import parse_qs

        utm = {k: v[0] for k, v in parse_qs(sys.argv[1]).items()}

    clinic = load_clinic_114()
    ctx = build_landing_context(clinic, utm, site_base="https://salam-doctor.com")
    renderer = LandingRenderer()
    html = renderer.render_landing(ctx)

    out_dir = ROOT / "python" / "examples" / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = utm.get("utm_term") or utm.get("skag") or "default"
    out_path = out_dir / f"clinic-landing-114-{suffix}.html"
    out_path.write_text(html, encoding="utf-8")

    print(f"Rendered: {out_path}")
    print(f"H1: {ctx.skag.h1}")
    print(f"CTA: {ctx.skag.cta_primary}")


if __name__ == "__main__":
    main()
