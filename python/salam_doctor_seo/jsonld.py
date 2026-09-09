"""Schema.org JSON-LD builders for clinic landing pages."""

from __future__ import annotations

import html
import json
from typing import Any

from .config import SeoConfig
from .models import ClinicRecord, ReviewSummary

ALLOWED_ENTITY_TYPES = frozenset({"MedicalClinic", "Physician"})


def _clamp_rating(value: float, low: float, high: float) -> float:
    return max(low, min(high, round(value, 1)))


def _finite_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number not in (float("inf"), float("-inf")) else None


def dumps_json_ld(data: Any) -> str:
    """Serialize JSON-LD so `</script>` in a string cannot break out of the tag."""
    return (
        json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )


def _trim_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def build_medical_entity_json_ld(
    name: str,
    medicalSpecialty: str | None = None,
    address: dict[str, Any] | None = None,
    telephone: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    ratingValue: float | None = None,
    reviewCount: int | None = None,
    *,
    entityType: str = "MedicalClinic",
    url: str | None = None,
    image: str | None = None,
    description: str | None = None,
    bestRating: float = 5,
    worstRating: float = 1,
) -> dict[str, Any]:
    """
    Build a JSON-serializable schema.org graph for a Physician or MedicalClinic.

    Nested ``GeoCoordinates`` and ``AggregateRating`` objects are always present
    so callers can inject a complete entity node.

    >>> schema = build_medical_entity_json_ld(
    ...     name="کلینیک نهال",
    ...     medicalSpecialty="Dermatology",
    ...     address={"street": "بلوار معالی‌آباد", "city": "شیراز"},
    ...     telephone="+989121234567",
    ...     latitude=29.5918,
    ...     longitude=52.5837,
    ...     ratingValue=4.8,
    ...     reviewCount=124,
    ... )
    >>> schema["@type"], schema["geo"]["@type"], schema["aggregateRating"]["@type"]
    ('MedicalClinic', 'GeoCoordinates', 'AggregateRating')
    """
    display_name = _trim_or_none(name)
    if not display_name:
        raise ValueError("name is required for Physician/MedicalClinic JSON-LD")

    resolved_type = entityType if entityType in ALLOWED_ENTITY_TYPES else "MedicalClinic"

    schema: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": resolved_type,
        "name": display_name,
    }

    specialty = _trim_or_none(medicalSpecialty)
    if specialty:
        schema["medicalSpecialty"] = specialty

    address_input = address if isinstance(address, dict) else {}
    street = _trim_or_none(address_input.get("street"))
    city = _trim_or_none(address_input.get("city"))
    region = _trim_or_none(address_input.get("region"))
    country = _trim_or_none(address_input.get("country")) or "IR"

    postal: dict[str, Any] = {"@type": "PostalAddress", "addressCountry": country}
    if street:
        postal["streetAddress"] = street
    if city:
        postal["addressLocality"] = city
    if region:
        postal["addressRegion"] = region
    schema["address"] = postal

    phone = _trim_or_none(telephone)
    if phone:
        schema["telephone"] = phone

    lat = _finite_number(latitude)
    lng = _finite_number(longitude)
    schema["geo"] = {
        "@type": "GeoCoordinates",
        "latitude": lat if lat is not None else latitude,
        "longitude": lng if lng is not None else longitude,
    }

    page_url = _trim_or_none(url)
    if page_url:
        schema["url"] = page_url

    image_url = _trim_or_none(image)
    if image_url:
        schema["image"] = image_url

    desc = _trim_or_none(description)
    if desc:
        schema["description"] = desc

    rating = _finite_number(ratingValue)
    reviews = _finite_number(reviewCount)
    best = _finite_number(bestRating)
    worst = _finite_number(worstRating)
    best = 5.0 if best is None else best
    worst = 1.0 if worst is None else worst

    clamped = _clamp_rating(rating, worst, best) if rating is not None else ratingValue
    count = int(round(reviews)) if reviews is not None else reviewCount

    schema["aggregateRating"] = {
        "@type": "AggregateRating",
        "ratingValue": clamped,
        "reviewCount": count,
        "bestRating": best,
        "worstRating": worst,
    }

    return schema


