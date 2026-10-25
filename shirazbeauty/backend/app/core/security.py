"""Password hashing and JWT issuing/verification.

Deliberately free of FastAPI imports so it can be unit-tested and reused from
scripts. The routers that consume it arrive in Phase 3.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

TokenType = Literal["access", "refresh"]

# bcrypt with the library default of 12 rounds.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt silently ignores anything past 72 *bytes*. Persian characters are two
# bytes in UTF-8, so a 40-character Persian password would be truncated without
# warning; reject it up front instead.
BCRYPT_MAX_BYTES = 72


class TokenError(Exception):
    """Raised when a token is malformed, expired, or of the wrong type."""


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError(
            f"Password must be at most {BCRYPT_MAX_BYTES} bytes when UTF-8 encoded."
        )
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Check a password against its hash.

    Returns False rather than raising for OTP-only accounts, which have no
    password set. The dummy hash keeps the runtime constant so an attacker
    cannot tell "no such user" from "wrong password" by timing the response.
    """
    if not hashed_password:
        pwd_context.dummy_verify()
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        # Hash is corrupt or was produced by an unknown scheme.
        return False


def needs_rehash(hashed_password: str) -> bool:
    """True when the hash uses outdated parameters and should be upgraded on
    the user's next successful sign-in."""
    return pwd_context.needs_update(hashed_password)


# --------------------------------------------------------------------------- #
# JWT
# --------------------------------------------------------------------------- #


def _create_token(
    subject: str | int,
    role: str,
    token_type: TokenType,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    issued_at = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": token_type,
        "iat": issued_at,
        "exp": issued_at + expires_delta,
        # Unique id, so individual tokens can be revoked via a deny-list.
        "jti": uuid.uuid4().hex,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def create_access_token(
    subject: str | int,
    role: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    return _create_token(
        subject,
        role,
        "access",
        timedelta(minutes=settings.access_token_ttl_minutes),
        extra_claims,
    )


def create_refresh_token(subject: str | int, role: str) -> str:
    return _create_token(
        subject,
        role,
        "refresh",
        timedelta(days=settings.refresh_token_ttl_days),
    )


def decode_token(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
    """Decode and verify a JWT.

    Raises `TokenError` for any invalid token — including a valid refresh token
    presented where an access token was required, which is what blocks a stolen
    long-lived refresh token from being used directly against the API.
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except JWTError as exc:
        raise TokenError("Could not validate credentials.") from exc

    if expected_type is not None and payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token.")

    return payload
