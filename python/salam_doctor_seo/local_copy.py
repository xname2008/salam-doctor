"""Local SEO copy for doctor/clinic profile title, description, and H1."""

from __future__ import annotations

from typing import Any


def _trim(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def format_local_booking_headline(
    specialty: str | None,
    city: str | None = None,
    neighborhood: str | None = None,
) -> str:
    """
    ``نوبت دهی {specialty} در {city}, {neighborhood}``

    Empty city or neighborhood is omitted (no dangling comma or stray «در»).
    """
    spec = _trim(specialty) or "خدمات پزشکی"
    city_name = _trim(city)
    hood = _trim(neighborhood)

    if city_name and hood:
        location = f"{city_name}, {hood}"
    else:
        location = city_name or hood

    if location:
        return f"نوبت دهی {spec} در {location}"
    return f"نوبت دهی {spec}"


def local_booking_description(headline: str, city: str | None = None, neighborhood: str | None = None) -> str:
    city_name = _trim(city)
    hood = _trim(neighborhood)
    if city_name and hood:
        where = f"{city_name}، {hood}"
    else:
        where = city_name or hood
    if where:
        return f"{headline}. رزرو نوبت آنلاین، مشاهده آدرس و شماره تماس در {where} از طریق سلام دکتر."
    return f"{headline}. رزرو نوبت آنلاین، مشاهده آدرس و شماره تماس از طریق سلام دکتر."


def modifiers_from_mapping(data: dict[str, Any] | None) -> tuple[str, str, str]:
    src = data or {}
    district = src.get("district")
    if isinstance(district, dict):
        district = district.get("name") or district.get("slug")
    addr = src.get("address")
    addr_city = addr.get("city") if isinstance(addr, dict) else None
    services = src.get("services") or []
    first_service = None
    if services:
        first = services[0]
        if isinstance(first, str):
            first_service = first
        elif isinstance(first, dict):
            first_service = first.get("name") or first.get("label")

    specialty = (
        _trim(src.get("medicalSpecialty"))
        or _trim(src.get("specialty"))
        or _trim(first_service)
        or _trim(src.get("name"))
        or "خدمات پزشکی"
    )
    city = (
        _trim(src.get("city"))
        or _trim(src.get("cityFa"))
        or _trim(src.get("city_name"))
        or _trim(addr_city)
    )
    neighborhood = (
        _trim(src.get("neighborhood"))
        or _trim(src.get("mahalle"))
        or _trim(district)
    )
    return specialty, city, neighborhood
