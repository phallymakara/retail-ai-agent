"""create inventory_audit_logs and inventory_proposals

Revision ID: c3d4e5f6a7b8
Revises: a1f2e3d4c5b6
Create Date: 2026-07-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'a1f2e3d4c5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inventory_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stores.id', ondelete='SET NULL'), nullable=True),
        sa.Column('change_type', sa.String(length=50), nullable=False),
        sa.Column('quantity_delta', sa.Integer(), nullable=False),
        sa.Column('previous_quantity', sa.Integer(), nullable=False),
        sa.Column('new_quantity', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('staff_user_id', sa.String(length=255), nullable=True),
        sa.Column('staff_name', sa.String(length=150), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_inventory_audit_logs_product_id'), 'inventory_audit_logs', ['product_id'], unique=False)
    op.create_index(op.f('ix_inventory_audit_logs_store_id'), 'inventory_audit_logs', ['store_id'], unique=False)
    op.create_index(op.f('ix_inventory_audit_logs_target_store_id'), 'inventory_audit_logs', ['target_store_id'], unique=False)
    op.create_index(op.f('ix_inventory_audit_logs_change_type'), 'inventory_audit_logs', ['change_type'], unique=False)
    op.create_index(op.f('ix_inventory_audit_logs_staff_user_id'), 'inventory_audit_logs', ['staff_user_id'], unique=False)
    op.create_index(op.f('ix_inventory_audit_logs_created_at'), 'inventory_audit_logs', ['created_at'], unique=False)

    op.create_table(
        'inventory_proposals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('proposal_type', sa.String(length=50), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=True),
        sa.Column('quantity_change', sa.Integer(), nullable=False),
        sa.Column('previous_quantity', sa.Integer(), nullable=False),
        sa.Column('new_quantity', sa.Integer(), nullable=False),
        sa.Column('target_previous_quantity', sa.Integer(), nullable=True),
        sa.Column('target_new_quantity', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('staff_user_id', sa.String(length=255), nullable=True),
        sa.Column('staff_name', sa.String(length=150), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_inventory_proposals_product_id'), 'inventory_proposals', ['product_id'], unique=False)
    op.create_index(op.f('ix_inventory_proposals_store_id'), 'inventory_proposals', ['store_id'], unique=False)
    op.create_index(op.f('ix_inventory_proposals_target_store_id'), 'inventory_proposals', ['target_store_id'], unique=False)
    op.create_index(op.f('ix_inventory_proposals_status'), 'inventory_proposals', ['status'], unique=False)
    op.create_index(op.f('ix_inventory_proposals_created_at'), 'inventory_proposals', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('inventory_proposals')
    op.drop_table('inventory_audit_logs')
