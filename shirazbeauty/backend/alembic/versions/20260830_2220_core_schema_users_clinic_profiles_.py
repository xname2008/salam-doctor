"""core schema: users, clinic profiles, services, appointments

Revision ID: ea17b62b5d97
Revises: 
Create Date: 2026-08-30 22:20:37.739900+00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'ea17b62b5d97'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('mobile_number', sa.String(length=11), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=True),
    sa.Column('role', sa.Enum('CLIENT', 'CLINIC_MANAGER', 'ADMIN', name='user_role'), server_default='CLIENT', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("mobile_number ~ '^09[0-9]{9}$'", name=op.f('ck_users_mobile_number_format')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_mobile_number'), 'users', ['mobile_number'], unique=True)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_table('clinic_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('clinic_name', sa.String(length=160), nullable=False),
    sa.Column('address', sa.Text(), nullable=False),
    sa.Column('contact_number', sa.String(length=20), nullable=False),
    sa.Column('is_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_clinic_profiles_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_clinic_profiles')),
    sa.UniqueConstraint('user_id', name=op.f('uq_clinic_profiles_user_id'))
    )
    op.create_index(op.f('ix_clinic_profiles_clinic_name'), 'clinic_profiles', ['clinic_name'], unique=False)
    op.create_index(op.f('ix_clinic_profiles_is_verified'), 'clinic_profiles', ['is_verified'], unique=False)
    op.create_table('services',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=False),
    sa.Column('service_name', sa.String(length=160), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=False),
    sa.Column('price', sa.Numeric(precision=12, scale=0), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('duration_minutes > 0 AND duration_minutes <= 480', name=op.f('ck_services_duration_minutes_range')),
    sa.CheckConstraint('price >= 0', name=op.f('ck_services_price_non_negative')),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinic_profiles.id'], name=op.f('fk_services_clinic_id_clinic_profiles'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_services')),
    sa.UniqueConstraint('clinic_id', 'service_name', name='uq_services_clinic_name')
    )
    op.create_index(op.f('ix_services_clinic_id'), 'services', ['clinic_id'], unique=False)
    op.create_table('appointments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('service_id', sa.Integer(), nullable=False),
    sa.Column('jalali_date', sa.String(length=10), nullable=False),
    sa.Column('start_time', sa.Time(), nullable=False),
    sa.Column('end_time', sa.Time(), nullable=False),
    sa.Column('status', sa.Enum('PENDING', 'CONFIRMED', 'CANCELLED', name='appointment_status'), server_default='PENDING', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("jalali_date ~ '^1[34][0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'", name=op.f('ck_appointments_jalali_date_format')),
    sa.CheckConstraint('end_time > start_time', name=op.f('ck_appointments_time_order')),
    sa.ForeignKeyConstraint(['client_id'], ['users.id'], name=op.f('fk_appointments_client_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinic_profiles.id'], name=op.f('fk_appointments_clinic_id_clinic_profiles'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['service_id'], ['services.id'], name=op.f('fk_appointments_service_id_services'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_appointments'))
    )
    op.create_index('ix_appointments_client_day', 'appointments', ['client_id', 'jalali_date'], unique=False)
    op.create_index('ix_appointments_clinic_day', 'appointments', ['clinic_id', 'jalali_date', 'start_time'], unique=False)
    op.create_index(op.f('ix_appointments_service_id'), 'appointments', ['service_id'], unique=False)
    op.create_index('uq_appointments_active_slot', 'appointments', ['clinic_id', 'jalali_date', 'start_time'], unique=True, postgresql_where=sa.text("status <> 'CANCELLED'"))


def downgrade() -> None:
    op.drop_index('uq_appointments_active_slot', table_name='appointments', postgresql_where=sa.text("status <> 'CANCELLED'"))
    op.drop_index(op.f('ix_appointments_service_id'), table_name='appointments')
    op.drop_index('ix_appointments_clinic_day', table_name='appointments')
    op.drop_index('ix_appointments_client_day', table_name='appointments')
    op.drop_table('appointments')
    op.drop_index(op.f('ix_services_clinic_id'), table_name='services')
    op.drop_table('services')
    op.drop_index(op.f('ix_clinic_profiles_is_verified'), table_name='clinic_profiles')
    op.drop_index(op.f('ix_clinic_profiles_clinic_name'), table_name='clinic_profiles')
    op.drop_table('clinic_profiles')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_mobile_number'), table_name='users')
    op.drop_table('users')

    # `create_table` creates these enum types implicitly, but dropping the
    # table does not remove them. Without this, re-running the upgrade fails
    # with "type user_role already exists".
    bind = op.get_bind()
    sa.Enum(name='appointment_status').drop(bind, checkfirst=True)
    sa.Enum(name='user_role').drop(bind, checkfirst=True)
