"""Pydantic v2 schemas — the request/response contract for the API.

Split per model into `Base` (shared fields), `Create`, `Update` (all fields
optional for PATCH) and `Read` (what the API returns).
"""

import re
from datetime import datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from app.models import AppointmentStatus, UserRole

MOBILE_PATTERN = re.compile(r"^09\d{9}$")
JALALI_DATE_PATTERN = re.compile(r"^1[34]\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")

# Persian (۰-۹) and Arabic-Indic (٠-٩) digits, in order.
_DIGIT_TRANSLATION = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalise_digits(value: str) -> str:
    """Persian keyboards produce ۰۹۱۲…; the database only ever stores 0912…"""
    return value.translate(_DIGIT_TRANSLATION)


# Plain functions rather than shared validator methods: a `field_validator` is
# a descriptor proxy in Pydantic v2 and cannot be reliably called from another
# model's validator.


def validate_mobile(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError("mobile_number must be a string")
    cleaned = normalise_digits(value).strip().replace(" ", "").replace("-", "")
    if not MOBILE_PATTERN.match(cleaned):
        raise ValueError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود")
    return cleaned


def validate_jalali_date(value: object) -> str:
    cleaned = normalise_digits(str(value)).strip()
    if not JALALI_DATE_PATTERN.match(cleaned):
        raise ValueError("تاریخ باید به قالب شمسی YYYY-MM-DD باشد، مثلا 1405-06-09")
    return cleaned


class ORMModel(BaseModel):
    """Base for response schemas read directly off SQLAlchemy instances."""

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# User
# --------------------------------------------------------------------------- #


class UserBase(BaseModel):
    mobile_number: str = Field(examples=["09123456789"])
    role: UserRole = UserRole.CLIENT

    @field_validator("mobile_number", mode="before")
    @classmethod
    def _clean_mobile(cls, value: object) -> str:
        return validate_mobile(value)


class UserCreate(UserBase):
    # Optional because the default sign-in path is mobile OTP, not a password.
    password: str | None = Field(default=None, min_length=8, max_length=72)


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None


class UserRead(ORMModel):
    id: int
    mobile_number: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Clinic profile
# --------------------------------------------------------------------------- #


class ClinicProfileBase(BaseModel):
    clinic_name: str = Field(min_length=2, max_length=160)
    address: str = Field(min_length=5)
    contact_number: str = Field(max_length=120)

    @field_validator("contact_number", mode="before")
    @classmethod
    def _clean_contact(cls, value: object) -> str:
        return normalise_digits(str(value)).strip()


class ClinicProfileCreate(ClinicProfileBase):
    user_id: int


class ClinicProfileCreateRequest(ClinicProfileBase):
    """Body for `POST /clinics/` and `PUT /clinics/me`.

    Deliberately has no `user_id` or `is_verified`: the owner is taken from the
    access token so a caller cannot register a clinic under someone else's
    name, and verification is an admin action.
    """


class ClinicProfileUpdate(BaseModel):
    clinic_name: str | None = Field(default=None, min_length=2, max_length=160)
    address: str | None = Field(default=None, min_length=5)
    contact_number: str | None = Field(default=None, max_length=20)
    # Admin-only; never accept this from a clinic manager's own request body.
    is_verified: bool | None = None


class ClinicProfileRead(ORMModel):
    id: int
    user_id: int
    clinic_name: str
    address: str
    contact_number: str
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class ClinicMeResponse(BaseModel):
    """`GET /clinics/me` — empty strings when the manager has not saved a profile yet."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    user_id: int
    clinic_name: str = ""
    address: str = ""
    contact_number: str = ""
    is_verified: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PublicClinicService(ORMModel):
    """A bookable service on the public clinic landing page."""

    id: int
    service_name: str
    description: str | None = None
    duration_minutes: int
    price: Decimal

    @field_serializer("price")
    def _price_as_int(self, value: Decimal) -> int:
        return int(value)


class PublicClinicProfile(BaseModel):
    """`GET /clinics/public/{id}` — verified clinic plus its services.

    `description` is composed for SEO until clinics store a dedicated bio.
    """

    id: int
    clinic_name: str
    address: str
    contact_number: str
    description: str
    is_verified: bool
    services: list[PublicClinicService]


class PublicClinicListItem(BaseModel):
    """`GET /clinics/public` — card row for the directory and homepage grid."""

    id: int
    clinic_name: str
    address: str
    contact_number: str
    is_verified: bool
    service_count: int
    starting_price: int | None = None


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #


class ServiceBase(BaseModel):
    service_name: str = Field(min_length=2, max_length=160)
    duration_minutes: int = Field(gt=0, le=480)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=0)


class ServiceCreate(ServiceBase):
    clinic_id: int


class ServiceUpdate(BaseModel):
    service_name: str | None = Field(default=None, min_length=2, max_length=160)
    duration_minutes: int | None = Field(default=None, gt=0, le=480)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=0)


class ServiceRead(ORMModel):
    id: int
    clinic_id: int
    service_name: str
    duration_minutes: int
    price: Decimal
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Appointment
# --------------------------------------------------------------------------- #


class AppointmentBase(BaseModel):
    jalali_date: str = Field(examples=["1405-06-09"])
    start_time: time
    end_time: time

    @field_validator("jalali_date", mode="before")
    @classmethod
    def _clean_jalali_date(cls, value: object) -> str:
        return validate_jalali_date(value)

    @model_validator(mode="after")
    def _check_time_order(self) -> "AppointmentBase":
        if self.end_time <= self.start_time:
            raise ValueError("ساعت پایان باید بعد از ساعت شروع باشد")
        return self


class AppointmentCreate(AppointmentBase):
    clinic_id: int
    client_id: int
    service_id: int


SLOT_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def validate_time_slot(value: object) -> str:
    cleaned = normalise_digits(str(value)).strip()
    if not SLOT_PATTERN.match(cleaned):
        raise ValueError("ساعت باید به قالب HH:MM باشد، مثلا 10:30")
    return cleaned


class AvailableSlotsQuery(BaseModel):
    clinic_id: int = Field(ge=1)
    jalali_date: str = Field(examples=["1405-06-10"])

    @field_validator("jalali_date", mode="before")
    @classmethod
    def _clean_date(cls, value: object) -> str:
        return validate_jalali_date(value)


class AvailableSlotsResponse(BaseModel):
    jalali_date: str
    clinic_id: int
    slots: list[str]


class AppointmentBookRequest(BaseModel):
    clinic_id: int = Field(ge=1)
    service_id: int = Field(ge=1)
    jalali_date: str = Field(examples=["1405-06-10"])
    time_slot: str = Field(examples=["10:30"])

    @field_validator("jalali_date", mode="before")
    @classmethod
    def _clean_date(cls, value: object) -> str:
        return validate_jalali_date(value)

    @field_validator("time_slot", mode="before")
    @classmethod
    def _clean_slot(cls, value: object) -> str:
        return validate_time_slot(value)


class CatalogService(BaseModel):
    id: int
    service_name: str
    description: str | None = None
    duration_minutes: int
    price: Decimal

    @field_serializer("price")
    def _price_as_int(self, value: Decimal) -> int:
        return int(value)


class CatalogClinic(BaseModel):
    id: int
    clinic_name: str
    address: str
    services: list[CatalogService]


class AppointmentUpdate(BaseModel):
    """Reschedule or change status. Times are validated as a pair when both
    are supplied; a partial change is checked against the stored row."""

    jalali_date: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: AppointmentStatus | None = None

    @field_validator("jalali_date", mode="before")
    @classmethod
    def _clean_jalali_date(cls, value: object | None) -> str | None:
        if value is None:
            return None
        return validate_jalali_date(value)

    @model_validator(mode="after")
    def _check_time_order(self) -> "AppointmentUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("ساعت پایان باید بعد از ساعت شروع باشد")
        return self


class AppointmentRead(ORMModel):
    id: int
    clinic_id: int
    client_id: int
    service_id: int
    jalali_date: str
    start_time: time
    end_time: time
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime


class AppointmentBookResponse(BaseModel):
    message: str
    appointment: AppointmentRead


class AppointmentDetail(AppointmentRead):
    """Appointment with its related rows inlined, for list and detail views."""

    clinic: ClinicProfileRead
    client: UserRead
    service: ServiceRead


class ClinicAppointmentClient(ORMModel):
    """The subset a clinic manager needs to identify and call a client."""

    id: int
    mobile_number: str


class ClinicAppointmentService(ORMModel):
    id: int
    service_name: str
    duration_minutes: int
    price: Decimal

    @field_serializer("price")
    def _price_as_int(self, value: Decimal) -> int:
        return int(value)


class ClinicAppointmentRead(ORMModel):
    """One row of the clinic manager's appointment table."""

    id: int
    clinic_id: int
    jalali_date: str
    time_slot: str
    start_time: time
    end_time: time
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime
    client: ClinicAppointmentClient
    service: ClinicAppointmentService

    @field_serializer("start_time", "end_time")
    def _fmt_time(self, value: time) -> str:
        return value.strftime("%H:%M")


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class ClientAppointmentClinic(ORMModel):
    id: int
    clinic_name: str
    address: str


class ClientAppointmentRead(ORMModel):
    """One row of the signed-in client's appointment list."""

    id: int
    clinic_id: int
    jalali_date: str
    time_slot: str
    start_time: time
    end_time: time
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime
    clinic: ClientAppointmentClinic
    service: ClinicAppointmentService

    @field_serializer("start_time", "end_time")
    def _fmt_time(self, value: time) -> str:
        return value.strftime("%H:%M")


class ClinicStatsResponse(BaseModel):
    """Overview metrics for the signed-in clinic manager's dashboard."""

    jalali_date: str
    today_appointments: int
    pending_count: int
    estimated_revenue: int
    upcoming: list[ClinicAppointmentRead]


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #

#: Roles a visitor may claim for themselves. ADMIN is granted out-of-band only.
SELF_SIGNUP_ROLES = frozenset({UserRole.CLIENT, UserRole.CLINIC_MANAGER})


class OtpRequest(BaseModel):
    """`POST /auth/login` — ask for a code."""

    mobile_number: str = Field(examples=["09123456789"])
    #: Only consulted when this mobile number is new. Existing users keep the
    #: role they already have.
    role: UserRole = UserRole.CLIENT

    @field_validator("mobile_number", mode="before")
    @classmethod
    def _clean_mobile(cls, value: object) -> str:
        return validate_mobile(value)

    @field_validator("role")
    @classmethod
    def _reject_privileged_role(cls, value: UserRole) -> UserRole:
        if value not in SELF_SIGNUP_ROLES:
            raise ValueError("این نقش قابل انتخاب نیست")
        return value


class OtpRequestResponse(BaseModel):
    message: str
    expires_in: int = Field(description="Seconds until the code expires.")
    resend_after: int = Field(description="Seconds before a new code may be requested.")
    #: Dev convenience so the frontend can be exercised without an SMS gateway.
    #: Always null in production.
    debug_code: str | None = None


class OtpVerifyRequest(BaseModel):
    """`POST /auth/verify` — exchange a code for tokens."""

    mobile_number: str = Field(examples=["09123456789"])
    otp: str = Field(examples=["12345"])
    #: Used only when this mobile number has no account yet. Existing users
    #: keep the role already stored on their row. Falls back to the role
    #: captured when the OTP was issued if omitted.
    role: UserRole | None = None

    @field_validator("mobile_number", mode="before")
    @classmethod
    def _clean_mobile(cls, value: object) -> str:
        return validate_mobile(value)

    @field_validator("otp", mode="before")
    @classmethod
    def _clean_otp(cls, value: object) -> str:
        cleaned = normalise_digits(str(value)).strip()
        if not cleaned.isdigit() or not 4 <= len(cleaned) <= 8:
            raise ValueError("کد تایید باید فقط شامل ارقام باشد")
        return cleaned

    @field_validator("role")
    @classmethod
    def _reject_privileged_role(cls, value: UserRole | None) -> UserRole | None:
        if value is None:
            return None
        if value not in SELF_SIGNUP_ROLES:
            raise ValueError("این نقش قابل انتخاب نیست")
        return value


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds.")


class AuthResponse(Token):
    """Tokens plus the account they belong to, so the client can route straight
    to the correct dashboard without a second request."""

    user: UserRead
    is_new_user: bool


class TokenPayload(BaseModel):
    """Decoded JWT body."""

    sub: str
    role: UserRole
    type: str
    exp: int
    iat: int
    jti: str
