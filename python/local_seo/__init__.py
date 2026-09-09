"""Local SEO dynamic routing — /{city}/{specialty} hub pages."""

from .registry import CityInfo, SpecialtyInfo, get_city, get_specialty, list_cities, list_specialties
from .router import LocalHubPage, LocalSeoRouter, parse_local_path
from .meta import build_hub_meta
from .jsonld import build_hub_json_ld
from .head import build_head_fragment
from .renderer import LocalHubRenderer

__all__ = [
    "CityInfo",
    "SpecialtyInfo",
    "get_city",
    "get_specialty",
    "list_cities",
    "list_specialties",
    "LocalHubPage",
    "LocalSeoRouter",
    "parse_local_path",
    "build_hub_meta",
    "build_hub_json_ld",
    "build_head_fragment",
    "LocalHubRenderer",
]
