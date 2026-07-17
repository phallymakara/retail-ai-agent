from datetime import UTC, datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inventory, Product, Promotion, Store


def serialize_product(product: Product) -> dict[str, Any]:
    return {
        "id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "name_km": product.name_km,
        "category": product.category,
        "description": product.description,
        "price": str(product.price),
        "currency": product.currency,
        "brand": product.brand,
        "image_url": product.image_url,
        "is_active": product.is_active,
    }


async def search_products(
    session: AsyncSession,
    *,
    query: str | None = None,
    category: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    limit = min(max(limit, 1), 20)

    statement = (
        select(Product)
        .where(Product.is_active.is_(True))
        .order_by(Product.name)
        .limit(limit)
    )

    if query:
        pattern = f"%{query.strip()}%"

        statement = statement.where(
            or_(
                Product.name.ilike(pattern),
                Product.name_km.ilike(pattern),
                Product.sku.ilike(pattern),
                Product.brand.ilike(pattern),
            )
        )

    if category:
        statement = statement.where(
            Product.category.ilike(category.strip())
        )

    products = (await session.scalars(statement)).all()

    return [
        serialize_product(product)
        for product in products
    ]


async def get_product_details(
    session: AsyncSession,
    *,
    sku: str,
) -> dict[str, Any] | None:
    product = await session.scalar(
        select(Product).where(
            Product.sku == sku.strip().upper(),
            Product.is_active.is_(True),
        )
    )

    if product is None:
        return None

    inventory_rows = (
        await session.execute(
            select(Store, Inventory)
            .join(
                Inventory,
                Inventory.store_id == Store.id,
            )
            .where(
                Inventory.product_id == product.id,
                Store.is_active.is_(True),
            )
            .order_by(Store.name)
        )
    ).all()

    result = serialize_product(product)
    result["inventory"] = [
        {
            "store_code": store.code,
            "store_name": store.name,
            "quantity": inventory.quantity,
            "reserved_quantity": (
                inventory.reserved_quantity
            ),
            "available_quantity": (
                inventory.available_quantity
            ),
        }
        for store, inventory in inventory_rows
    ]

    return result


async def check_inventory(
    session: AsyncSession,
    *,
    sku: str,
    store_code: str | None = None,
) -> dict[str, Any]:
    product = await session.scalar(
        select(Product).where(
            Product.sku == sku.strip().upper(),
            Product.is_active.is_(True),
        )
    )

    if product is None:
        return {
            "found": False,
            "sku": sku,
            "message": "Product not found.",
            "stores": [],
        }

    statement = (
        select(Store, Inventory)
        .join(
            Inventory,
            Inventory.store_id == Store.id,
        )
        .where(
            Inventory.product_id == product.id,
            Store.is_active.is_(True),
        )
        .order_by(Store.name)
    )

    if store_code:
        statement = statement.where(
            Store.code == store_code.strip().upper()
        )

    inventory_rows = (
        await session.execute(statement)
    ).all()

    stores = [
        {
            "store_code": store.code,
            "store_name": store.name,
            "address": store.address,
            "quantity": inventory.quantity,
            "reserved_quantity": (
                inventory.reserved_quantity
            ),
            "available_quantity": (
                inventory.available_quantity
            ),
            "in_stock": inventory.available_quantity > 0,
            "low_stock": (
                inventory.available_quantity
                <= inventory.reorder_level
            ),
        }
        for store, inventory in inventory_rows
    ]

    return {
        "found": True,
        "sku": product.sku,
        "product_name": product.name,
        "product_name_km": product.name_km,
        "stores": stores,
        "total_available": sum(
            store["available_quantity"]
            for store in stores
        ),
    }


async def get_active_promotions(
    session: AsyncSession,
    *,
    sku: str | None = None,
) -> list[dict[str, Any]]:
    now = datetime.now(UTC)

    statement = (
        select(Promotion, Product)
        .outerjoin(
            Product,
            Product.id == Promotion.product_id,
        )
        .where(
            Promotion.is_active.is_(True),
            Promotion.starts_at <= now,
            Promotion.ends_at >= now,
        )
        .order_by(Promotion.ends_at)
    )

    if sku:
        statement = statement.where(
            Product.sku == sku.strip().upper()
        )

    rows = (await session.execute(statement)).all()

    return [
        {
            "id": str(promotion.id),
            "name": promotion.name,
            "description": promotion.description,
            "discount_percent": str(
                promotion.discount_percent
            ),
            "starts_at": promotion.starts_at.isoformat(),
            "ends_at": promotion.ends_at.isoformat(),
            "product": (
                {
                    "sku": product.sku,
                    "name": product.name,
                    "name_km": product.name_km,
                    "price": str(product.price),
                    "currency": product.currency,
                    "image_url": product.image_url,
                }
                if product is not None
                else None
            ),
        }
        for promotion, product in rows
    ]