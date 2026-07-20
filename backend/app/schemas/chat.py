from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
    )
    previous_response_id: str | None = None
    store_code: str | None = None
    conversation_id: str | None = None
    auth_user_id: str | None = None
    is_authenticated: bool = False
    guest_question_count: int = 0


class ToolExecutionResponse(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: Any


class ChatResponse(BaseModel):
    answer: str
    response_id: str
    tools_used: list[str]
    tool_executions: list[ToolExecutionResponse]


class ChatMessageDetailResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    tool_executions: list[dict[str, Any]] | None = None
    response_id: str | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    id: uuid.UUID
    auth_user_id: str | None = None
    store_code: str | None = None
    title: str
    response_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(ConversationResponse):
    messages: list[ChatMessageDetailResponse] = []