"""Mobile-OTP authentication.

Two steps: `POST /auth/login` issues a code, `POST /auth/verify` exchanges it
for tokens. There is no separate sign-up — a mobile number that verifies
successfully and has no account gets one created.
"""

import asyncio
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.otp import OtpCooldownError, OtpError, otp_store
from app.core.security import create_access_token, create_refresh_token
from app.database import get_db
from app.models import User, UserRole
from app.schemas import (
    AuthResponse,
    OtpRequest,
    OtpRequestResponse,
    OtpVerifyRequest,
    SELF_SIGNUP_ROLES,
    UserRead,
)
from app.utils.sms import SmsDeliveryError, send_otp_sms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_otp() -> str:
    """Zero-padded so a roll of `42` is still a 5-digit token (`00042`)."""
    width = settings.otp_length
    return f"{secrets.randbelow(10 ** width):0{width}d}"


@router.post(
    "/login",
    response_model=OtpRequestResponse,
    status_code=status.HTTP_200_OK,
    summary="Request an OTP code",
)
async def request_otp(payload: OtpRequest) -> OtpRequestResponse:
    """Send a one-time code to the given mobile number.

    Responds identically whether or not an account exists, so the endpoint
    cannot be used to enumerate registered numbers.
    """
    code = _generate_otp()

    try:
        stored, expires_in = otp_store.issue(
            payload.mobile_number, payload.role, code=code
        )
    except OtpCooldownError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc

    try:
        # `requests` is blocking; run it off the event loop.
        await asyncio.to_thread(send_otp_sms, payload.mobile_number, stored)
    except SmsDeliveryError as exc:
        otp_store.discard(payload.mobile_number)
        logger.exception("OTP SMS failed for %s", payload.mobile_number)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ارسال پیامک ناموفق بود. کمی بعد دوباره تلاش کنید.",
        ) from exc

    return OtpRequestResponse(
        message="کد تایید برای شما پیامک شد.",
        expires_in=expires_in,
        resend_after=settings.otp_resend_cooldown_seconds,
        debug_code=None if (settings.is_production or not settings.sms_is_mock) else stored,
    )


@router.post(
    "/verify",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify an OTP code and receive tokens",
)
async def verify_otp(
    payload: OtpVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    try:
        challenge = otp_store.verify(payload.mobile_number, payload.otp)
    except OtpError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    user = await db.scalar(
        select(User).where(User.mobile_number == payload.mobile_number)
    )
    is_new_user = user is None

    if user is None:
        # First successful verification doubles as sign-up. Prefer the role
        # sent on this request; fall back to the one captured at /auth/login.
        signup_role = payload.role or challenge.role
        if signup_role not in SELF_SIGNUP_ROLES:
            signup_role = UserRole.CLIENT
        user = User(mobile_number=payload.mobile_number, role=signup_role)
        db.add(user)
        try:
            await db.commit()
        except IntegrityError:
            # Two verifications raced; the other one won. Reuse its row.
            await db.rollback()
            user = await db.scalar(
                select(User).where(User.mobile_number == payload.mobile_number)
            )
            is_new_user = False
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="ایجاد حساب کاربری ناموفق بود.",
                ) from None
        else:
            await db.refresh(user)
            logger.info("Registered new user %s as %s", user.id, user.role.value)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="این حساب غیرفعال شده است.",
        )

    return AuthResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id, user.role.value),
        expires_in=settings.access_token_ttl_minutes * 60,
        user=UserRead.model_validate(user),
        is_new_user=is_new_user,
    )
