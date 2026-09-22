from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import get_db

router = APIRouter(tags=["system"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.project_name}


@router.get("/health/db", summary="Database readiness probe")
async def health_db(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
