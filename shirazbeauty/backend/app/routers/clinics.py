"""Clinic directory: public browsing, owner registration, and manager stats."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_roles
from app.models import Appointment, AppointmentStatus, ClinicProfile, User, UserRole
from app.schemas import (
    ClinicAppointmentRead,
    ClinicMeResponse,
    ClinicProfileCreateRequest,
    ClinicProfileRead,
    ClinicStatsResponse,
    PublicClinicListItem,
    PublicClinicProfile,
    PublicClinicService,
)
from app.utils.jalali import TEHRAN, today_jalali_key

router = APIRouter(prefix="/clinics", tags=["clinics"])

_REVENUE_STATUSES = (AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED)
_UPCOMING_STATUSES = (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)


async def _find_clinic(db: AsyncSession, manager: User) -> ClinicProfile | None:
    return await db.scalar(
        select(ClinicProfile).where(ClinicProfile.user_id == manager.id)
    )


def _clinic_appointment_read(row: Appointment) -> ClinicAppointmentRead:
    return ClinicAppointmentRead(
        id=row.id,
        clinic_id=row.clinic_id,
        jalali_date=row.jalali_date,
        time_slot=row.start_time.strftime("%H:%M"),
        start_time=row.start_time,
        end_time=row.end_time,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        client=row.client,
        service=row.service,
    )


@router.get(
    "/me/stats",
    response_model=ClinicStatsResponse,
    summary="Overview metrics for the signed-in clinic manager",
)
async def clinic_stats(
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ClinicStatsResponse:
    clinic = await _find_clinic(db, current_user)
    today = today_jalali_key()
    if clinic is None:
        return ClinicStatsResponse(
            jalali_date=today,
            today_appointments=0,
            pending_count=0,
            estimated_revenue=0,
            upcoming=[],
        )
    now_time = datetime.now(tz=TEHRAN).time()

    pending_count = await db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.clinic_id == clinic.id,
            Appointment.status == AppointmentStatus.PENDING,
        )
    )

    today_rows = list(
        await db.scalars(
            select(Appointment)
            .where(
                Appointment.clinic_id == clinic.id,
                Appointment.jalali_date == today,
            )
            .options(
                selectinload(Appointment.client),
                selectinload(Appointment.service),
            )
            .order_by(Appointment.start_time.asc())
        )
    )

    active_today = [
        row for row in today_rows if row.status != AppointmentStatus.CANCELLED
    ]
    estimated_revenue = sum(
        int(row.service.price)
        for row in active_today
        if row.status in _REVENUE_STATUSES
    )
    upcoming_source = [
        row
        for row in active_today
        if row.status in _UPCOMING_STATUSES and row.start_time >= now_time
    ]
    # After hours, still show today's pending/confirmed so the board is not empty.
    if not upcoming_source:
        upcoming_source = [
            row for row in active_today if row.status in _UPCOMING_STATUSES
        ]

    return ClinicStatsResponse(
        jalali_date=today,
        today_appointments=len(active_today),
        pending_count=int(pending_count or 0),
        estimated_revenue=estimated_revenue,
        upcoming=[_clinic_appointment_read(row) for row in upcoming_source[:5]],
    )


@router.get(
    "/me",
    response_model=ClinicMeResponse,
    summary="The signed-in manager's clinic profile",
)
async def get_my_clinic(
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ClinicMeResponse:
    clinic = await _find_clinic(db, current_user)
    if clinic is None:
        return ClinicMeResponse(user_id=current_user.id)
    return ClinicMeResponse.model_validate(clinic)


@router.put(
    "/me",
    response_model=ClinicProfileRead,
    summary="Create or update the signed-in manager's clinic profile",
)
async def upsert_my_clinic(
    payload: ClinicProfileCreateRequest,
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ClinicProfile:
    clinic = await _find_clinic(db, current_user)
    fields = payload.model_dump()

    if clinic is None:
        clinic = ClinicProfile(user_id=current_user.id, **fields)
        db.add(clinic)
    else:
        clinic.clinic_name = fields["clinic_name"]
        clinic.address = fields["address"]
        clinic.contact_number = fields["contact_number"]

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="برای این حساب قبلا یک مرکز ثبت شده است.",
        ) from exc

    await db.refresh(clinic)
    return clinic


def _public_description(clinic: ClinicProfile) -> str:
    """SEO-ready bio — prefer the stored clinic bio when present."""
    stored = (clinic.description or "").strip()
    if stored:
        return stored

    names = [row.service_name for row in clinic.services]
    intro = (
        f"{clinic.clinic_name} در {clinic.address} آماده پذیرش زیباجویان شیراز است."
    )
    if not names:
        return f"{intro} نوبت خود را به‌صورت آنلاین از طریق شیراز بیوتی رزرو کنید."

    listed = "، ".join(names[:4])
    extra = " و سایر خدمات تخصصی" if len(names) > 4 else ""
    return (
        f"{intro} خدمات این مرکز شامل {listed}{extra} می‌شود. "
        "رزرو نوبت آنلاین در کمتر از یک دقیقه از طریق شیراز بیوتی."
    )


def _public_list_item(clinic: ClinicProfile) -> PublicClinicListItem:
    prices = [int(row.price) for row in clinic.services]
    return PublicClinicListItem(
        id=clinic.id,
        clinic_name=clinic.clinic_name,
        address=clinic.address,
        contact_number=clinic.contact_number,
        is_verified=clinic.is_verified,
        service_count=len(clinic.services),
        starting_price=min(prices) if prices else None,
    )


@router.get(
    "/public",
    response_model=list[PublicClinicListItem],
    summary="Public directory of verified clinics",
)
async def list_public_clinics(
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None, min_length=2, max_length=160),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[PublicClinicListItem]:
    """Active (verified) clinics for the homepage and search directory. No JWT."""
    stmt = (
        select(ClinicProfile)
        .where(ClinicProfile.is_verified.is_(True))
        .options(selectinload(ClinicProfile.services))
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                ClinicProfile.clinic_name.ilike(pattern),
                ClinicProfile.address.ilike(pattern),
            )
        )

    stmt = stmt.order_by(ClinicProfile.clinic_name.asc()).offset(skip).limit(limit)
    clinics = list(await db.scalars(stmt))
    return [_public_list_item(clinic) for clinic in clinics]


@router.get(
    "/public/{clinic_id}",
    response_model=PublicClinicProfile,
    summary="Public clinic landing page",
)
async def get_public_clinic(
    clinic_id: int = Path(ge=1),
    db: AsyncSession = Depends(get_db),
) -> PublicClinicProfile:
    """Verified clinic plus nested services. No JWT — this is a landing page."""
    clinic = await db.scalar(
        select(ClinicProfile)
        .where(
            ClinicProfile.id == clinic_id,
            ClinicProfile.is_verified.is_(True),
        )
        .options(selectinload(ClinicProfile.services))
    )
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کلینیک مورد نظر یافت نشد.",
        )

    services = sorted(clinic.services, key=lambda row: row.service_name)
    return PublicClinicProfile(
        id=clinic.id,
        clinic_name=clinic.clinic_name,
        address=clinic.address,
        contact_number=clinic.contact_number,
        description=_public_description(clinic),
        is_verified=clinic.is_verified,
        services=[
            PublicClinicService(
                id=row.id,
                service_name=row.service_name,
                description=row.description,
                duration_minutes=row.duration_minutes,
                price=row.price,
            )
            for row in services
        ],
    )


@router.get(
    "/",
    response_model=list[ClinicProfileRead],
    summary="List verified clinics",
)
async def list_clinics(
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None, min_length=2, max_length=160),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[ClinicProfile]:
    """Public directory listing.

    Only verified clinics are returned — an unverified profile is visible to
    its own manager through the dashboard, but never in the public directory.
    """
    stmt = select(ClinicProfile).where(ClinicProfile.is_verified.is_(True))

    if search:
        stmt = stmt.where(ClinicProfile.clinic_name.ilike(f"%{search}%"))

    stmt = stmt.order_by(ClinicProfile.created_at.desc()).offset(skip).limit(limit)

    result = await db.scalars(stmt)
    return list(result)


@router.post(
    "/",
    response_model=ClinicProfileRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a clinic profile",
)
async def create_clinic(
    payload: ClinicProfileCreateRequest,
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ClinicProfile:
    """Create the calling manager's clinic.

    The profile starts unverified; an admin approves it after checking the
    operating licence, which is what makes it appear in `GET /clinics/`.
    """
    existing = await db.scalar(
        select(ClinicProfile).where(ClinicProfile.user_id == current_user.id)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="برای این حساب قبلا یک مرکز ثبت شده است.",
        )

    clinic = ClinicProfile(user_id=current_user.id, **payload.model_dump())
    db.add(clinic)

    try:
        await db.commit()
    except IntegrityError as exc:
        # The unique constraint on user_id is the last line of defence if two
        # requests slip past the check above at the same time.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="برای این حساب قبلا یک مرکز ثبت شده است.",
        ) from exc

    await db.refresh(clinic)
    return clinic
