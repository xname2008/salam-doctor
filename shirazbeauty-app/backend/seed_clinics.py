#!/usr/bin/env python3
"""Seed verified Shiraz clinics from the Book2 Excel workbook.

Reads the ``contact`` sheet to create clinic managers + profiles, then the
``service`` sheet to attach bookable services. Safe to run multiple times:
existing clinics are updated in place and duplicate services are skipped.

Usage (from the host, DB exposed on localhost:5442):

    cd backend
    DATABASE_URL=postgresql+asyncpg://shirazbeauty:shirazbeauty@localhost:5442/shirazbeauty \\
        ./venv/bin/python seed_clinics.py \\
        --file "/home/ubuntu/salam-doctor/shirazbeauty-data/uploads/Book2 (7).xlsx"

Inside the API container (copy the workbook first or mount the data volume):

    docker cp "/path/to/Book2 (7).xlsx" shirazbeauty-app-api:/tmp/book.xlsx
    docker exec shirazbeauty-app-api python seed_clinics.py --file /tmp/book.xlsx
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from decimal import Decimal
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models import ClinicProfile, Service, User, UserRole

CONTACT_SHEET = "contact"
SERVICE_SHEET = "service"

CONTACT_NAME_COL = "نام مرکز"
CONTACT_ADDRESS_COL = "آدرس"
CONTACT_PHONE_COL = "شماره‌تماس"
CONTACT_DESC_COL = "Unnamed: 3"

SERVICE_CLINIC_COL = "نام کلینیک"

SERVICE_COLUMNS = [
    "پوست ودرمان",
    "کاشت طبیعی",
    "تزریقات چهره و بدن",
    "لیفت و زیبایی",
    "کلینیک لیزر",
    "لاغری و پیکر تراشی",
    "جراحی زیبایی",
    "تقویت و جلوگیری از ریزش مو",
]

SKIP_SERVICE_VALUES = frozenset({"", "ندارد", "دارد", "nan", "none", "null"})

DEFAULT_EXCEL_PATHS = [
    Path(__file__).resolve().parent.parent.parent
    / "shirazbeauty-data/uploads/Book2 (7).xlsx",
    Path(__file__).resolve().parent / "Book2 (7).xlsx",
]


def _normalize_name(value: object) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    for prefix in ("کلینیک ", "مرکز ", "سالن "):
        if text.startswith(prefix):
            text = text[len(prefix) :].strip()
    return text


def _clean_cell(value: object) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.lower() in SKIP_SERVICE_VALUES:
        return None
    return text


def _mock_mobile(clinic_name: str) -> str:
    """Deterministic 11-digit Iranian mobile for idempotent re-runs."""
    digest = hashlib.sha256(clinic_name.encode("utf-8")).digest()
    digits = "".join(str(byte % 10) for byte in digest[:9])
    return f"09{digits}"


def _mock_price(service_name: str, description: str) -> Decimal:
    seed = f"{service_name}:{description}".encode("utf-8")
    amount = 500_000 + (int(hashlib.md5(seed).hexdigest(), 16) % 4_500_000)
    return Decimal(amount - (amount % 50_000))


def _mock_duration(service_name: str) -> int:
    digest = hashlib.sha256(service_name.encode("utf-8")).digest()
    options = (30, 45, 60, 90, 120)
    return options[digest[0] % len(options)]


def _truncate_phone(value: str, max_len: int = 120) -> str:
    cleaned = re.sub(r"\s+", " ", value.strip())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 1] + "…"


def _resolve_excel_path(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).expanduser().resolve()
        if not path.is_file():
            raise FileNotFoundError(f"Excel file not found: {path}")
        return path

    for candidate in DEFAULT_EXCEL_PATHS:
        if candidate.is_file():
            return candidate

    searched = "\n  ".join(str(path) for path in DEFAULT_EXCEL_PATHS)
    raise FileNotFoundError(
        "Excel workbook not found. Pass --file explicitly. Tried:\n  " + searched
    )


def _find_clinic_by_name(
    session: Session, clinic_name: str
) -> ClinicProfile | None:
    exact = session.scalar(
        select(ClinicProfile).where(ClinicProfile.clinic_name == clinic_name)
    )
    if exact:
        return exact

    target = _normalize_name(clinic_name)
    for clinic in session.scalars(select(ClinicProfile)).all():
        if _normalize_name(clinic.clinic_name) == target:
            return clinic
    return None


def _upsert_clinic(
    session: Session,
    *,
    clinic_name: str,
    address: str,
    contact_number: str,
    description: str | None,
) -> tuple[ClinicProfile, bool]:
    clinic = _find_clinic_by_name(session, clinic_name)
    if clinic:
        clinic.address = address
        clinic.contact_number = contact_number
        clinic.description = description
        clinic.is_verified = True
        return clinic, False

    mobile = _mock_mobile(clinic_name)
    existing_user = session.scalar(
        select(User).where(User.mobile_number == mobile)
    )
    if existing_user:
        user = existing_user
        user.role = UserRole.CLINIC_MANAGER
    else:
        user = User(mobile_number=mobile, role=UserRole.CLINIC_MANAGER)
        session.add(user)
        session.flush()

    clinic = ClinicProfile(
        user_id=user.id,
        clinic_name=clinic_name,
        address=address,
        contact_number=contact_number,
        description=description,
        is_verified=True,
    )
    session.add(clinic)
    session.flush()
    return clinic, True


def _existing_service_names(session: Session, clinic_id: int) -> set[str]:
    rows = session.scalars(
        select(Service.service_name).where(Service.clinic_id == clinic_id)
    ).all()
    return set(rows)


def seed_from_excel(session: Session, excel_path: Path) -> dict[str, int]:
    contact_df = pd.read_excel(excel_path, sheet_name=CONTACT_SHEET)
    service_df = pd.read_excel(excel_path, sheet_name=SERVICE_SHEET)

    stats = {
        "clinics_created": 0,
        "clinics_updated": 0,
        "services_created": 0,
        "services_skipped": 0,
    }

    clinics_by_index: list[ClinicProfile] = []

    for _, row in contact_df.iterrows():
        clinic_name = _clean_cell(row.get(CONTACT_NAME_COL))
        if not clinic_name:
            continue

        address = _clean_cell(row.get(CONTACT_ADDRESS_COL)) or "شیراز"
        phone_raw = _clean_cell(row.get(CONTACT_PHONE_COL)) or _mock_mobile(clinic_name)
        phone = _truncate_phone(phone_raw)
        description = _clean_cell(row.get(CONTACT_DESC_COL))

        clinic, created = _upsert_clinic(
            session,
            clinic_name=clinic_name,
            address=address,
            contact_number=phone,
            description=description,
        )
        clinics_by_index.append(clinic)
        if created:
            stats["clinics_created"] += 1
        else:
            stats["clinics_updated"] += 1

    session.flush()

    for index, service_row in service_df.iterrows():
        service_clinic_name = _clean_cell(service_row.get(SERVICE_CLINIC_COL))
        clinic: ClinicProfile | None = None

        if isinstance(index, int) and 0 <= index < len(clinics_by_index):
            clinic = clinics_by_index[index]

        if clinic is None and service_clinic_name:
            clinic = _find_clinic_by_name(session, service_clinic_name)

        if clinic is None:
            continue

        existing_names = _existing_service_names(session, clinic.id)

        for column in SERVICE_COLUMNS:
            if column not in service_df.columns:
                continue

            description = _clean_cell(service_row.get(column))
            if not description:
                stats["services_skipped"] += 1
                continue

            if column in existing_names:
                stats["services_skipped"] += 1
                continue

            session.add(
                Service(
                    clinic_id=clinic.id,
                    service_name=column,
                    description=description,
                    duration_minutes=_mock_duration(column),
                    price=_mock_price(column, description),
                )
            )
            existing_names.add(column)
            stats["services_created"] += 1

    session.commit()
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Shiraz clinic directory data.")
    parser.add_argument(
        "--file",
        dest="excel_file",
        help="Path to Book2 Excel workbook (defaults to shirazbeauty-data/uploads/).",
    )
    args = parser.parse_args()

    try:
        excel_path = _resolve_excel_path(args.excel_file)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1

    engine = create_engine(settings.database_url_sync, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    print(f"Reading {excel_path}")
    with SessionLocal() as session:
        stats = seed_from_excel(session, excel_path)

    print(
        "Done. "
        f"clinics created={stats['clinics_created']}, "
        f"updated={stats['clinics_updated']}, "
        f"services created={stats['services_created']}, "
        f"skipped={stats['services_skipped']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
