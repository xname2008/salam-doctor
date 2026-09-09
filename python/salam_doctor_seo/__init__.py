"""
Salam Doctor — Technical SEO utilities (JSON-LD, sitemap, HTML injection).

Usage:
    from salam_doctor_seo import ClinicRepository, JsonLdBuilder, HtmlInjector, SitemapManager
"""

from .config import SeoConfig
from .models import ClinicRecord, ReviewSummary
from .repository import ClinicRepository
from .local_copy import format_local_booking_headline, local_booking_description
from .jsonld import (
    JsonLdBuilder,
    build_medical_entity_json_ld,
    build_faq_page_json_ld,
    ALLOWED_ENTITY_TYPES,
)
from .html_inject import HtmlInjector
from .sitemap import SitemapManager

__all__ = [
    "SeoConfig",
    "ClinicRecord",
    "ReviewSummary",
    "ClinicRepository",
    "format_local_booking_headline",
    "local_booking_description",
    "build_faq_page_json_ld",
    "ALLOWED_ENTITY_TYPES",
    "build_medical_entity_json_ld",
    "JsonLdBuilder",
    "HtmlInjector",
    "SitemapManager",
]

__version__ = "1.0.0"
