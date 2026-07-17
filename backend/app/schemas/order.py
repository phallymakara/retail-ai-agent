import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class OrderItemCreate(BaseModel):
    sku: str = Field(
        min_length=1,
        max_length=80,
        examples=["MILK-UHT-1L"],
    )
    quantity: int = Field(
        ge=1,
        le=99,
        examples=[1],
    )


class OrderCreateRequest(BaseModel):
    store_code: str = Field(
        min_length=1,
        max_length=50,
        examples=["SR-CENTRAL"],
    )
    customer_name: str = Field(
        min_length=2,
        max_length=150,
    )
    customer_phone: str = Field(
        min_length=8,
        max_length=30,
    )
    customer_email: str | None = Field(
        default=None,
        max_length=254,
    )
    fulfillment_type: Literal["pickup", "delivery"] = "pickup"
    delivery_address: str | None = Field(
        default=None,
        max_length=1000,
    )
    customer_note: str | None = Field(
        default=None,
        max_length=1000,
    )
    payment_method: Literal[
        "cash",
        "pay_at_store",
    ] = "cash"
    items: list[OrderItemCreate] = Field(
        min_length=1,
        max_length=50,
    )

    @model_validator(mode="after")
    def validate_delivery_address(
        self,
    ) -> "OrderCreateRequest":
        if (
            self.fulfillment_type == "delivery"
            and not self.delivery_address
        ):
            raise ValueError(
                "delivery_address is required for delivery orders"
            )

        return self


class OrderItemResponse(BaseModel):
    product_id: uuid.UUID
    sku: str
    name: str
    name_km: str | None
    image_url: str | None
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    currency: str


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    store_code: str
    store_name: str
    customer_name: str
    customer_phone: str
    customer_email: str | None
    fulfillment_type: str
    delivery_address: str | None
    customer_note: str | None
    status: str
    payment_method: str
    payment_status: str
    subtotal: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    currency: str
    created_at: datetime
    confirmed_at: datetime | None
    items: list[OrderItemResponse]