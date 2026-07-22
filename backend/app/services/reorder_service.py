import math
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Inventory, Order, OrderItem, Product, Promotion, Store


async def get_reorder_recommendations(
    session: AsyncSession,
    *,
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Generate smart AI reorder and restock recommendations for store staff."""
    # 1. Fetch active inventories with store & product details
    stmt = (
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
        stmt = stmt.where(Store.code == store_code.strip().upper())

    inventories = (await session.scalars(stmt)).all()

    # 2. Fetch recent 30-day sales velocity
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

    # 3. Fetch active promotions to boost demand prediction
    now = datetime.now(UTC)
    promo_stmt = (
        select(Promotion.product_id)
        .where(
            Promotion.is_active.is_(True),
            Promotion.starts_at <= now,
            Promotion.ends_at >= now,
        )
    )
    promo_product_ids = set((await session.scalars(promo_stmt)).all())

    # 4. Map stores for potential inter-branch transfers of overstocked items
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

    recommendations = []

    for inv in inventories:
        product = inv.product
        store = inv.store
        avail = inv.available_quantity

        # Determine Lead Time (in days)
        # PP branches are close to suppliers (3 days), SR is remote (5 days)
        lead_time = 5 if store.code == "SR-CENTRAL" else 3

        # Compute average daily sales velocity
        sold_qty = sales_map.get((store.id, product.id), 0)
        if sold_qty <= 0:
            daily_sales_rate = round(inv.reorder_level / 4.0, 1)
        else:
            daily_sales_rate = round(sold_qty / 30.0, 1)

        daily_sales_rate = max(daily_sales_rate, 0.5)

        # Check for active promotions and apply 1.5x demand boost factor
        has_promo = product.id in promo_product_ids
        promo_factor = 1.5 if has_promo else 1.0
        predicted_daily_sales = round(daily_sales_rate * promo_factor, 1)

        # Calculate Safety Stock & Reorder Point (ROP)
        safety_stock = math.ceil(predicted_daily_sales * lead_time * 0.5)
        safety_stock = max(safety_stock, 2)
        reorder_point = math.ceil(predicted_daily_sales * lead_time) + safety_stock

        # Check other stores to find a critical restock branch or transfer source
        other_invs = [other for other in inv_by_product.get(product.id, []) if other.store_id != store.id]

        status = "healthy"
        suggested_qty = 0
        recommendation = ""
        suggested_transfer_store = None

        # Check Status Classification
        if avail <= inv.reorder_level:
            status = "restock_urgent"
        elif avail <= reorder_point:
            status = "restock_warning"
        elif avail > (reorder_point + predicted_daily_sales * 25):
            status = "overstock"

        # Formulate Recommendations
        if status == "restock_urgent":
            # Check if another store has overstock surplus to transfer from
            best_donor = max(other_invs, key=lambda x: x.available_quantity, default=None) if other_invs else None
            if best_donor and best_donor.available_quantity > (best_donor.reorder_level * 3):
                transfer_qty = min(20, best_donor.available_quantity // 2)
                status = "restock_urgent_transfer"
                suggested_qty = transfer_qty
                suggested_transfer_store = best_donor.store.code
                recommendation = f"Urgent: Transfer {transfer_qty} units from {best_donor.store.name} to {store.name} immediately to cover lead-time stockout risk."
            else:
                suggested_qty = max(10, math.ceil((reorder_point * 2 - avail) / 5) * 5)
                recommendation = f"Urgent Supplier Restock: Order {suggested_qty} units for {store.name}. Current stock {avail} is below safety threshold."
        elif status == "restock_warning":
            suggested_qty = max(10, math.ceil((reorder_point * 1.5 - avail) / 5) * 5)
            promo_msg = " (promotion active)" if has_promo else ""
            recommendation = f"Preemptive Restock: Order {suggested_qty} units for {store.name} to balance upcoming demand{promo_msg}."
        elif status == "overstock":
            # Suggest transferring excess stock to understocked branches
            understocked_branch = min(other_invs, key=lambda x: x.available_quantity, default=None) if other_invs else None
            if understocked_branch and understocked_branch.available_quantity <= understocked_branch.reorder_level:
                transfer_qty = max(10, math.ceil((avail - reorder_point) / 2))
                suggested_qty = transfer_qty
                suggested_transfer_store = understocked_branch.store.code
                recommendation = f"Overstock Action: Transfer {transfer_qty} units to {understocked_branch.store.name} where stock levels are critically low."
            else:
                recommendation = f"Overstock Warning: {store.name} has a surplus of {avail} units. Pause standard restock orders."
        else:
            recommendation = f"Healthy Stock: Current stock levels are sufficient. Forecast shows {math.ceil(avail / predicted_daily_sales)} days supply."

        recommendations.append(
            {
                "sku": product.sku,
                "product_name": product.name,
                "category": product.category,
                "store_code": store.code,
                "store_name": store.name,
                "available_quantity": avail,
                "reserved_quantity": inv.reserved_quantity,
                "reorder_level": inv.reorder_level,
                "lead_time_days": lead_time,
                "daily_sales_rate": daily_sales_rate,
                "has_active_promotion": has_promo,
                "predicted_daily_sales": predicted_daily_sales,
                "safety_stock": safety_stock,
                "reorder_point": reorder_point,
                "status": status,
                "suggested_quantity": suggested_qty,
                "suggested_transfer_store_code": suggested_transfer_store,
                "recommendation": recommendation,
            }
        )

    # Sort urgent items first, then warning, then overstock, then healthy
    sort_priority = {"restock_urgent": 0, "restock_urgent_transfer": 0, "restock_warning": 1, "overstock": 2, "healthy": 3}
    recommendations.sort(key=lambda x: (sort_priority.get(x["status"], 4), x["available_quantity"]))

    return recommendations
