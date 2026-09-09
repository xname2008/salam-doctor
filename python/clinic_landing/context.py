"""Build Jinja2 render context for clinic commercial landings."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from .utm_skag import SkagCopy, resolve_skag_copy

try:
    from salam_doctor_seo.local_copy import (
        format_local_booking_headline,
        local_booking_description,
        modifiers_from_mapping,
    )
    from salam_doctor_seo.jsonld import (
        build_faq_page_json_ld,
        default_clinic_profile_faqs,
    )
except ImportError:  # pragma: no cover
    format_local_booking_headline = None  # type: ignore[assignment]
    local_booking_description = None  # type: ignore[assignment]
    modifiers_from_mapping = None  # type: ignore[assignment]
    build_faq_page_json_ld = None  # type: ignore[assignment]
    default_clinic_profile_faqs = None  # type: ignore[assignment]


@dataclass
class PricingLineItem:
    label: str
    amount: str
    note: str | None = None
    included: bool = True


@dataclass
class PricingPackage:
    name: str
    total: str
    per_session: str | None
    items: list[PricingLineItem] = field(default_factory=list)
    highlight: bool = False


@dataclass
class DoctorCredential:
    name: str
    title: str
    license_number: str | None = None
    board_specialty: str | None = None
    fellowships: list[str] = field(default_factory=list)
    publications_count: int | None = None
    years_experience: int | None = None
    avatar_url: str | None = None


@dataclass
class LandingContext:
    """All variables available to clinic_landing/*.html templates."""

    clinic_id: int
    clinic_name: str
    city: str
    phone: str
    whatsapp_url: str | None
    address: str | None
    hero_image: str
    hero_3d_asset: str | None  # URL to GLB/PNG biomedical render
    logo_url: str | None
    skag: SkagCopy
    default_h1: str
    subheadline: str
    trust_badges: list[str]
    doctors: list[DoctorCredential]
    pricing_intro: str
    pricing_packages: list[PricingPackage]
    pricing_footnote: str
    site_base: str
    json_ld: dict[str, Any] | list[dict[str, Any]] | None = None
    json_ld_script: str | None = None
    gtm_id: str | None = None
    meta_description: str | None = None
    faqs: list[dict[str, str]] | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "clinic_id": self.clinic_id,
            "clinic_name": self.clinic_name,
            "city": self.city,
            "phone": self.phone,
            "whatsapp_url": self.whatsapp_url,
            "address": self.address,
            "hero_image": self.hero_image,
            "hero_3d_asset": self.hero_3d_asset,
            "logo_url": self.logo_url,
            "skag": self.skag,
            "h1": self.skag.h1,
            "cta_primary": self.skag.cta_primary,
            "cta_secondary": self.skag.cta_secondary,
            "default_h1": self.default_h1,
            "subheadline": self.subheadline,
            "trust_badges": self.trust_badges,
            "doctors": self.doctors,
            "pricing_intro": self.pricing_intro,
            "pricing_packages": self.pricing_packages,
            "pricing_footnote": self.pricing_footnote,
            "site_base": self.site_base,
            "json_ld": self.json_ld,
            "json_ld_script": self.json_ld_script,
            "gtm_id": self.gtm_id,
            "meta_description": self.meta_description or self.subheadline,
            "faqs": self.faqs or [],
            **self.extra,
        }


def build_landing_context(
    clinic: Mapping[str, Any],
    utm_params: Mapping[str, Any] | None = None,
    *,
    site_base: str = "https://salam-doctor.com",
    city: str = "شیراز",
) -> LandingContext:
    """
    Map catalog / DB clinic dict → LandingContext.

    Expected keys: id, name, phone, address, image, contact_info, doctors (optional list).
    """
    utm_params = utm_params or {}
    clinic_id = int(clinic["id"])
    name = str(clinic.get("name") or clinic.get("sliderTitle") or f"مرکز {clinic_id}")
    display_name = name if name.startswith("کلینیک") else f"کلینیک {name}"
    contact = clinic.get("contact_info") or {}
    phone = str(contact.get("phone") or clinic.get("phone") or "")
    whatsapp = contact.get("whatsapp")
    address = clinic.get("address") or clinic.get("sliderTagline")

    neighborhood = ""
    specialty = name
    if modifiers_from_mapping:
        specialty, mapped_city, neighborhood = modifiers_from_mapping(dict(clinic))
        if mapped_city:
            city = mapped_city
    if format_local_booking_headline:
        default_h1 = format_local_booking_headline(specialty, city, neighborhood)
        meta_description = (
            local_booking_description(default_h1, city, neighborhood)
            if local_booking_description
            else default_h1
        )
    else:
        default_h1 = f"{display_name} — مرجع تخصصی زیبایی و درمان در {city}"
        meta_description = None

    skag = resolve_skag_copy(
        utm_params,
        clinic_name=name,
        city=city,
        default_h1=default_h1,
    )

    doctors_raw = clinic.get("doctors") or []
    doctors: list[DoctorCredential] = []
    for d in doctors_raw:
        if isinstance(d, DoctorCredential):
            doctors.append(d)
        elif isinstance(d, dict):
            doctors.append(
                DoctorCredential(
                    name=d.get("name", ""),
                    title=d.get("title", "پزشک"),
                    license_number=d.get("license_number"),
                    board_specialty=d.get("board_specialty"),
                    fellowships=list(d.get("fellowships") or []),
                    publications_count=d.get("publications_count"),
                    years_experience=d.get("years_experience"),
                    avatar_url=d.get("avatar_url"),
                )
            )

    if not doctors:
        doctors = [
            DoctorCredential(
                name="تیم پزشکی کلینیک",
                title="متخصص پوست و مو",
                license_number="—",
                board_specialty="متخصص پوست و مو",
                fellowships=["فلوشیپ جراحی پلاستیک"],
                years_experience=10,
            )
        ]

    pricing = clinic.get("pricing_packages") or _default_pricing()
    if pricing and isinstance(pricing[0], dict):
        pricing_packages = [
            PricingPackage(
                name=p["name"],
                total=p["total"],
                per_session=p.get("per_session"),
                highlight=bool(p.get("highlight")),
                items=[
                    PricingLineItem(**item) if isinstance(item, dict) else item
                    for item in p.get("items", [])
                ],
            )
            for p in pricing
        ]
    else:
        pricing_packages = pricing  # type: ignore[assignment]

    image = str(clinic.get("image") or "/images/sample-clinic-services.webp")
    if not image.startswith("http"):
        image = site_base.rstrip("/") + ("/" + image.lstrip("/"))

    faqs = list(clinic.get("faqs") or [])
    if not faqs and default_clinic_profile_faqs:
        faqs = default_clinic_profile_faqs(name, city, specialty)

    json_ld = clinic.get("json_ld")
    if json_ld is None:
        json_ld = _build_profile_json_ld(
            clinic,
            site_base=site_base,
            city=city,
            name=name,
            phone=phone,
            address=address if isinstance(address, str) else None,
            clinic_id=clinic_id,
            image=image,
            description=str(clinic.get("subheadline") or clinic.get("description") or ""),
        )
    faq_schema = build_faq_page_json_ld(faqs) if build_faq_page_json_ld else None
    if faq_schema:
        if isinstance(json_ld, list):
            json_ld = [*json_ld, faq_schema]
        elif json_ld:
            json_ld = [json_ld, faq_schema]
        else:
            json_ld = faq_schema

    return LandingContext(
        clinic_id=clinic_id,
        clinic_name=name,
        city=city,
        phone=phone,
        whatsapp_url=whatsapp,
        address=address,
        hero_image=image,
        hero_3d_asset=clinic.get("hero_3d_asset"),
        logo_url=clinic.get("logo_url") or f"{site_base}/images/logo-heart.svg",
        skag=skag,
        default_h1=default_h1,
        subheadline=str(
            clinic.get("subheadline")
            or "مشاوره تخصصی، تجهیزات پیشرفته و شفافیت کامل در هزینه — قبل از تصمیم‌گیری، دقیق بدانید چه می‌پردازید."
        ),
        trust_badges=list(
            clinic.get("trust_badges")
            or ["مجوز وزارت بهداشت", "تضمین اصالت دستگاه", "گزارش شفاف هزینه"]
        ),
        doctors=doctors,
        pricing_intro=str(
            clinic.get("pricing_intro")
            or "برآورد شفاف هزینه درمان بر اساس اقتصاد سلامت: هر آیتم زیر جداگانه قابل بررسی است."
        ),
        pricing_packages=pricing_packages,
        pricing_footnote=str(
            clinic.get("pricing_footnote")
            or "قیمت‌ها تقریبی و پس از معاینه حضوری نهایی می‌شوند. مالیات و داروهای مصرفی در صورت نیاز جداگانه اعلام می‌شود."
        ),
        site_base=site_base,
        gtm_id=clinic.get("gtm_id"),
        meta_description=meta_description,
        faqs=faqs,
        json_ld=json_ld,
        json_ld_script=clinic.get("json_ld_script"),
    )


def _specialty_from_clinic(clinic: Mapping[str, Any]) -> str | None:
    spec = clinic.get("medicalSpecialty") or clinic.get("specialty")
    if spec:
        return str(spec)
    services = clinic.get("services") or []
    if services:
        first = services[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict) and first.get("name"):
            return str(first["name"])
    return None


def _build_profile_json_ld(
    clinic: Mapping[str, Any],
    *,
    site_base: str,
    city: str,
    name: str,
    phone: str,
    address: str | None,
    clinic_id: int,
    image: str,
    description: str,
) -> dict[str, Any] | None:
    from salam_doctor_seo.jsonld import build_medical_entity_json_ld

    addr = clinic.get("json_ld_address")
    if not isinstance(addr, dict):
        addr = {"street": address or "", "city": city}

    reviews = clinic.get("reviews") if isinstance(clinic.get("reviews"), dict) else {}
    rating = clinic.get("ratingValue", clinic.get("rating"))
    count = clinic.get("reviewCount", clinic.get("ratingCount", clinic.get("reviewsCount")))
    if rating is None:
        rating = reviews.get("rating_value") if reviews else None
    if count is None:
        count = reviews.get("review_count") if reviews else None

    entity = str(clinic.get("entityType") or clinic.get("entity_type") or "MedicalClinic")
    image_url = image if image.startswith("http") else f"{site_base.rstrip('/')}/{image.lstrip('/')}"
    profile_slug = clinic.get("slug") or f"clinic-{clinic_id}"

    try:
        return build_medical_entity_json_ld(
            name=name,
            medicalSpecialty=_specialty_from_clinic(clinic),
            address=addr,
            telephone=phone,
            latitude=clinic.get("latitude"),
            longitude=clinic.get("longitude"),
            ratingValue=rating,
            reviewCount=count,
            entityType=entity,
            url=f"{site_base.rstrip('/')}/doctor/{profile_slug}",
            image=image_url,
            description=description or None,
        )
    except ValueError:
        return None


def _default_pricing() -> list[dict[str, Any]]:
    return [
        {
            "name": "مشاوره + طرح درمان",
            "total": "رایگان",
            "per_session": None,
            "highlight": False,
            "items": [
                {"label": "ویزیت پزشک متخصص", "amount": "۰ تومان", "included": True},
                {"label": "طرح درمان شخصی‌سازی‌شده", "amount": "۰ تومان", "included": True},
            ],
        },
        {
            "name": "پکیج درمان (نمونه)",
            "total": "از ۱۵٬۰۰۰٬۰۰۰ تومان",
            "per_session": "شامل ۳ جلسه پیگیری",
            "highlight": True,
            "items": [
                {"label": "هزینه عمل / جلسه اصلی", "amount": "شفاف در قرارداد", "included": True},
                {"label": "بی‌حسی و آماده‌سازی", "amount": "شامل پکیج", "included": True},
                {"label": "ویزیت‌های پیگیری", "amount": "۳ جلسه", "included": True},
                {"label": "کیت مراقبت پس از درمان", "amount": "اختیاری", "included": False},
            ],
        },
    ]
