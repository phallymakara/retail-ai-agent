"""add auth_user_id to orders

Revision ID: a1f2e3d4c5b6
Revises: ec285ea1173d
Create Date: 2026-07-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1f2e3d4c5b6'
down_revision: Union[str, Sequence[str], None] = 'ec285ea1173d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('auth_user_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_orders_auth_user_id'), 'orders', ['auth_user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_orders_auth_user_id'), table_name='orders')
    op.drop_column('orders', 'auth_user_id')
