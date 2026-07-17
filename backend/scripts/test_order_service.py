import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionFactory, close_database
from app.models import Inventory, Product, Store
from app.services.order_service import (
    OrderLineInput,
    create_order,
)


async def main() -> None:
    async with AsyncSessionFactory() as session:
        async with session.begin():
            order = await create_order(
                session,
                store_code="SR-CENTRAL",
                customer_name="Prototype Customer",
                customer_phone="012345678",
                customer_email=None,
                fulfillment_type="pickup",
                delivery_address=None,
                customer_note="Order service test",
                payment_method="cash",
                lines=[
                    OrderLineInput(
                        sku="MILK-UHT-1L",
                        quantity=1,
                    )
                ],
            )

            print("Order service test successful")
            print(f"Order: {order.order_number}")
            print(f"Status: {order.status}")
            print(f"Total: {order.total_amount} {order.currency}")
            print(f"Items: {len(order.items)}")

            inventory = await session.scalar(
                select(Inventory)
                .join(Store)
                .join(Product)
                .where(
                    Store.code == "SR-CENTRAL",
                    Product.sku == "MILK-UHT-1L",
                )
            )

            if inventory is None:
                raise RuntimeError("Test inventory was not found.")

            print(
                "Reserved quantity during transaction:",
                inventory.reserved_quantity,
            )

            # This test must not leave an order or reservation in Neon.
            await session.rollback()

    await close_database()


if __name__ == "__main__":
    asyncio.run(main())