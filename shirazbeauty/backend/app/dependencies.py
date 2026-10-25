"""Shared FastAPI dependencies — currently everything auth-related."""

from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenError, decode_token
from app.database import get_db
from app.models import User, UserRole

# auto_error=False so a missing header produces our own 401 with a
# WWW-Authenticate challenge rather than FastAPI's bare 403.
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="اعتبارسنجی انجام نشد. دوباره وارد شوید.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the caller from their bearer token.

    Every failure returns the same 401, so a caller cannot probe which user
    ids exist by comparing error responses.
    """
    if credentials is None:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except TokenError as exc:
        raise CREDENTIALS_EXCEPTION from exc

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise CREDENTIALS_EXCEPTION from exc

    user = await db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_EXCEPTION

    # Checked on every request, so deactivating an account takes effect
    # immediately instead of when the token happens to expire.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="این حساب غیرفعال شده است.",
        )

    return user


def require_roles(*roles: UserRole) -> Callable[..., Awaitable[User]]:
    """Dependency factory restricting a route to the given roles."""

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="برای انجام این عملیات دسترسی لازم را ندارید.",
            )
        return current_user

    return dependency
