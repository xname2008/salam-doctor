"""Dynamic Title, Meta Description, and H1 for local hub pages."""

from __future__ import annotations

from dataclasses import dataclass

from .registry import CityInfo, SpecialtyInfo


@dataclass(frozen=True)
class HubMeta:
    title: str
    description: str
    h1: str
    og_title: str
    og_description: str


def build_hub_meta(
    city: CityInfo,
    specialty: SpecialtyInfo,
    *,
    title_override: str | None = None,
    description_override: str | None = None,
    h1_override: str | None = None,
) -> HubMeta:
    """
    Generate SEO meta for patterns like:
      H1: بهترین کلینیک کاشت مو در تهران
      Title: بهترین کلینیک کاشت مو در تهران | سلام دکتر
    """
    h1 = h1_override or f"بهترین کلینیک {specialty.name_fa} در {city.name_fa}"
    title = title_override or f"{h1} | سلام دکتر"
    description = description_override or (
        f"مقایسه بهترین مراکز {specialty.name_fa} در {city.name_fa}. "
        f"لیست کلینیک‌های معتبر، آدرس، تلفن، امتیاز کاربران و رزرو مشاوره رایگان از طریق سلام دکتر."
    )
    return HubMeta(
        title=title,
        description=description,
        h1=h1,
        og_title=h1,
        og_description=description,
    )
