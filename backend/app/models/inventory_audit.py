import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InventoryAuditLog(Base):
    __tablename__ = "inventory_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"),
        index=True,
    )
    target_store_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stores.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    change_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )  # e.g., 'adjustment_add', 'adjustment_remove', 'transfer'
    quantity_delta: Mapped[int] = mapped_column(Integer)
    previous_quantity: Mapped[int] = mapped_column(Integer)
    new_quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    staff_user_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    staff_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    product: Mapped["Product"] = relationship()
    store: Mapped["Store"] = relationship(foreign_keys=[store_id])
    target_store: Mapped["Store | None"] = relationship(
        foreign_keys=[target_store_id]
    )


class InventoryProposal(Base):
    __tablename__ = "inventory_proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    proposal_type: Mapped[str] = mapped_column(
        String(50)
    )  # 'adjustment' or 'transfer'
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"),
        index=True,
    )
    target_store_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    quantity_change: Mapped[int] = mapped_column(Integer)
    previous_quantity: Mapped[int] = mapped_column(Integer)
    new_quantity: Mapped[int] = mapped_column(Integer)
    target_previous_quantity: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    target_new_quantity: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", index=True
    )  # 'pending', 'confirmed', 'cancelled'
    staff_user_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    staff_name: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    product: Mapped["Product"] = relationship()
    store: Mapped["Store"] = relationship(foreign_keys=[store_id])
    target_store: Mapped["Store | None"] = relationship(
        foreign_keys=[target_store_id]
    )
