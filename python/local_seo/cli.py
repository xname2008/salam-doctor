#!/usr/bin/env python3
"""CLI for local SEO routing — match paths, print meta, render HTML."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from local_seo import LocalHubRenderer, LocalSeoRouter, build_head_fragment, build_hub_meta


def main() -> int:
    parser = argparse.ArgumentParser(description="Salam Doctor Local SEO router")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_match = sub.add_parser("match", help="Match a URL path")
    p_match.add_argument("path", help="e.g. /tehran/hair-transplant")
    p_match.set_defaults(func=cmd_match)

    p_render = sub.add_parser("render", help="Render hub HTML")
    p_render.add_argument("path")
    p_render.add_argument("-o", "--output", help="Output file")
    p_render.set_defaults(func=cmd_render)

    p_list = sub.add_parser("routes", help="List all city×specialty routes")
    p_list.set_defaults(func=cmd_routes)

    args = parser.parse_args()
    return args.func(args)


def cmd_match(args: argparse.Namespace) -> int:
    router = LocalSeoRouter()
    page = router.match(args.path)
    if not page:
        print(f"NO MATCH: {args.path}", file=sys.stderr)
        return 1
    meta = build_hub_meta(page.city, page.specialty)
    head = build_head_fragment(page.city, page.specialty, site_base="https://salam-doctor.com", canonical_path=page.canonical_path, meta=meta)
    print(json.dumps({
        "city": page.city.slug,
        "city_fa": page.city.name_fa,
        "specialty": page.specialty.slug,
        "specialty_fa": page.specialty.name_fa,
        "canonical_path": page.canonical_path,
        "geo": {"lat": page.city.latitude, "lng": page.city.longitude},
        "title": meta.title,
        "h1": meta.h1,
        "description": meta.description,
    }, ensure_ascii=False, indent=2))
    print("\n--- HEAD fragment ---\n")
    print(head)
    return 0


def cmd_render(args: argparse.Namespace) -> int:
    router = LocalSeoRouter()
    page = router.match(args.path)
    if not page:
        print(f"NO MATCH: {args.path}", file=sys.stderr)
        return 1
    html = LocalHubRenderer().render(page)
    out = Path(args.output) if args.output else ROOT / "examples" / "output" / f"local-{page.city.slug}-{page.specialty.slug}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out}")
    return 0


def cmd_routes(_: argparse.Namespace) -> int:
    router = LocalSeoRouter()
    for page in router.all_routes()[:20]:
        print(page.canonical_path)
    print(f"... total {len(router.all_routes())} routes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
