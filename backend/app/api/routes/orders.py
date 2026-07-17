from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.db.session import get_db_session
from app.models import Order
from app.schemas.order import (
    OrderCreateRequest,
    OrderItemResponse,
    OrderResponse,
)
from app.services.order_service import (
    InsufficientInventoryError,
    OrderError,
    OrderLineInput,
    ProductNotFoundError,
    StoreNotFoundError,
    create_order,
)


router = APIRouter(
    prefix="/api/v1/orders",
    tags=["Orders"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


def build_order_response(
    order: Order,
    *,
    store_code: str,
    store_name: str,
) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        store_code=store_code,
        store_name=store_name,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_email=order.customer_email,
        fulfillment_type=order.fulfillment_type,
        delivery_address=order.delivery_address,
        customer_note=order.customer_note,
        status=order.status,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        currency=order.currency,
        created_at=order.created_at,
        confirmed_at=order.confirmed_at,
        items=[
            OrderItemResponse(
                product_id=item.product_id,
                sku=item.product_sku,
                name=item.product_name,
                name_km=item.product_name_km,
                image_url=item.product_image_url,
                unit_price=item.unit_price,
                quantity=item.quantity,
                line_total=item.line_total,
                currency=item.currency,
            )
            for item in order.items
        ],
    )


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def place_order(
    request: OrderCreateRequest,
    session: DatabaseSession,
) -> OrderResponse:
    try:
        async with session.begin():
            order = await create_order(
                session,
                store_code=request.store_code,
                customer_name=request.customer_name,
                customer_phone=request.customer_phone,
                customer_email=request.customer_email,
                fulfillment_type=request.fulfillment_type,
                delivery_address=request.delivery_address,
                customer_note=request.customer_note,
                payment_method=request.payment_method,
                lines=[
                    OrderLineInput(
                        sku=item.sku,
                        quantity=item.quantity,
                    )
                    for item in request.items
                ],
            )

            store_code = order.store.code
            store_name = order.store.name

        return build_order_response(
            order,
            store_code=store_code,
            store_name=store_name,
        )

    except StoreNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except InsufficientInventoryError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(exc),
                "sku": exc.sku,
                "requested": exc.requested,
                "available": exc.available,
            },
        ) from exc

    except OrderError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/{order_number}",
    response_model=OrderResponse,
)
async def get_order(
    order_number: str,
    session: DatabaseSession,
) -> OrderResponse:
    order = await session.scalar(
        select(Order)
        .options(
            joinedload(Order.store),
            selectinload(Order.items),
        )
        .where(Order.order_number == order_number)
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order was not found.",
        )

    return build_order_response(
        order,
        store_code=order.store.code,
        store_name=order.store.name,
    )