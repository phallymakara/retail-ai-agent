import asyncio
import json

from app.agents.tools import (
    check_inventory,
    get_active_promotions,
    get_product_details,
    search_products,
)
from app.db.session import close_database


def display(title: str, data) -> None:
    print(f"\n=== {title} ===")
    print(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        )
    )


async def main() -> None:
    try:
        display(
            "Search Products",
            await search_products(query="coffee"),
        )

        display(
            "Product Details",
            await get_product_details(
                sku="COFFEE-3IN1-20PK"
            ),
        )

        display(
            "Inventory",
            await check_inventory(
                sku="MILK-UHT-1L"
            ),
        )

        display(
            "Active Promotions",
            await get_active_promotions(),
        )
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())