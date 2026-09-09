"""add clinic and service descriptions; widen contact_number

Revision ID: c3a8f1d92e41
Revises: b8c4d1e2f3a0
Create Date: 2026-08-31 12:00:00.000000+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3a8f1d92e41"
down_revision: str | None = "b8c4d1e2f3a0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clinic_profiles",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.alter_column(
        "clinic_profiles",
        "contact_number",
        existing_type=sa.String(length=20),
        type_=sa.String(length=120),
        existing_nullable=False,
    )
    op.add_column(
        "services",
        sa.Column("description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("services", "description")
    op.alter_column(
        "clinic_profiles",
        "contact_number",
        existing_type=sa.String(length=120),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.drop_column("clinic_profiles", "description")
