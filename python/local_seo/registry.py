"""City and specialty registries for local SEO hubs."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CityInfo:
    slug: str
    name_fa: str
    name_en: str
    region_fa: str
    latitude: float
    longitude: float
    country: str = "IR"


@dataclass(frozen=True)
class SpecialtyInfo:
    slug: str
    name_fa: str
    name_en: str
    category: str = "medical"


# EDIT: add cities — slug must match URL segment (ASCII)
CITIES: dict[str, CityInfo] = {
    "shiraz": CityInfo("shiraz", "شیراز", "Shiraz", "فارس", 29.5918, 52.5837),
    "tehran": CityInfo("tehran", "تهران", "Tehran", "تهران", 35.6892, 51.3890),
    "isfahan": CityInfo("isfahan", "اصفهان", "Isfahan", "اصفهان", 32.6539, 51.6660),
    "mashhad": CityInfo("mashhad", "مشهد", "Mashhad", "خراسان رضوی", 36.2605, 59.6168),
    "tabriz": CityInfo("tabriz", "تبریز", "Tabriz", "آذربایجان شرقی", 38.0800, 46.2919),
    "ahvaz": CityInfo("ahvaz", "اهواز", "Ahvaz", "خوزستان", 31.3183, 48.6706),
    "kerman": CityInfo("kerman", "کرمان", "Kerman", "کرمان", 30.2839, 57.0834),
}

# EDIT: specialty slugs — keep in sync with hub-slugs.js
SPECIALTIES: dict[str, SpecialtyInfo] = {
    "hair-transplant": SpecialtyInfo("hair-transplant", "کاشت مو", "Hair Transplant"),
    "eyebrow-transplant": SpecialtyInfo("eyebrow-transplant", "کاشت ابرو", "Eyebrow Transplant"),
    "skin-rejuvenation": SpecialtyInfo("skin-rejuvenation", "جوانسازی پوست", "Skin Rejuvenation"),
    "laser-hair-removal": SpecialtyInfo("laser-hair-removal", "لیزر موهای زائد", "Laser Hair Removal"),
    "cosmetic-surgery": SpecialtyInfo("cosmetic-surgery", "جراحی زیبایی", "Cosmetic Surgery"),
    "slimming": SpecialtyInfo("slimming", "لاغری و پیکرتراشی", "Body Contouring"),
    "botox": SpecialtyInfo("botox", "بوتاکس", "Botox"),
    "fillers": SpecialtyInfo("fillers", "تزریق ژل و فیلر", "Dermal Fillers"),
    "mesotherapy": SpecialtyInfo("mesotherapy", "مزوتراپی", "Mesotherapy"),
    "dental-implant": SpecialtyInfo("dental-implant", "ایمپلنت دندان", "Dental Implant"),
    "orthodontics": SpecialtyInfo("orthodontics", "ارتودنسی", "Orthodontics"),
    "dermatology": SpecialtyInfo("dermatology", "پوست و زیبایی", "Dermatology"),
    "laser-candela-2026": SpecialtyInfo("laser-candela-2026", "لیزر کندلا", "Candela Laser"),
    "hifu-doublo-gold": SpecialtyInfo("hifu-doublo-gold", "هایفو دابلو گلد", "HIFU Doublo Gold"),
    "co2-fractional-laser": SpecialtyInfo("co2-fractional-laser", "لیزر CO2 فرکشنال", "CO2 Fractional Laser"),
    "hair-transplant-installment": SpecialtyInfo(
        "hair-transplant-installment", "کاشت مو اقساطی", "Hair Transplant Installment"
    ),
    "micro-fit-hair-transplant": SpecialtyInfo(
        "micro-fit-hair-transplant", "کاشت مو Micro FIT", "Micro FIT Hair Transplant"
    ),
    "mens-laser-shiraz": SpecialtyInfo("mens-laser-shiraz", "لیزر آقایان", "Men's Laser"),
    "beauty": SpecialtyInfo("beauty", "زیبایی", "Beauty"),
}


def get_city(slug: str) -> CityInfo | None:
    return CITIES.get((slug or "").strip().lower())


def get_specialty(slug: str) -> SpecialtyInfo | None:
    return SPECIALTIES.get((slug or "").strip().lower())


def list_cities() -> list[CityInfo]:
    return list(CITIES.values())


def list_specialties() -> list[SpecialtyInfo]:
    return list(SPECIALTIES.values())
