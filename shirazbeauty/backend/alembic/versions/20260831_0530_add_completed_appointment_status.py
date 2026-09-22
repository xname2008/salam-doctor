"""add COMPLETED to appointment_status

Revision ID: b8c4d1e2f3a0
Revises: ea17b62b5d97
Create Date: 2026-08-31 05:30:00.000000+00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b8c4d1e2f3a0"
down_revision: str | None = "ea17b62b5d97"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostgreSQL 12+ allows ADD VALUE inside a transaction; the new label
    # cannot be *used* until this transaction commits, which is fine here.
    op.execute(sa.text("ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'COMPLETED'"))


def downgrade() -> None:
    # Postgres cannot drop a single enum label. Rows in COMPLETED would have
    # to be rewritten and the type recreated — left as a no-op on purpose.
    op.execute(
        sa.text(
            "UPDATE appointments SET status = 'CONFIRMED' "
            "WHERE status = 'COMPLETED'"
        )
    )
