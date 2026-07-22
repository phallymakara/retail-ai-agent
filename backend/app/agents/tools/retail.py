from typing import Any

from app.db.session import AsyncSessionFactory
from app.services import retail_catalog


async def search_products(
    query: str | None = None,
    category: str | None = None,
    store_code: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search active products by name, SKU, brand, category or store branch."""
    async with AsyncSessionFactory() as session:
        return await retail_catalog.search_products(
            session,
            query=query,
            category=category,
            store_code=store_code,
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


async def add_to_cart(
    sku: str,
    quantity: int = 1,
) -> dict[str, Any]:
    """Add a product to the customer's shopping cart by looking up its details."""
    async with AsyncSessionFactory() as session:
        product_info = await retail_catalog.get_product_details(session, sku=sku)
        if not product_info:
            return {"success": False, "error": f"Product with SKU '{sku}' not found."}
        
        return {
            "success": True,
            "sku": sku,
            "product_name": product_info.get("name"),
            "price": float(product_info.get("price")) if product_info.get("price") is not None else 0.0,
            "image_url": product_info.get("image_url"),
            "quantity": quantity,
            "message": f"Successfully added {quantity} x {product_info.get('name')} to your cart."
        }


async def get_order_history(
    auth_user_id: str | None = None,
    limit: int = 5,
    period: str | None = None,
) -> list[dict[str, Any]]:
    """Retrieve order history for the currently logged-in customer, optionally filtered by period."""
    if not auth_user_id:
        return [{"error": "Authentication is required to view order history. Please sign in."}]
        
    async with AsyncSessionFactory() as session:
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload, selectinload
        from app.models import Order
        from datetime import datetime, time, timedelta, timezone
        
        query = select(Order).options(
            joinedload(Order.store),
            selectinload(Order.items),
        ).where(Order.auth_user_id == auth_user_id)
        
        if period:
            p = period.lower().strip()
            now = datetime.now(timezone.utc)
            today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
            
            if p == "today":
                query = query.where(Order.created_at >= today_start)
            elif p == "yesterday":
                start_dt = today_start - timedelta(days=1)
                end_dt = today_start - timedelta(microseconds=1)
                query = query.where(Order.created_at.between(start_dt, end_dt))
            elif p == "this_week":
                start_dt = today_start - timedelta(days=now.weekday())
                query = query.where(Order.created_at >= start_dt)
            elif p == "last_week":
                this_week_start = today_start - timedelta(days=now.weekday())
                start_dt = this_week_start - timedelta(days=7)
                end_dt = this_week_start - timedelta(microseconds=1)
                query = query.where(Order.created_at.between(start_dt, end_dt))
            elif p == "this_month":
                start_dt = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
                query = query.where(Order.created_at >= start_dt)
                
        result = await session.scalars(
            query.order_by(Order.created_at.desc()).limit(limit)
        )
        orders = result.all()
        
        history = []
        for order in orders:
            history.append({
                "order_number": order.order_number,
                "store_name": order.store.name,
                "status": order.status,
                "fulfillment_type": order.fulfillment_type,
                "total_amount": float(order.total_amount),
                "created_at": order.created_at.isoformat(),
                "items": [
                    {
                        "sku": it.product_sku,
                        "name": it.product_name,
                        "quantity": it.quantity,
                        "line_total": float(it.line_total),
                    }
                    for it in order.items
                ]
            })
        return history