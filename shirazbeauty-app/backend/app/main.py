import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

# Importing the models registers every table on Base.metadata, which
# create_all() below reads. Without it the metadata would be empty.
import app.models  # noqa: F401
from app.core.config import settings
from app.database import Base, engine
from app.routers import appointments, auth, clinics, health

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def create_tables_if_absent() -> None:
    """Create any missing tables straight from the ORM metadata.

    Skipped once Alembic has stamped the database. Letting both mechanisms
    manage the same schema is how you end up with a database that no migration
    can reproduce: `create_all` would silently add tables that Alembic has no
    revision for, and the next `alembic upgrade` would fail on objects it
    thinks it still has to create.
    """
    async with engine.begin() as conn:
        under_alembic = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).has_table("alembic_version")
        )
        if under_alembic:
            logger.info(
                "Alembic history detected; leaving the schema to migrations. "
                "Run `alembic upgrade head` to apply pending revisions."
            )
            return

        logger.info("No Alembic history found; creating tables from ORM metadata.")
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if settings.auto_create_tables:
        await create_tables_if_absent()

    yield

    # Return pooled connections to Postgres so a redeploy does not leave
    # sockets open on the database side.
    await engine.dispose()


app = FastAPI(
    title=settings.project_name,
    description="API for the Shiraz Beauty clinic directory and booking platform.",
    version="0.1.0",
    docs_url="/docs",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    lifespan=lifespan,
)

# The browser calls this API from the Next.js origin, so every cross-origin
# request needs an explicit allow. Origins are listed in CORS_ORIGINS; a
# wildcard is not an option because credentialed requests forbid it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the frontend read the OTP cooldown off a 429 response.
    expose_headers=["Retry-After"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(clinics.router, prefix=settings.api_v1_prefix)
app.include_router(appointments.router, prefix=settings.api_v1_prefix)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": settings.project_name, "docs": "/docs"}
