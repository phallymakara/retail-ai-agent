from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel


class ProposalConfirmRequest(BaseModel):
    proposal_id: str
    staff_user_id: str | None = None
    staff_name: str | None = None


class ProposalResponse(BaseModel):
    id: str
    proposal_type: str
    product_id: str
    sku: str | None = None
    product_name: str | None = None
    store_id: str
    store_code: str | None = None
    store_name: str | None = None
    target_store_id: str | None = None
    target_store_code: str | None = None
    target_store_name: str | None = None
    quantity_change: int
    previous_quantity: int
    new_quantity: int
    target_previous_quantity: int | None = None
    target_new_quantity: int | None = None
    reason: str | None = None
    status: str
    staff_user_id: str | None = None
    staff_name: str | None = None
    created_at: str | None = None
    executed_at: str | None = None


class AuditLogResponse(BaseModel):
    id: str
    sku: str | None = None
    product_name: str | None = None
    store_code: str | None = None
    store_name: str | None = None
    target_store_code: str | None = None
    target_store_name: str | None = None
    change_type: str
    quantity_delta: int
    previous_quantity: int
    new_quantity: int
    reason: str | None = None
    staff_user_id: str | None = None
    staff_name: str | None = None
    created_at: str | None = None
