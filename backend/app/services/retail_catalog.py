from datetime import UTC, datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inventory, Product, Promotion, Store

CATEGORY_ALIASES = {
    "hair care": "Personal Care",
    "haircare": "Personal Care",
    "shampoo": "Personal Care",
    "soap": "Personal Care",
    "skincare": "Personal Care",
    "skin care": "Personal Care",
    "beauty": "Personal Care",
    "personal care": "Personal Care",
    "milk": "Dairy",
    "dairy": "Dairy",
    "rice": "Rice and Grains",
    "grains": "Rice and Grains",
    "cooking": "Cooking Essentials",
    "oil": "Cooking Essentials",
    "sauce": "Sauces and Condiments",
    "condiment": "Sauces and Condiments",
    "drink": "Beverages",
    "beverage": "Beverages",
    "beverages": "Beverages",
    "coffee": "Beverages",
    "water": "Beverages",
    "noodle": "Instant Food",
    "noodles": "Instant Food",
    "instant": "Instant Food",
}


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


async def resolve_store_code(session: AsyncSession, store_input: str | None) -> str | None:
    if not store_input:
        return None
    val = store_input.strip()
    val_upper = val.upper()

    # Exact match on code
    store = await session.scalar(select(Store).where(Store.code == val_upper))
    if store:
        return store.code

    # Flexible matching on name or aliases
    stores = (await session.scalars(select(Store).where(Store.is_active.is_(True)))).all()
    input_lower = val.lower()

    for s in stores:
        code_lower = s.code.lower()
        name_lower = s.name.lower()
        if (
            input_lower in name_lower
            or input_lower in code_lower
            or ("siem reap" in input_lower and "sr" in code_lower)
            or ("bkk1" in input_lower and "bkk1" in code_lower)
            or ("toul tom" in input_lower and "ttp" in code_lower)
            or ("ttp" in input_lower and "ttp" in code_lower)
        ):
            return s.code

    return val_upper


async def search_products(
    session: AsyncSession,
    *,
    query: str | None = None,
    category: str | None = None,
    store_code: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    limit = min(max(limit, 1), 100)

    statement = (
        select(Product)
        .where(Product.is_active.is_(True))
        .order_by(Product.name)
        .limit(limit)
    )

    resolved_code = None
    if store_code:
        resolved_code = await resolve_store_code(session, store_code)
        if resolved_code:
            statement = (
                statement.join(Inventory, Inventory.product_id == Product.id)
                .join(Store, Store.id == Inventory.store_id)
                .where(
                    Store.code == resolved_code,
                    Inventory.quantity - Inventory.reserved_quantity > 0,
                )
            )

    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                Product.name.ilike(pattern),
                Product.name_km.ilike(pattern),
                Product.sku.ilike(pattern),
                Product.brand.ilike(pattern),
                Product.category.ilike(pattern),
            )
        )

    if category:
        cat_lower = category.strip().lower()
        target_cat = CATEGORY_ALIASES.get(cat_lower, category.strip())
        cat_pattern = f"%{target_cat}%"
        orig_pattern = f"%{category.strip()}%"

        statement = statement.where(
            or_(
                Product.category.ilike(cat_pattern),
                Product.category.ilike(orig_pattern),
                Product.name.ilike(orig_pattern),
                Product.description.ilike(orig_pattern),
            )
        )

    products = (await session.scalars(statement)).all()

    # Fallback if no products found for category: return general available products for store or catalog
    if not products and category:
        fallback_stmt = (
            select(Product)
            .where(Product.is_active.is_(True))
            .order_by(Product.name)
            .limit(limit)
        )
        if resolved_code:
            fallback_stmt = (
                fallback_stmt.join(Inventory, Inventory.product_id == Product.id)
                .join(Store, Store.id == Inventory.store_id)
                .where(
                    Store.code == resolved_code,
                    Inventory.quantity - Inventory.reserved_quantity > 0,
                )
            )
        products = (await session.scalars(fallback_stmt)).all()

    results = []
    for product in products:
        p_dict = serialize_product(product)
        if resolved_code:
            inv = await session.scalar(
                select(Inventory)
                .join(Store, Store.id == Inventory.store_id)
                .where(
                    Inventory.product_id == product.id,
                    Store.code == resolved_code,
                )
            )
            p_dict["available_quantity"] = inv.available_quantity if inv else 0
        results.append(p_dict)

    return results


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
            "reserved_quantity": inventory.reserved_quantity,
            "available_quantity": inventory.available_quantity,
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
        resolved_code = await resolve_store_code(session, store_code)
        if resolved_code:
            statement = statement.where(Store.code == resolved_code)

    inventory_rows = (await session.execute(statement)).all()

    stores = [
        {
            "store_code": store.code,
            "store_name": store.name,
            "address": store.address,
            "quantity": inventory.quantity,
            "reserved_quantity": inventory.reserved_quantity,
            "available_quantity": inventory.available_quantity,
            "in_stock": inventory.available_quantity > 0,
            "low_stock": inventory.available_quantity <= inventory.reorder_level,
        }
        for store, inventory in inventory_rows
    ]

    return {
        "found": True,
        "sku": product.sku,
        "product_name": product.name,
        "product_name_km": product.name_km,
        "stores": stores,
        "total_available": sum(store["available_quantity"] for store in stores),
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
        statement = statement.where(Product.sku == sku.strip().upper())

    rows = (await session.execute(statement)).all()

    return [
        {
            "id": str(promotion.id),
            "name": promotion.name,
            "description": promotion.description,
            "discount_percent": str(promotion.discount_percent),
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