def _faq_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def normalize_faq_item(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    question = _faq_text(item.get("question") or item.get("q") or item.get("name"))
    answer = _faq_text(item.get("answer") or item.get("a") or item.get("text"))
    if not question or not answer:
        return None
    return {"question": question, "answer": answer}


def build_faq_page_json_ld(items: list[Any] | None) -> dict[str, Any] | None:
    """Build a JSON-serializable schema.org FAQPage from Q&A dictionaries."""
    faqs: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in items or []:
        qa = normalize_faq_item(raw)
        if not qa:
            continue
        key = qa["question"].casefold()
        if key in seen:
            continue
        seen.add(key)
        faqs.append(qa)
    if not faqs:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": qa["question"],
                "acceptedAnswer": {"@type": "Answer", "text": qa["answer"]},
            }
            for qa in faqs
        ],
    }


def default_clinic_profile_faqs(
    name: str | None,
    city: str | None = None,
    specialty: str | None = None,
) -> list[dict[str, str]]:
    clinic = _faq_text(name) or "این مرکز"
    loc = f" در {_faq_text(city)}" if _faq_text(city) else ""
    service = _faq_text(specialty) or "خدمات این مرکز"
    return [
        {
            "question": f"آیا {clinic} طرف قرارداد بیمه است؟",
            "answer": (
                f"پوشش بیمه در {clinic} بسته به نوع خدمت و شرکت بیمه (پایه یا تکمیلی) متفاوت است. "
                "هنگام رزرو نوبت از کارشناسان سلام دکتر بپرسید کدام بیمه‌ها در این مرکز پذیرفته می‌شود "
                "و آیا نیاز به معرفی‌نامه دارید."
            ),
        },
        {
            "question": f"مدت انتظار برای نوبت {service}{loc} چقدر است؟",
            "answer": (
                f"زمان انتظار در {clinic} معمولاً از نوبت همان روز تا چند روز کاری متغیر است "
                "و به نوع خدمت و شلوغی مرکز بستگی دارد. برای نزدیک‌ترین نوبت خالی از دکمه "
                "«درخواست نوبت فوری» استفاده کنید."
            ),
        },
        {
            "question": f"چطور برای {service} در {clinic} نوبت بگیرم؟",
            "answer": (
                f"از دکمه درخواست نوبت در همین صفحه استفاده کنید یا با شماره تماس مرکز ارتباط بگیرید. "
                "کارشناسان سلام دکتر هم می‌توانند نزدیک‌ترین زمان خالی را هماهنگ کنند."
            ),
        },
        {
            "question": f"هزینه ویزیت و درمان در {clinic} چقدر است؟",
            "answer": (
                "تعرفه بسته به نوع خدمت، تجهیزات و طرح درمان پس از معاینه اعلام می‌شود. "
                "قبل از شروع درمان می‌توانید برآورد هزینه را از مرکز یا از مشاوره رایگان سلام دکتر بگیرید."
            ),
        },
    ]


def faq_accordion_html(items: list[Any] | None, *, id_prefix: str = "faq") -> str:
    """Accessible details/summary accordion that mirrors FAQPage JSON-LD copy."""
    blocks: list[str] = []
    index = 0
    seen: set[str] = set()
    for raw in items or []:
        qa = normalize_faq_item(raw)
        if not qa:
            continue
        key = qa["question"].casefold()
        if key in seen:
            continue
        seen.add(key)
        index += 1
        qid = f"{id_prefix}-{index}"
        q = html.escape(qa["question"])
        a = html.escape(qa["answer"])
        blocks.append(
            "\n".join(
                [
                    '<details class="faq-accordion__item">',
                    f'  <summary class="faq-accordion__summary" id="{qid}-q">',
                    f'    <span class="faq-accordion__question">{q}</span>',
                    '    <span class="faq-accordion__icon" aria-hidden="true"></span>',
                    "  </summary>",
                    f'  <div class="faq-accordion__panel" id="{qid}-a" role="region" aria-labelledby="{qid}-q">',
                    f"    <p>{a}</p>",
                    "  </div>",
                    "</details>",
                ]
            )
        )
    return "\n".join(blocks)


