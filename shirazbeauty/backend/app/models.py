"""SQLAlchemy ORM models for Shiraz Beauty.

Conventions used throughout:

* Money is `Numeric(12, 0)` — whole Toman, no fractional currency in Iran, and
  never a float.
* Dates the user picks are stored as zero-padded Jalali strings
  (``"1405-06-09"``), which sort chronologically as plain text.
* Enum values are stored as native Postgres enum types so bad data cannot be
  written by hand.
"""

import enum
from datetime import time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin

# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #


class UserRole(str, enum.Enum):
    """Who the account belongs to. Member names match their values so the
    stored value stays readable in raw SQL."""

    CLIENT = "CLIENT"
    CLINIC_MANAGER = "CLINIC_MANAGER"
    ADMIN = "ADMIN"


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


def _pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Native Postgres enum that persists member *values*, not member names."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=True,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
    )


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #


class User(TimestampMixin, Base):
    """A person on the platform, identified by their mobile number.

    One row covers all three roles; a clinic manager is a `User` with a
    `ClinicProfile` attached.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    mobile_number: Mapped[str] = mapped_column(
        String(11), unique=True, index=True, nullable=False
    )
    # Nullable by design: sign-in is mobile OTP, so most clients never set a
    # password. Only staff and admin accounts have one.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[UserRole] = mapped_column(
        _pg_enum(UserRole, "user_role"),
        default=UserRole.CLIENT,
        server_default=UserRole.CLIENT.value,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )

    clinic_profile: Mapped["ClinicProfile | None"] = relationship(
        back_populates="manager",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        # Iranian mobile numbers: 11 digits, always starting 09.
        CheckConstraint(
            r"mobile_number ~ '^09[0-9]{9}$'", name="mobile_number_format"
        ),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} mobile={self.mobile_number} role={self.role}>"


class ClinicProfile(TimestampMixin, Base):
    """A beauty clinic, dermatology centre or salon listed in the directory."""

    __tablename__ = "clinic_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Unique: one manager owns exactly one clinic, enforced in the database
    # rather than trusted to the service layer.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    clinic_name: Mapped[str] = mapped_column(String(160), index=True, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    contact_number: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Set by an admin once the clinic's operating licence has been checked.
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False, index=True
    )

    manager: Mapped["User"] = relationship(back_populates="clinic_profile")
    services: Mapped[list["Service"]] = relationship(
        back_populates="clinic",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="clinic",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<ClinicProfile id={self.id} name={self.clinic_name!r}>"


class Service(TimestampMixin, Base):
    """A treatment a clinic offers, with its duration and price."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)

    clinic_id: Mapped[int] = mapped_column(
        ForeignKey("clinic_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    service_name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Drives slot generation on the clinic's scheduling calendar.
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)

    clinic: Mapped["ClinicProfile"] = relationship(back_populates="services")
    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="service", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("clinic_id", "service_name", name="uq_services_clinic_name"),
        CheckConstraint(
            "duration_minutes > 0 AND duration_minutes <= 480",
            name="duration_minutes_range",
        ),
        CheckConstraint("price >= 0", name="price_non_negative"),
    )

    def __repr__(self) -> str:
        return f"<Service id={self.id} name={self.service_name!r}>"


class Appointment(TimestampMixin, Base):
    """A booking made by a client against one of a clinic's services."""

    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)

    clinic_id: Mapped[int] = mapped_column(
        ForeignKey("clinic_profiles.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # RESTRICT, not CASCADE: deleting a service must never silently erase the
    # bookings (and revenue history) attached to it.
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    # Zero-padded Shamsi date, e.g. "1405-06-09". Fixed width means plain
    # string comparison gives correct chronological ordering and BETWEEN ranges.
    jalali_date: Mapped[str] = mapped_column(String(10), nullable=False)
    # API callers send this as `time_slot` (HH:MM). Stored as start_time so the
    # unique index and duration math stay on real Time columns.
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    status: Mapped[AppointmentStatus] = mapped_column(
        _pg_enum(AppointmentStatus, "appointment_status"),
        default=AppointmentStatus.PENDING,
        server_default=AppointmentStatus.PENDING.value,
        nullable=False,
    )

    clinic: Mapped["ClinicProfile"] = relationship(back_populates="appointments")
    client: Mapped["User"] = relationship(back_populates="appointments")
    service: Mapped["Service"] = relationship(back_populates="appointments")

    __table_args__ = (
        CheckConstraint(
            r"jalali_date ~ '^1[34][0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'",
            name="jalali_date_format",
        ),
        CheckConstraint("end_time > start_time", name="time_order"),
        # Serves the clinic's day view and the client's booking history.
        Index("ix_appointments_clinic_day", "clinic_id", "jalali_date", "start_time"),
        Index("ix_appointments_client_day", "client_id", "jalali_date"),
        # Double-booking guard. Partial, so a cancelled booking frees its slot
        # for someone else. Revisit when per-specialist or per-room scheduling
        # lands — a clinic with two lasers can legitimately fill one slot twice.
        Index(
            "uq_appointments_active_slot",
            "clinic_id",
            "jalali_date",
            "start_time",
            unique=True,
            postgresql_where=text("status <> 'CANCELLED'"),
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Appointment id={self.id} clinic={self.clinic_id} "
            f"date={self.jalali_date} at={self.start_time} status={self.status}>"
        )
