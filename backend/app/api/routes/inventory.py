from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.inventory import ProposalConfirmRequest
from app.services import alert_service, forecast_service, inventory_service, reorder_service
from app.services.report_export_service import generate_excel_report, generate_pdf_report

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


@router.get("/reports/export/pdf")
async def export_inventory_pdf_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    report_data = await inventory_service.generate_inventory_report(
        session,
        store_code=store_code,
    )
    pdf_bytes = generate_pdf_report(report_data)
    code_str = store_code.upper() if store_code else "All_Branches"
    filename = f"Inventory_Report_{code_str}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/export/excel")
async def export_inventory_excel_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    report_data = await inventory_service.generate_inventory_report(
        session,
        store_code=store_code,
    )
    excel_bytes = generate_excel_report(report_data)
    code_str = store_code.upper() if store_code else "All_Branches"
    filename = f"Inventory_Report_{code_str}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/forecast")
async def get_demand_forecast_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    return await forecast_service.get_demand_forecast(
        session,
        store_code=store_code,
    )


@router.get("/reorder-recommendations")
async def get_reorder_recommendations_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    return await reorder_service.get_reorder_recommendations(
        session,
        store_code=store_code,
    )


@router.get("/exception-alerts")
async def get_exception_alerts_route(
    session: DatabaseSession,
    store_code: str | None = None,
):
    return await alert_service.get_inventory_exceptions(
        session,
        store_code=store_code,
    )
