"""Mobile OTP challenge store.

Codes expire, are attempt-limited, and are compared in constant time. The
plaintext never lives in this module after `issue()` returns — only an HMAC.

Storage is a process-local dict, which is the one thing here that is *not*
production-ready — codes are lost on restart and are invisible to sibling
workers. Before running more than one worker, move `_challenges` to Redis or
the `otp_codes` table; the public methods below can keep their signatures.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.models import UserRole


class OtpError(Exception):
    """Base class for a failed OTP exchange."""


class OtpCooldownError(OtpError):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__("کد قبلی هنوز معتبر است. کمی بعد دوباره تلاش کنید.")


class OtpNotFoundError(OtpError):
    def __init__(self) -> None:
        super().__init__("کد تاییدی برای این شماره صادر نشده یا منقضی شده است.")


class OtpInvalidError(OtpError):
    def __init__(self) -> None:
        super().__init__("کد وارد شده نادرست است.")


class OtpAttemptsExceededError(OtpError):
    def __init__(self) -> None:
        super().__init__("تعداد تلاش‌های مجاز به پایان رسید. کد جدید درخواست کنید.")


@dataclass
class OtpChallenge:
    code_hash: str
    issued_at: datetime
    expires_at: datetime
    # Remembered from the login request so /auth/verify knows which role to
    # assign when this mobile number turns out to be a new sign-up.
    role: UserRole
    attempts: int = 0

    def is_expired(self, now: datetime) -> bool:
        return now >= self.expires_at


def _hash_code(mobile_number: str, code: str) -> str:
    """Keyed digest, so the raw code is never held in memory verbatim."""
    return hmac.new(
        settings.jwt_secret_key.encode(),
        f"{mobile_number}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


class OtpStore:
    def __init__(self) -> None:
        self._challenges: dict[str, OtpChallenge] = {}

    def _purge_expired(self, now: datetime) -> None:
        for mobile in [m for m, c in self._challenges.items() if c.is_expired(now)]:
            del self._challenges[mobile]

    def issue(
        self, mobile_number: str, role: UserRole, code: str | None = None
    ) -> tuple[str, int]:
        """Create a challenge and return (code, seconds_until_expiry).

        Raises `OtpCooldownError` if a code was issued too recently, which
        stops the endpoint being used to spam someone's phone.
        """
        now = datetime.now(UTC)
        self._purge_expired(now)

        existing = self._challenges.get(mobile_number)
        if existing is not None:
            elapsed = (now - existing.issued_at).total_seconds()
            remaining = settings.otp_resend_cooldown_seconds - elapsed
            if remaining > 0:
                raise OtpCooldownError(retry_after=int(remaining) + 1)

        if code is None:
            code = "".join(
                str(secrets.randbelow(10)) for _ in range(settings.otp_length)
            )

        self._challenges[mobile_number] = OtpChallenge(
            code_hash=_hash_code(mobile_number, code),
            issued_at=now,
            expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
            role=role,
        )
        return code, settings.otp_ttl_seconds

    def discard(self, mobile_number: str) -> None:
        """Drop a challenge that was stored but never delivered."""
        self._challenges.pop(mobile_number, None)

    def verify(self, mobile_number: str, code: str) -> OtpChallenge:
        """Consume a challenge. Returns it on success, raises `OtpError` otherwise."""
        now = datetime.now(UTC)
        self._purge_expired(now)

        challenge = self._challenges.get(mobile_number)
        if challenge is None:
            raise OtpNotFoundError()

        if not hmac.compare_digest(
            challenge.code_hash, _hash_code(mobile_number, code)
        ):
            challenge.attempts += 1
            if challenge.attempts >= settings.otp_max_attempts:
                del self._challenges[mobile_number]
                raise OtpAttemptsExceededError()
            raise OtpInvalidError()

        # Single use: a correct code is burned immediately.
        del self._challenges[mobile_number]
        return challenge


otp_store = OtpStore()
