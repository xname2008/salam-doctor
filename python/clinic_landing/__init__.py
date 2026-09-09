"""Commercial clinic landing page renderer (Jinja2 + CRO/SKAG)."""

from .context import LandingContext, build_landing_context
from .renderer import LandingRenderer
from .utm_skag import parse_skag_from_request, resolve_skag_copy

__all__ = [
    "LandingContext",
    "build_landing_context",
    "LandingRenderer",
    "parse_skag_from_request",
    "resolve_skag_copy",
]
