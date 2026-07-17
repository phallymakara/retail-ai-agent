import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
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


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    inventory_items: Mapped[list["Inventory"]] = relationship(
        back_populates="store",
    )

    orders: Mapped[list["Order"]] = relationship(
        back_populates="store",
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sku: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(200),
        index=True,
    )
    name_km: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        default="USD",
    )
    brand: Mapped[str | None] = mapped_column(String(100))
    image_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    inventory_items: Mapped[list["Inventory"]] = relationship(
        back_populates="product",
    )
    promotions: Mapped[list["Promotion"]] = relationship(
        back_populates="product",
    )
    order_items: Mapped[list["OrderItem"]] = relationship(
        back_populates="product",
    )


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "product_id",
            name="uq_inventory_store_product",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"),
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )
    reserved_quantity: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )
    reorder_level: Mapped[int] = mapped_column(
        Integer,
        default=5,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    store: Mapped["Store"] = relationship(
        back_populates="inventory_items",
    )
    product: Mapped["Product"] = relationship(
        back_populates="inventory_items",
    )

    @property
    def available_quantity(self) -> int:
        return max(self.quantity - self.reserved_quantity, 0)


class Promotion(Base):
    __tablename__ = "promotions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    discount_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
    )
    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    product: Mapped["Product | None"] = relationship(
        back_populates="promotions",
    )
