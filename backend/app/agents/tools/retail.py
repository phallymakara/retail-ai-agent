from typing import Any

from app.db.session import AsyncSessionFactory
from app.services import retail_catalog


async def search_products(
    query: str | None = None,
    category: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search active products by name, SKU, brand or category."""
    async with AsyncSessionFactory() as session:
        return await retail_catalog.search_products(
            session,
            query=query,
            category=category,
            limit=limit,
        )


async def get_product_details(
    sku: str,
) -> dict[str, Any] | None:
    """Get product information and availability using its SKU."""
    async with AsyncSessionFactory() as session:
        return await retail_catalog.get_product_details(
            session,
            sku=sku,
        )


async def check_inventory(
    sku: str,
    store_code: str | None = None,
) -> dict[str, Any]:
    """Check available stock for a product across stores."""
    async with AsyncSessionFactory() as session:
        return await retail_catalog.check_inventory(
            session,
            sku=sku,
            store_code=store_code,
        )


async def get_active_promotions(
    sku: str | None = None,
) -> list[dict[str, Any]]:
    """Get active promotions, optionally for one product."""
    async with AsyncSessionFactory() as session:
        return await retail_catalog.get_active_promotions(
            session,
            sku=sku,
        )