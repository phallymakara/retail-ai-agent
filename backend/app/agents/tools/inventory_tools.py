from typing import Any

from app.db.session import AsyncSessionFactory
from app.services import alert_service, forecast_service, inventory_service, reorder_service


async def check_reorder_alerts(
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Check products reaching or falling below reorder level."""
    async with AsyncSessionFactory() as session:
        return await inventory_service.check_reorder_alerts(
            session,
            store_code=store_code,
        )


async def propose_stock_adjustment(
    sku: str,
    store_code: str,
    quantity_change: int,
    reason: str | None = None,
    staff_user_id: str | None = None,
    staff_name: str | None = None,
) -> dict[str, Any]:
    """Propose an inventory increase or decrease at a store branch."""
    async with AsyncSessionFactory() as session:
        return await inventory_service.propose_stock_adjustment(
            session,
            sku=sku,
            store_code=store_code,
            quantity_change=quantity_change,
            reason=reason,
            staff_user_id=staff_user_id,
            staff_name=staff_name,
        )


async def propose_stock_transfer(
    sku: str,
    from_store_code: str,
    to_store_code: str,
    quantity: int,
    reason: str | None = None,
    staff_user_id: str | None = None,
    staff_name: str | None = None,
) -> dict[str, Any]:
    """Propose transferring stock from one store branch to another."""
    async with AsyncSessionFactory() as session:
        return await inventory_service.propose_stock_transfer(
            session,
            sku=sku,
            from_store_code=from_store_code,
            to_store_code=to_store_code,
            quantity=quantity,
            reason=reason,
            staff_user_id=staff_user_id,
            staff_name=staff_name,
        )


async def confirm_inventory_action(
    proposal_id: str,
    staff_user_id: str | None = None,
    staff_name: str | None = None,
) -> dict[str, Any]:
    """Confirm and execute a pending stock adjustment or stock transfer proposal."""
    async with AsyncSessionFactory() as session:
        return await inventory_service.confirm_inventory_proposal(
            session,
            proposal_id=proposal_id,
            staff_user_id=staff_user_id,
            staff_name=staff_name,
        )


async def get_inventory_audit_logs(
    store_code: str | None = None,
    sku: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Retrieve historical inventory change audit logs."""
    async with AsyncSessionFactory() as session:
        return await inventory_service.get_inventory_audit_logs(
            session,
            store_code=store_code,
            sku=sku,
            limit=limit,
        )


async def generate_inventory_report(
    store_code: str | None = None,
) -> dict[str, Any]:
    """Generate an inventory summary report across store branches."""
    async with AsyncSessionFactory() as session:
        return await inventory_service.generate_inventory_report(
            session,
            store_code=store_code,
        )


async def predictive_demand_forecast(
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Predict product sales velocity, days until stockout, and AI restocking recommendations."""
    async with AsyncSessionFactory() as session:
        return await forecast_service.get_demand_forecast(
            session,
            store_code=store_code,
        )


async def predictive_reorder_recommendation(
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Predict when to reorder stock, calculate lead-time demand, promotions impact, and overstock levels."""
    async with AsyncSessionFactory() as session:
        return await reorder_service.get_reorder_recommendations(
            session,
            store_code=store_code,
        )


async def check_inventory_exceptions(
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    """Scan and audit inventory for anomalies, negative stocks, reservation mismatches, sudden drops, or missing reason logs."""
    async with AsyncSessionFactory() as session:
        return await alert_service.get_inventory_exceptions(
            session,
            store_code=store_code,
        )
