"""Load clinic records from catalog JS + SQLite (+ optional Postgres reviews)."""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import Any

from .config import SeoConfig
from .models import ClinicRecord, ReviewSummary

_CATALOG_RE = re.compile(
    r"const\s+clinicsData\s*=\s*(\[.*?\])\s*;",
    re.DOTALL,
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value: str | None, max_len: int = 500) -> str | None:
    if not value:
        return None
    text = unescape(_HTML_TAG_RE.sub(" ", value))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    return text[:max_len] if len(text) > max_len else text


def _parse_services(raw: Any) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                label = item.strip()
                if label and label != "دارد":
                    out.append(label)
            elif isinstance(item, dict):
                label = (item.get("label") or item.get("name") or "").strip()
                if label:
                    out.append(label)
    return out


def _infer_specialty(services: list[str]) -> str | None:
    if not services:
        return None
    keywords = {
        "کاشت مو": "کاشت مو و ابرو",
        "لیزر": "لیزر و زیبایی",
        "بوتاکس": "تزریقات زیبایی",
        "پوست": "درمان پوست",
    }
    joined = " ".join(services)
    for key, label in keywords.items():
        if key in joined:
            return label
    return services[0][:80]


class ClinicRepository:
    """Read-only repository merging static catalog with SQLite overlays."""

    def __init__(self, config: SeoConfig | None = None) -> None:
        self.config = config or SeoConfig()

    def load_catalog(self) -> list[dict[str, Any]]:
        path = self.config.catalog_js_path
        if not path or not path.exists():
            return []
        text = path.read_text(encoding="utf-8")
        match = _CATALOG_RE.search(text)
        if not match:
            return []
        return json.loads(match.group(1))

    def _load_overlay(self, conn: sqlite3.Connection, clinic_id: int) -> dict[str, Any] | None:
        row = conn.execute(
            """
            SELECT clinic_id, intro, contact_info, address, latitude, longitude,
                   services_json, updated_at
            FROM clinic_profiles
            WHERE clinic_id = ?
            """,
            (clinic_id,),
        ).fetchone()
        if not row:
            return None
        keys = [
            "clinic_id",
            "intro",
            "contact_info",
            "address",
            "latitude",
            "longitude",
            "services_json",
            "updated_at",
        ]
        data = dict(zip(keys, row))
        if data.get("contact_info"):
            try:
                data["contact_info"] = json.loads(data["contact_info"])
            except json.JSONDecodeError:
                data["contact_info"] = {}
        if data.get("services_json"):
            try:
                data["services_json"] = json.loads(data["services_json"])
            except json.JSONDecodeError:
                data["services_json"] = []
        return data

    def _load_reviews_sqlite(
        self, conn: sqlite3.Connection, clinic_id: int
    ) -> ReviewSummary | None:
        """Optional table `clinic_reviews` — created by migration if needed."""
        try:
            row = conn.execute(
                """
                SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt
                FROM clinic_reviews
                WHERE clinic_id = ? AND published = 1
                """,
                (clinic_id,),
            ).fetchone()
        except sqlite3.OperationalError:
            return None
        if not row or not row[1]:
            return None
        avg_rating, count = float(row[0]), int(row[1])
        if count <= 0:
            return None
        return ReviewSummary(
            rating_value=round(avg_rating, 1),
            review_count=count,
        )

    def _reviews_from_catalog(self, raw: dict[str, Any]) -> ReviewSummary | None:
        rating = raw.get("ratingValue", raw.get("rating"))
        count = raw.get("reviewCount", raw.get("ratingCount", raw.get("reviewsCount")))
        if rating is None or count is None:
            return None
        try:
            rating_f = float(rating)
            count_i = int(count)
        except (TypeError, ValueError):
            return None
        if count_i <= 0:
            return None
        return ReviewSummary(rating_value=rating_f, review_count=count_i)

    def _merge_record(
        self, catalog: dict[str, Any], overlay: dict[str, Any] | None
    ) -> ClinicRecord | None:
        clinic_id = catalog.get("id")
        if clinic_id is None:
            return None
        try:
            clinic_id = int(clinic_id)
        except (TypeError, ValueError):
            return None

        name = (
            (catalog.get("name") or catalog.get("sliderTitle") or f"مرکز {clinic_id}")
            .strip()
        )
        if not name:
            return None

        contact = catalog.get("contact_info") or {}
        if overlay and overlay.get("contact_info"):
            contact = {**contact, **overlay["contact_info"]}

        phone = (
            (contact.get("phone") if isinstance(contact, dict) else None)
            or catalog.get("phone")
        )
        if phone:
            phone = str(phone).strip() or None

        services = _parse_services(catalog.get("services"))
        if overlay and overlay.get("services_json"):
            services = _parse_services(overlay["services_json"]) or services

        address = (
            (overlay or {}).get("address")
            or catalog.get("address")
            or catalog.get("sliderTagline")
        )
        if address:
            address = str(address).strip() or None

        intro = _strip_html((overlay or {}).get("intro"))
        description = intro or None

        lat = (overlay or {}).get("latitude", catalog.get("latitude"))
        lng = (overlay or {}).get("longitude", catalog.get("longitude"))
        try:
            latitude = float(lat) if lat is not None else None
            longitude = float(lng) if lng is not None else None
        except (TypeError, ValueError):
            latitude = longitude = None

        updated_raw = (overlay or {}).get("updated_at")
        updated_at = None
        if updated_raw:
            try:
                updated_at = datetime.fromisoformat(str(updated_raw).replace("Z", "+00:00"))
            except ValueError:
                updated_at = None

        reviews = self._reviews_from_catalog(catalog)

        extra = catalog.get("extra") if isinstance(catalog.get("extra"), dict) else {}
        district = catalog.get("district") or extra.get("district")
        if isinstance(district, dict):
            district = district.get("name") or district.get("slug")
        city = (
            catalog.get("city")
            or catalog.get("cityFa")
            or extra.get("city")
            or (overlay or {}).get("city")
        )
        neighborhood = (
            catalog.get("neighborhood")
            or catalog.get("mahalle")
            or district
            or extra.get("neighborhood")
            or (overlay or {}).get("neighborhood")
        )

        return ClinicRecord(
            id=clinic_id,
            name=name,
            phone=phone,
            address=address,
            specialty=_infer_specialty(services),
            services=services,
            description=description,
            image=catalog.get("image"),
            url_path=self.config.clinic_profile_path(clinic_id),
            latitude=latitude,
            longitude=longitude,
            city=str(city).strip() if city else None,
            neighborhood=str(neighborhood).strip() if neighborhood else None,
            reviews=reviews,
            updated_at=updated_at,
        )

    def get_by_id(self, clinic_id: int) -> ClinicRecord | None:
        catalog_rows = self.load_catalog()
        catalog = next((c for c in catalog_rows if c.get("id") == clinic_id), None)
        if not catalog:
            return None

        overlay = None
        db_path = self.config.sqlite_path
        if db_path and db_path.exists():
            conn = sqlite3.connect(str(db_path))
            try:
                overlay = self._load_overlay(conn, clinic_id)
                reviews = self._load_reviews_sqlite(conn, clinic_id)
            finally:
                conn.close()
        else:
            reviews = None

        record = self._merge_record(catalog, overlay)
        if record and reviews:
            record.reviews = reviews
        return record

    def list_all(self) -> list[ClinicRecord]:
        catalog_rows = self.load_catalog()
        overlays: dict[int, dict[str, Any]] = {}
        review_map: dict[int, ReviewSummary] = {}

        db_path = self.config.sqlite_path
        if db_path and db_path.exists():
            conn = sqlite3.connect(str(db_path))
            try:
                for row in conn.execute(
                    """
                    SELECT clinic_id, intro, contact_info, address, latitude, longitude,
                           services_json, updated_at
                    FROM clinic_profiles
                    """
                ):
                    keys = [
                        "clinic_id",
                        "intro",
                        "contact_info",
                        "address",
                        "latitude",
                        "longitude",
                        "services_json",
                        "updated_at",
                    ]
                    data = dict(zip(keys, row))
                    cid = int(data["clinic_id"])
                    if data.get("contact_info"):
                        try:
                            data["contact_info"] = json.loads(data["contact_info"])
                        except json.JSONDecodeError:
                            data["contact_info"] = {}
                    if data.get("services_json"):
                        try:
                            data["services_json"] = json.loads(data["services_json"])
                        except json.JSONDecodeError:
                            data["services_json"] = []
                    overlays[cid] = data
                    rev = self._load_reviews_sqlite(conn, cid)
                    if rev:
                        review_map[cid] = rev
            finally:
                conn.close()

        records: list[ClinicRecord] = []
        for catalog in catalog_rows:
            cid = catalog.get("id")
            if cid is None:
                continue
            try:
                cid = int(cid)
            except (TypeError, ValueError):
                continue
            record = self._merge_record(catalog, overlays.get(cid))
            if not record:
                continue
            if cid in review_map:
                record.reviews = review_map[cid]
            records.append(record)
        return sorted(records, key=lambda r: r.id)
