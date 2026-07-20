import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inventory, Order, OrderItem, Product, Store


MONEY_PLACES = Decimal("0.01")


class OrderError(Exception):
    """Base exception for order operations."""


class StoreNotFoundError(OrderError):
    pass


class ProductNotFoundError(OrderError):
    pass


class InsufficientInventoryError(OrderError):
    def __init__(
        self,
        *,
        sku: str,
        requested: int,
        available: int,
    ) -> None:
        self.sku = sku
        self.requested = requested
        self.available = available

        super().__init__(
            f"Insufficient inventory for {sku}: "
            f"requested {requested}, available {available}"
        )


@dataclass(frozen=True)
class OrderLineInput:
    sku: str
    quantity: int


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def generate_order_number() -> str:
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(3).upper()
    return f"ORD-{timestamp}-{random_part}"


async def create_order(
    session: AsyncSession,
    *,
    store_code: str,
    customer_name: str,
    customer_phone: str,
    customer_email: str | None,
    fulfillment_type: str,
    delivery_address: str | None,
    customer_note: str | None,
    payment_method: str,
    lines: list[OrderLineInput],
    auth_user_id: str | None = None,
) -> Order:
    if not lines:
        raise OrderError("The order must contain at least one item.")

    if fulfillment_type == "delivery" and not delivery_address:
        raise OrderError(
            "A delivery address is required for delivery orders."
        )

    quantities_by_sku: dict[str, int] = {}

    for line in lines:
        sku = line.sku.strip().upper()

        if not sku:
            raise OrderError("Product SKU cannot be empty.")

        if line.quantity <= 0:
            raise OrderError(
                f"Quantity for {sku} must be greater than zero."
            )

        quantities_by_sku[sku] = (
            quantities_by_sku.get(sku, 0) + line.quantity
        )

    store = await session.scalar(
        select(Store).where(
            Store.code == store_code.strip().upper(),
            Store.is_active.is_(True),
        )
    )

    if store is None:
        raise StoreNotFoundError(
            f"Active store {store_code!r} was not found."
        )

    requested_skus = sorted(quantities_by_sku)

    # Lock matching inventory rows until the surrounding transaction ends.
    inventory_result = await session.execute(
        select(Inventory, Product)
        .join(Product, Product.id == Inventory.product_id)
        .where(
            Inventory.store_id == store.id,
            Product.sku.in_(requested_skus),
            Product.is_active.is_(True),
        )
        .order_by(Product.sku)
        .with_for_update(of=Inventory)
    )

    inventory_by_sku = {
        product.sku: (inventory, product)
        for inventory, product in inventory_result.all()
    }

    missing_skus = [
        sku for sku in requested_skus if sku not in inventory_by_sku
    ]

    if missing_skus:
        raise ProductNotFoundError(
            "Products unavailable at this store: "
            + ", ".join(missing_skus)
        )

    subtotal = Decimal("0.00")
    order_items: list[OrderItem] = []

    for sku in requested_skus:
        requested_quantity = quantities_by_sku[sku]
        inventory, product = inventory_by_sku[sku]
        available_quantity = inventory.available_quantity

        if requested_quantity > available_quantity:
            raise InsufficientInventoryError(
                sku=sku,
                requested=requested_quantity,
                available=available_quantity,
            )

        unit_price = money(product.price)
        line_total = money(
            unit_price * Decimal(requested_quantity)
        )
        subtotal += line_total

        order_items.append(
            OrderItem(
                product_id=product.id,
                product_sku=product.sku,
                product_name=product.name,
                product_name_km=product.name_km,
                product_image_url=product.image_url,
                unit_price=unit_price,
                quantity=requested_quantity,
                line_total=line_total,
                currency=product.currency,
            )
        )

        inventory.reserved_quantity += requested_quantity

    subtotal = money(subtotal)
    discount_amount = Decimal("0.00")
    total_amount = money(subtotal - discount_amount)

    order = Order(
        id=uuid.uuid4(),
        order_number=generate_order_number(),
        store_id=store.id,
        store=store,
        auth_user_id=auth_user_id,
        customer_name=customer_name.strip(),
        customer_phone=customer_phone.strip(),
        customer_email=(
            customer_email.strip() if customer_email else None
        ),
        fulfillment_type=fulfillment_type,
        delivery_address=(
            delivery_address.strip() if delivery_address else None
        ),
        customer_note=(
            customer_note.strip() if customer_note else None
        ),
        status="confirmed",
        payment_method=payment_method,
        payment_status="pending",
        subtotal=subtotal,
        discount_amount=discount_amount,
        total_amount=total_amount,
        currency="USD",
        confirmed_at=datetime.now(UTC),
        items=order_items,
    )

    session.add(order)
    await session.flush()

    return order