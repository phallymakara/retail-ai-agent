import math
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Inventory, InventoryAuditLog, InventoryProposal, Order, OrderItem, Product, Store


async def get_inventory_exceptions(
    session: AsyncSession,
    *,
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Scan and analyze inventory exceptions and anomalies across branches."""
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

    # 2. Fetch trailing 30-day sales velocity data
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

    # 3. Fetch pending replenishment proposals
    prop_stmt = select(InventoryProposal).where(InventoryProposal.status == "pending")
    proposals = (await session.scalars(prop_stmt)).all()
    pending_replenishments = {(p.store_id, p.product_id) for p in proposals}

    # 4. Fetch audit logs from the past 7 days
    past_7_days = datetime.now(UTC) - timedelta(days=7)
    audit_stmt = (
        select(InventoryAuditLog)
        .options(selectinload(InventoryAuditLog.product), selectinload(InventoryAuditLog.store))
        .where(InventoryAuditLog.created_at >= past_7_days)
        .order_by(InventoryAuditLog.created_at.desc())
    )
    audit_logs = (await session.scalars(audit_stmt)).all()

    exceptions = []

    # Map audit logs by (store_id, product_id)
    audit_by_item: dict[tuple[Any, Any], list[InventoryAuditLog]] = {}
    for log in audit_logs:
        audit_by_item.setdefault((log.store_id, log.product_id), []).append(log)

    for inv in inventories:
        product = inv.product
        store = inv.store
        avail = inv.available_quantity
        qty = inv.quantity
        rsvd = inv.reserved_quantity

        # Check: 1. Negative Inventory
        if qty < 0 or avail < 0:
            exceptions.append(
                {
                    "sku": product.sku,
                    "product_name": product.name,
                    "store_code": store.code,
                    "store_name": store.name,
                    "type": "negative_stock",
                    "severity": "critical",
                    "details": f"Negative stock detected: available is {avail} units (total stock: {qty}, reserved: {rsvd}).",
                    "suggested_action": "Propose correction: Add stock adjustment to reconcile physical count.",
                }
            )

        # Check: 2. Reservation Mismatches
        if qty - rsvd != avail:
            exceptions.append(
                {
                    "sku": product.sku,
                    "product_name": product.name,
                    "store_code": store.code,
                    "store_name": store.name,
                    "type": "stock_mismatch",
                    "severity": "critical",
                    "details": f"Calculation Mismatch: Quantity ({qty}) minus Reserved ({rsvd}) does not equal Available ({avail}).",
                    "suggested_action": "Recalculate allocations: Audit reserved orders database integrity.",
                }
            )
        elif rsvd > qty or rsvd < 0:
            exceptions.append(
                {
                    "sku": product.sku,
                    "product_name": product.name,
                    "store_code": store.code,
                    "store_name": store.name,
                    "type": "stock_mismatch",
                    "severity": "critical",
                    "details": f"Reservation anomaly: Reserved stock ({rsvd}) exceeds total inventory quantity ({qty}).",
                    "suggested_action": "Audit reservation data: Release expired order holds.",
                }
            )

        # Check recent audit logs for sudden drops, missing reasons, or large updates
        item_logs = audit_by_item.get((store.id, product.id), [])
        for log in item_logs:
            # Check: 3. Sudden Stock Drops
            if log.quantity_delta < -30 or (log.previous_quantity > 0 and log.quantity_delta / log.previous_quantity <= -0.5):
                pct = round(abs(log.quantity_delta) / (log.previous_quantity or 1) * 100)
                exceptions.append(
                    {
                        "sku": product.sku,
                        "product_name": product.name,
                        "store_code": store.code,
                        "store_name": store.name,
                        "type": "sudden_drop",
                        "severity": "warning",
                        "details": f"Sudden drop: Stock decreased by {abs(log.quantity_delta)} units ({pct}%) on {log.created_at.strftime('%Y-%m-%d')} (Change Type: {log.change_type}).",
                        "suggested_action": "Investigate shrinkage: Check store transaction logs or review safety reports.",
                    }
                )

            # Check: 4. Inventory Changes Without a Reason
            if log.change_type.startswith("adjustment") and (not log.reason or not log.reason.strip()):
                exceptions.append(
                    {
                        "sku": product.sku,
                        "product_name": product.name,
                        "store_code": store.code,
                        "store_name": store.name,
                        "type": "missing_reason",
                        "severity": "warning",
                        "details": f"Audit Gap: Manual adjustment of {log.quantity_delta} units recorded without justification by {log.staff_name or 'Unknown'}.",
                        "suggested_action": "Add reason: Update audit trail comments.",
                    }
                )

            # Check: 5. Large Manual Adjustments
            if log.change_type.startswith("adjustment") and (abs(log.quantity_delta) >= 50 or (abs(log.quantity_delta) * float(product.price)) >= 500):
                exceptions.append(
                    {
                        "sku": product.sku,
                        "product_name": product.name,
                        "store_code": store.code,
                        "store_name": store.name,
                        "type": "large_adjustment",
                        "severity": "warning",
                        "details": f"Large manual update: Stock changed by {log.quantity_delta} units by {log.staff_name or 'System'} (Value: ${round(abs(log.quantity_delta) * float(product.price), 2)}).",
                        "suggested_action": "Manager review: Verify supervisor authorization records.",
                    }
                )

        # Check: 6. Dead Stock (No sales but high stock)
        sold_qty = sales_map.get((store.id, product.id), 0)
        if sold_qty == 0 and avail >= 50:
            exceptions.append(
                {
                    "sku": product.sku,
                    "product_name": product.name,
                    "store_code": store.code,
                    "store_name": store.name,
                    "type": "dead_stock",
                    "severity": "info",
                    "details": f"Dead stock warning: High stock level ({avail} units) but zero sales recorded over the past 30 days.",
                    "suggested_action": "Promote item: Add discount or transfer surplus to highly active branches.",
                }
            )

        # Check: 7. Fast-moving Product with No Replenishment
        if sold_qty > 0:
            daily_sales_rate = round(sold_qty / 30.0, 1)
            if daily_sales_rate >= 3.0:
                days_to_stockout = math.ceil(avail / daily_sales_rate) if avail > 0 else 0
                if days_to_stockout <= 3 and (store.id, product.id) not in pending_replenishments:
                    exceptions.append(
                        {
                            "sku": product.sku,
                            "product_name": product.name,
                            "store_code": store.code,
                            "store_name": store.name,
                            "type": "fast_moving_unreplenished",
                            "severity": "critical",
                            "details": f"Fast-moving risk: Stockout predicted in {days_to_stockout} days due to high velocity ({daily_sales_rate}/day). No pending restock proposals exist.",
                            "suggested_action": "Order Restock: Initiate adjustment proposal immediately.",
                        }
                    )

    # Sort critical first, then warning, then info
    priority = {"critical": 0, "warning": 1, "info": 2}
    exceptions.sort(key=lambda x: (priority.get(x["severity"], 3), x["sku"]))

    return exceptions
