import math
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Inventory, Order, OrderItem, Product, Store


async def get_demand_forecast(
    session: AsyncSession,
    *,
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Calculate AI sales demand forecast and stockout predictions across store branches."""
    # 1. Fetch inventories with products and stores
    statement = (
        select(Inventory)
        .join(Store, Store.id == Inventory.store_id)
        .join(Product, Product.id == Inventory.product_id)
        .options(selectinload(Inventory.product), selectinload(Inventory.store))
        .where(
            Store.is_active.is_(True),
            Product.is_active.is_(True),
        )
    )

    if store_code:
        statement = statement.where(Store.code == store_code.strip().upper())

    inventories = (await session.scalars(statement)).all()

    # 2. Fetch order sales velocity over past 30 days
    past_30_days = datetime.now(UTC) - timedelta(days=30)
    sales_stmt = (
        select(
            Order.store_id,
            OrderItem.product_id,
            func.sum(OrderItem.quantity).label("total_sold"),
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.created_at >= past_30_days)
        .group_by(Order.store_id, OrderItem.product_id)
    )
    sales_rows = (await session.execute(sales_stmt)).all()
    sales_map = {(row.store_id, row.product_id): row.total_sold for row in sales_rows}

    # 3. Find stores for potential inter-branch transfers
    all_inv_stmt = (
        select(Inventory)
        .join(Store, Store.id == Inventory.store_id)
        .options(selectinload(Inventory.store))
        .where(Store.is_active.is_(True))
    )
    all_inventories = (await session.scalars(all_inv_stmt)).all()
    inv_by_product: dict[Any, list[Inventory]] = {}
    for inv in all_inventories:
        inv_by_product.setdefault(inv.product_id, []).append(inv)

    forecast_results = []

    for inv in inventories:
        avail = inv.available_quantity
        product = inv.product
        store = inv.store

        # Daily sales calculation
        sold_30_days = sales_map.get((store.id, product.id), 0)
        # Default sales rate if 0 to give realistic sample demand
        if sold_30_days <= 0:
            # Synthetic default daily sales rate based on reorder level
            daily_sales_rate = round(inv.reorder_level / 4.0, 1)
        else:
            daily_sales_rate = round(sold_30_days / 30.0, 1)

        daily_sales_rate = max(daily_sales_rate, 0.5)

        if avail <= 0:
            days_until_stockout = 0
            urgency = "critical"
        else:
            days_until_stockout = math.ceil(avail / daily_sales_rate)
            if days_until_stockout <= 3:
                urgency = "critical"
            elif days_until_stockout <= 7:
                urgency = "warning"
            else:
                urgency = "stable"

        # Generate recommendation
        recommendation = ""
        other_invs = [other for other in inv_by_product.get(product.id, []) if other.store_id != store.id]
        best_donor = max(other_invs, key=lambda x: x.available_quantity, default=None) if other_invs else None

        if urgency == "critical":
            if best_donor and best_donor.available_quantity > 15:
                transfer_qty = min(25, best_donor.available_quantity // 2)
                recommendation = f"Urgent: Transfer {transfer_qty} units from {best_donor.store.name} ({best_donor.available_quantity} avail) to {store.name} now."
            else:
                restock_qty = max(30, inv.reorder_level * 5)
                recommendation = f"Urgent Restock: Order {restock_qty} units from main supplier for {store.name}."
        elif urgency == "warning":
            if best_donor and best_donor.available_quantity > 20:
                transfer_qty = 15
                recommendation = f"Preemptive Move: Transfer {transfer_qty} units from {best_donor.store.name} to {store.name} within 5 days."
            else:
                recommendation = f"Monitor Stock: Prepare reorder of {inv.reorder_level * 3} units for {store.name}."
        else:
            recommendation = f"Healthy Stock: Current inventory at {store.name} is sufficient for > {days_until_stockout} days."

        forecast_results.append(
            {
                "sku": product.sku,
                "product_name": product.name,
                "category": product.category,
                "store_code": store.code,
                "store_name": store.name,
                "available_quantity": avail,
                "reorder_level": inv.reorder_level,
                "daily_sales_rate": daily_sales_rate,
                "days_until_stockout": days_until_stockout,
                "urgency": urgency,
                "recommendation": recommendation,
                "suggested_donor_store_code": best_donor.store.code if best_donor and best_donor.available_quantity > 10 else None,
                "suggested_transfer_qty": 20 if (urgency in ["critical", "warning"] and best_donor) else None,
            }
        )

    # Sort critical first, then warning, then stable
    urgency_weights = {"critical": 0, "warning": 1, "stable": 2}
    forecast_results.sort(key=lambda x: (urgency_weights.get(x["urgency"], 3), x["days_until_stockout"]))

    return forecast_results
