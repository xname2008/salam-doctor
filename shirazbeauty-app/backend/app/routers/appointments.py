"""Appointment slots, booking, and clinic-side management.

`GET /slots` builds a 30-minute grid for a clinic day, minus rows already
booked. `POST /book` writes a real appointment; `client_id` comes from the JWT,
never from the request body. `GET /clinic` and `PATCH /clinic/{id}/status` are
restricted to the signed-in clinic manager. A manager with no clinic
profile yet gets an empty list, not a 404.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_roles
from app.models import (
    Appointment,
    AppointmentStatus,
    ClinicProfile,
    Service,
    User,
    UserRole,
)
from app.schemas import (
    AppointmentBookRequest,
    AppointmentBookResponse,
    AppointmentRead,
    AppointmentStatusUpdate,
    AvailableSlotsResponse,
    CatalogClinic,
    CatalogService,
    ClientAppointmentRead,
    ClinicAppointmentRead,
    validate_jalali_date,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

DAY_START = time(9, 0)
DAY_END = time(17, 0)
SLOT_MINUTES = 30

DEMO_CATALOG: list[dict] = [
    {
        "manager_mobile": "09121111111",
        "clinic_name": "کلینیک زیبایی نهال",
        "address": "شیراز، معالی‌آباد، ساختمان پزشکان آرا، طبقه سوم",
        "contact_number": "07136251478",
        "services": [
            ("لیزر موهای زائد — فول بادی", 75, Decimal("4500000")),
            ("تزریق بوتاکس پیشانی", 45, Decimal("6200000")),
            ("هیدرافیشیال صورت", 45, Decimal("2900000")),
        ],
    },
    {
        "manager_mobile": "09122222222",
        "clinic_name": "کلینیک تخصصی پوست مهسا",
        "address": "شیراز، عفیف‌آباد، خیابان هدایت",
        "contact_number": "07136250011",
        "services": [
            ("تزریق ژل لب", 60, Decimal("7800000")),
            ("هایفو صورت", 90, Decimal("12500000")),
        ],
    },
]


def generate_day_slots(
    start: time = DAY_START,
    end: time = DAY_END,
    step_minutes: int = SLOT_MINUTES,
) -> list[str]:
    """Inclusive 30-minute grid, e.g. 09:00 … 17:00."""
    slots: list[str] = []
    cursor = datetime(2000, 1, 1, start.hour, start.minute)
    last = datetime(2000, 1, 1, end.hour, end.minute)
    delta = timedelta(minutes=step_minutes)
    while cursor <= last:
        slots.append(cursor.strftime("%H:%M"))
        cursor += delta
    return slots


WORKING_SLOTS = generate_day_slots()


def _parse_slot(slot: str) -> time:
    hour, minute = slot.split(":")
    return time(int(hour), int(minute))


def _add_minutes(start: time, minutes: int) -> time:
    # Anchor to a fixed civil day so midnight is never a factor — we only
    # care whether the duration still fits inside 00:00–23:59.
    base = datetime(2000, 1, 1)
    stamp = datetime.combine(base.date(), start) + timedelta(minutes=minutes)
    if stamp.date() != base.date():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="مدت این خدمت از پایان روز کاری عبور می‌کند.",
        )
    return stamp.time()


async def _ensure_demo_catalog(db: AsyncSession) -> None:
    """Idempotent sample clinics so the booking UI has something to select."""
    existing = await db.scalar(select(ClinicProfile.id).limit(1))
    if existing is not None:
        return

    for item in DEMO_CATALOG:
        manager = await db.scalar(
            select(User).where(User.mobile_number == item["manager_mobile"])
        )
        if manager is None:
            manager = User(
                mobile_number=item["manager_mobile"],
                role=UserRole.CLINIC_MANAGER,
            )
            db.add(manager)
            await db.flush()

        clinic = ClinicProfile(
            user_id=manager.id,
            clinic_name=item["clinic_name"],
            address=item["address"],
            contact_number=item["contact_number"],
            is_verified=True,
        )
        db.add(clinic)
        await db.flush()

        for name, duration, price in item["services"]:
            db.add(
                Service(
                    clinic_id=clinic.id,
                    service_name=name,
                    duration_minutes=duration,
                    price=price,
                )
            )

    try:
        await db.commit()
    except IntegrityError:
        # A concurrent request won the seed race; the catalog query below
        # will still see the rows the other request committed.
        await db.rollback()


@router.get(
    "/catalog",
    response_model=list[CatalogClinic],
    summary="Clinics and services available for booking",
)
async def booking_catalog(db: AsyncSession = Depends(get_db)) -> list[CatalogClinic]:
    await _ensure_demo_catalog(db)

    result = await db.scalars(
        select(ClinicProfile)
        .where(ClinicProfile.is_verified.is_(True))
        .options(selectinload(ClinicProfile.services))
        .order_by(ClinicProfile.clinic_name)
    )
    clinics = list(result)
    return [
        CatalogClinic(
            id=clinic.id,
            clinic_name=clinic.clinic_name,
            address=clinic.address,
            services=[
                CatalogService(
                    id=service.id,
                    service_name=service.service_name,
                    description=service.description,
                    duration_minutes=service.duration_minutes,
                    price=service.price,
                )
                for service in clinic.services
            ],
        )
        for clinic in clinics
        if clinic.services
    ]


@router.get(
    "/slots",
    response_model=AvailableSlotsResponse,
    summary="Available 30-minute slots for a clinic on a Jalali date",
)
async def list_slots(
    clinic_id: int = Query(ge=1),
    jalali_date: str = Query(examples=["1405-06-10"]),
    db: AsyncSession = Depends(get_db),
) -> AvailableSlotsResponse:
    date = validate_jalali_date(jalali_date)
    await _ensure_demo_catalog(db)

    clinic = await db.get(ClinicProfile, clinic_id)
    if clinic is None or not clinic.is_verified:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کلینیک مورد نظر یافت نشد.",
        )

    taken = await db.scalars(
        select(Appointment.start_time).where(
            Appointment.clinic_id == clinic_id,
            Appointment.jalali_date == date,
            Appointment.status != AppointmentStatus.CANCELLED,
        )
    )
    taken_slots = {row.strftime("%H:%M") for row in taken}

    return AvailableSlotsResponse(
        jalali_date=date,
        clinic_id=clinic_id,
        slots=[slot for slot in WORKING_SLOTS if slot not in taken_slots],
    )


@router.post(
    "/book",
    response_model=AppointmentBookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book a slot for the signed-in client",
)
async def book_appointment(
    payload: AppointmentBookRequest,
    current_user: User = Depends(require_roles(UserRole.CLIENT)),
    db: AsyncSession = Depends(get_db),
) -> AppointmentBookResponse:
    """`client_id` is taken from the access token, not the request body."""
    await _ensure_demo_catalog(db)

    if payload.time_slot not in WORKING_SLOTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="این ساعت در برنامه کاری مرکز نیست.",
        )

    clinic = await db.get(ClinicProfile, payload.clinic_id)
    if clinic is None or not clinic.is_verified:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کلینیک مورد نظر یافت نشد.",
        )

    service = await db.get(Service, payload.service_id)
    if service is None or service.clinic_id != payload.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="این خدمت در کلینیک انتخاب‌شده ارائه نمی‌شود.",
        )

    start = _parse_slot(payload.time_slot)
    end = _add_minutes(start, service.duration_minutes)

    appointment = Appointment(
        clinic_id=payload.clinic_id,
        client_id=current_user.id,
        service_id=payload.service_id,
        jalali_date=payload.jalali_date,
        start_time=start,
        end_time=end,
        status=AppointmentStatus.PENDING,
    )
    db.add(appointment)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این ساعت قبلا رزرو شده است. زمان دیگری انتخاب کنید.",
        ) from exc

    await db.refresh(appointment)

    return AppointmentBookResponse(
        message="نوبت شما با موفقیت ثبت شد و در انتظار تایید مرکز است.",
        appointment=AppointmentRead.model_validate(appointment),
    )


# Statuses a manager may move *to* from a given current status.
# CANCELLED and COMPLETED are terminal; reopening a cancelled slot would
# collide with the partial unique index if someone else already took it.
_ALLOWED_STATUS_TRANSITIONS: dict[AppointmentStatus, frozenset[AppointmentStatus]] = {
    AppointmentStatus.PENDING: frozenset(
        {
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.COMPLETED,
        }
    ),
    AppointmentStatus.CONFIRMED: frozenset(
        {
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
        }
    ),
    AppointmentStatus.COMPLETED: frozenset(),
    AppointmentStatus.CANCELLED: frozenset(),
}


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


_CLINIC_APPOINTMENT_LOAD = (
    selectinload(Appointment.client),
    selectinload(Appointment.service),
)
_CLIENT_APPOINTMENT_LOAD = (
    selectinload(Appointment.clinic),
    selectinload(Appointment.service),
)


def _client_appointment_read(row: Appointment) -> ClientAppointmentRead:
    return ClientAppointmentRead(
        id=row.id,
        clinic_id=row.clinic_id,
        jalali_date=row.jalali_date,
        time_slot=row.start_time.strftime("%H:%M"),
        start_time=row.start_time,
        end_time=row.end_time,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        clinic=row.clinic,
        service=row.service,
    )


@router.get(
    "/clinic",
    response_model=list[ClinicAppointmentRead],
    summary="All appointments for the signed-in clinic manager",
)
async def list_clinic_appointments(
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> list[ClinicAppointmentRead]:
    clinic = await _find_clinic(db, current_user)
    if clinic is None:
        return []

    result = await db.scalars(
        select(Appointment)
        .where(Appointment.clinic_id == clinic.id)
        .options(*_CLINIC_APPOINTMENT_LOAD)
        .order_by(Appointment.jalali_date.asc(), Appointment.start_time.asc())
    )
    return [_clinic_appointment_read(row) for row in result]


@router.get(
    "/me",
    response_model=list[ClientAppointmentRead],
    summary="Appointments belonging to the signed-in client",
)
async def list_my_appointments(
    current_user: User = Depends(require_roles(UserRole.CLIENT)),
    db: AsyncSession = Depends(get_db),
) -> list[ClientAppointmentRead]:
    result = await db.scalars(
        select(Appointment)
        .where(Appointment.client_id == current_user.id)
        .options(*_CLIENT_APPOINTMENT_LOAD)
        .order_by(Appointment.jalali_date.asc(), Appointment.start_time.asc())
    )
    return [_client_appointment_read(row) for row in result]


@router.patch(
    "/client/{appointment_id}/cancel",
    response_model=ClientAppointmentRead,
    summary="Cancel an appointment as the signed-in client",
)
async def cancel_own_appointment(
    appointment_id: int = Path(ge=1),
    current_user: User = Depends(require_roles(UserRole.CLIENT)),
    db: AsyncSession = Depends(get_db),
) -> ClientAppointmentRead:
    appointment = await db.scalar(
        select(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.client_id == current_user.id,
        )
        .options(*_CLIENT_APPOINTMENT_LOAD)
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="نوبت مورد نظر یافت نشد.",
        )

    if appointment.status == AppointmentStatus.CANCELLED:
        return _client_appointment_read(appointment)

    if appointment.status not in (
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="این نوبت قابل لغو نیست.",
        )

    appointment.status = AppointmentStatus.CANCELLED
    await db.commit()

    refreshed = await db.scalar(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(*_CLIENT_APPOINTMENT_LOAD)
    )
    assert refreshed is not None
    return _client_appointment_read(refreshed)


@router.patch(
    "/clinic/{appointment_id}/status",
    response_model=ClinicAppointmentRead,
    summary="Update an appointment's status as the owning clinic",
)
async def update_clinic_appointment_status(
    payload: AppointmentStatusUpdate,
    appointment_id: int = Path(ge=1),
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ClinicAppointmentRead:
    return await _update_owned_appointment_status(
        payload, appointment_id, current_user, db
    )


@router.patch(
    "/{appointment_id}/status",
    response_model=ClinicAppointmentRead,
    summary="Update an appointment's status",
    deprecated=True,
)
async def update_appointment_status(
    payload: AppointmentStatusUpdate,
    appointment_id: int = Path(ge=1),
    current_user: User = Depends(require_roles(UserRole.CLINIC_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ClinicAppointmentRead:
    return await _update_owned_appointment_status(
        payload, appointment_id, current_user, db
    )


async def _update_owned_appointment_status(
    payload: AppointmentStatusUpdate,
    appointment_id: int,
    current_user: User,
    db: AsyncSession,
) -> ClinicAppointmentRead:
    clinic = await _find_clinic(db, current_user)
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="نوبت مورد نظر یافت نشد.",
        )

    appointment = await db.scalar(
        select(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.clinic_id == clinic.id,
        )
        .options(*_CLINIC_APPOINTMENT_LOAD)
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="نوبت مورد نظر یافت نشد.",
        )

    if payload.status == appointment.status:
        return _clinic_appointment_read(appointment)

    allowed = _ALLOWED_STATUS_TRANSITIONS[appointment.status]
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="تغییر این وضعیت مجاز نیست.",
        )

    appointment.status = payload.status

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این ساعت قبلا رزرو شده است.",
        ) from exc

    refreshed = await db.scalar(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(*_CLINIC_APPOINTMENT_LOAD)
    )
    assert refreshed is not None
    return _clinic_appointment_read(refreshed)