class JsonLdBuilder:
    """Produce standard JSON-LD for MedicalClinic + AggregateRating."""

    def __init__(self, config: SeoConfig | None = None) -> None:
        self.config = config or SeoConfig()

    def aggregate_rating_schema(self, reviews: ReviewSummary) -> dict[str, Any] | None:
        if not reviews or not reviews.is_valid():
            return None
        return {
            "@type": "AggregateRating",
            "ratingValue": _clamp_rating(reviews.rating_value, reviews.worst_rating, reviews.best_rating),
            "reviewCount": int(reviews.review_count),
            "bestRating": reviews.best_rating,
            "worstRating": reviews.worst_rating,
        }

    def medical_clinic_schema(self, clinic: ClinicRecord) -> dict[str, Any]:
        """
        Build a MedicalClinic JSON-LD object.

        Uses MedicalClinic (schema.org) as requested; also compatible with
        Google's Local Business rich results when address/phone/geo are present.
        """
        schema: dict[str, Any] = {
            "@context": "https://schema.org",
            "@type": "MedicalClinic",
            "@id": self.config.absolute_url(clinic.url_path or self.config.clinic_profile_path(clinic.id)) + "#clinic",
            "name": clinic.name,
            "url": self.config.absolute_url(clinic.url_path or self.config.clinic_profile_path(clinic.id)),
            "image": self.config.absolute_image(clinic.image),
            "address": {
                "@type": "PostalAddress",
                "addressLocality": self.config.address_locality,
                "addressRegion": self.config.address_region,
                "addressCountry": self.config.address_country,
            },
        }

        if clinic.address:
            schema["address"]["streetAddress"] = clinic.address

        if clinic.phone:
            schema["telephone"] = clinic.phone

        if clinic.description:
            schema["description"] = clinic.description

        specialty = clinic.display_specialty
        if specialty:
            schema["medicalSpecialty"] = specialty

        if clinic.services:
            schema["availableService"] = [
                {"@type": "MedicalProcedure", "name": svc} for svc in clinic.services[:12]
            ]

        if clinic.latitude is not None and clinic.longitude is not None:
            schema["geo"] = {
                "@type": "GeoCoordinates",
                "latitude": clinic.latitude,
                "longitude": clinic.longitude,
            }

        rating = self.aggregate_rating_schema(clinic.reviews) if clinic.reviews else None
        if rating:
            schema["aggregateRating"] = rating

        return schema

    def breadcrumb_schema(self, clinic: ClinicRecord) -> dict[str, Any]:
        items = [
            {"@type": "ListItem", "position": 1, "name": "خانه", "item": self.config.absolute_url("/")},
            {
                "@type": "ListItem",
                "position": 2,
                "name": "مراکز",
                "item": self.config.absolute_url("/category.html"),
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": clinic.name,
                "item": self.config.absolute_url(
                    clinic.url_path or self.config.clinic_profile_path(clinic.id)
                ),
            },
        ]
        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": items,
        }

    def profile_graph(self, clinic: ClinicRecord) -> list[dict[str, Any]]:
        """Schemas typically injected together on a clinic profile page."""
        cfg = self.config
        reviews = clinic.reviews
        entity = build_medical_entity_json_ld(
            name=clinic.name,
            medicalSpecialty=clinic.display_specialty,
            address={
                "street": clinic.address or "",
                "city": cfg.address_locality,
                "region": cfg.address_region,
                "country": cfg.address_country,
            },
            telephone=clinic.phone,
            latitude=clinic.latitude,
            longitude=clinic.longitude,
            ratingValue=reviews.rating_value if reviews else None,
            reviewCount=reviews.review_count if reviews else None,
            url=cfg.absolute_url(clinic.url_path or cfg.clinic_profile_path(clinic.id)),
            image=cfg.absolute_image(clinic.image),
            description=clinic.description,
        )
        raw_faqs = clinic.extra.get("faqs") if clinic.extra else None
        faqs = list(raw_faqs) if raw_faqs else default_clinic_profile_faqs(
            clinic.name,
            clinic.city or cfg.address_locality,
            clinic.display_specialty,
        )
        faq = build_faq_page_json_ld(faqs)
        return [node for node in (entity, self.breadcrumb_schema(clinic), faq) if node]

    def to_script_tag(self, data: dict[str, Any] | list[dict[str, Any]]) -> str:
        payload = dumps_json_ld(data)
        return f'<script type="application/ld+json">{payload}</script>'

    def to_script_tags(self, schemas: list[dict[str, Any]]) -> str:
        return "\n".join(self.to_script_tag(s) for s in schemas if s)
