import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "subtotal >= 0",
            name="ck_orders_subtotal_non_negative",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_orders_discount_non_negative",
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="ck_orders_total_non_negative",
        ),
        CheckConstraint(
            "fulfillment_type IN ('pickup', 'delivery')",
            name="ck_orders_fulfillment_type",
        ),
        CheckConstraint(
            "status IN "
            "('pending', 'confirmed', 'preparing', 'ready', "
            "'completed', 'cancelled')",
            name="ck_orders_status",
        ),
        CheckConstraint(
            "payment_status IN "
            "('pending', 'paid', 'failed', 'refunded')",
            name="ck_orders_payment_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_number: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        index=True,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="RESTRICT"),
        index=True,
    )

    customer_name: Mapped[str] = mapped_column(String(150))
    customer_phone: Mapped[str] = mapped_column(String(30))
    customer_email: Mapped[str | None] = mapped_column(
        String(254),
        nullable=True,
    )

    fulfillment_type: Mapped[str] = mapped_column(
        String(20),
        default="pickup",
    )
    delivery_address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    customer_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        index=True,
    )
    payment_method: Mapped[str] = mapped_column(
        String(30),
        default="cash",
    )
    payment_status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        index=True,
    )
    payment_reference: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(
        String(3),
        default="USD",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    store: Mapped["Store"] = relationship(
        back_populates="orders",
    )
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderItem.created_at",
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "product_id",
            name="uq_order_items_order_product",
        ),
        CheckConstraint(
            "quantity > 0",
            name="ck_order_items_quantity_positive",
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_order_items_unit_price_non_negative",
        ),
        CheckConstraint(
            "line_total >= 0",
            name="ck_order_items_line_total_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"),
        index=True,
    )

    # Product snapshots preserve order history if product data changes.
    product_sku: Mapped[str] = mapped_column(String(80))
    product_name: Mapped[str] = mapped_column(String(200))
    product_name_km: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    product_image_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    quantity: Mapped[int] = mapped_column(Integer)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(
        String(3),
        default="USD",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    order: Mapped["Order"] = relationship(
        back_populates="items",
    )
    product: Mapped["Product"] = relationship(
        back_populates="order_items",
    )
