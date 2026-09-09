#!/usr/bin/env python3
"""CLI for Salam Doctor SEO tools."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running without pip install: python -m salam_doctor_seo.cli
if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from salam_doctor_seo import ClinicRepository, HtmlInjector, JsonLdBuilder, SitemapManager
from salam_doctor_seo.config import SeoConfig


def cmd_jsonld(args: argparse.Namespace) -> int:
    repo = ClinicRepository()
    builder = JsonLdBuilder()
    clinic = repo.get_by_id(args.clinic_id)
    if not clinic:
        print(f"Clinic {args.clinic_id} not found", file=sys.stderr)
        return 1
    schemas = builder.profile_graph(clinic)
    if args.pretty:
        print(json.dumps(schemas, ensure_ascii=False, indent=2))
    else:
        print(builder.to_script_tags(schemas))
    return 0


def cmd_inject(args: argparse.Namespace) -> int:
    repo = ClinicRepository()
    injector = HtmlInjector()
    clinic = repo.get_by_id(args.clinic_id)
    if not clinic:
        print(f"Clinic {args.clinic_id} not found", file=sys.stderr)
        return 1
    html_path = Path(args.html)
    html_doc = html_path.read_text(encoding="utf-8")
    out = injector.inject(html_doc, clinic)
    dest = Path(args.output) if args.output else html_path
    dest.write_text(out, encoding="utf-8")
    print(f"Wrote {dest}")
    return 0


def cmd_sitemap(args: argparse.Namespace) -> int:
    mgr = SitemapManager()
    if args.clinic_id:
        path = mgr.on_clinic_landing_created(args.clinic_id)
    else:
        path = mgr.refresh()
    print(f"Sitemap written: {path} ({path.stat().st_size} bytes)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Salam Doctor Technical SEO CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_jsonld = sub.add_parser("jsonld", help="Print JSON-LD for a clinic")
    p_jsonld.add_argument("clinic_id", type=int)
    p_jsonld.add_argument("--pretty", action="store_true")
    p_jsonld.set_defaults(func=cmd_jsonld)

    p_inject = sub.add_parser("inject", help="Inject SEO tags into an HTML file")
    p_inject.add_argument("clinic_id", type=int)
    p_inject.add_argument("html", help="Source HTML path")
    p_inject.add_argument("-o", "--output", help="Output path (default: overwrite source)")
    p_inject.set_defaults(func=cmd_inject)

    p_sitemap = sub.add_parser("sitemap", help="Build or refresh sitemap.xml")
    p_sitemap.add_argument("--clinic-id", type=int, help="Trigger after new landing")
    p_sitemap.set_defaults(func=cmd_sitemap)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
