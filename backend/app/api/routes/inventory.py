from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.inventory import ProposalConfirmRequest
from app.services import inventory_service

router = APIRouter(
    prefix="/api/v1/inventory",
    tags=["Inventory Management"],
)

DatabaseSession = Annotated[AsyncSession, Depends(get_db_session)]


@router.post("/proposals/confirm")
async def confirm_proposal_route(
    request: ProposalConfirmRequest,
    session: DatabaseSession,
):
    try:
        return await inventory_service.confirm_inventory_proposal(
            session,
            proposal_id=request.proposal_id,
            staff_user_id=request.staff_user_id,
            staff_name=request.staff_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/proposals/cancel")
async def cancel_proposal_route(
    request: ProposalConfirmRequest,
    session: DatabaseSession,
):
    try:
        return await inventory_service.cancel_inventory_proposal(
            session,
            proposal_id=request.proposal_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get("/reorder-alerts")
async def reorder_alerts_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    return await inventory_service.check_reorder_alerts(
        session,
        store_code=store_code,
    )


@router.get("/audit-logs")
async def audit_logs_route(
    session: DatabaseSession,
    store_code: str | None = None,
    sku: str | None = None,
    limit: int = 20,
):
    return await inventory_service.get_inventory_audit_logs(
        session,
        store_code=store_code,
        sku=sku,
        limit=limit,
    )


@router.get("/reports")
async def inventory_report_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    return await inventory_service.generate_inventory_report(
        session,
        store_code=store_code,
    )
