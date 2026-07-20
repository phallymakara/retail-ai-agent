from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
    )
    previous_response_id: str | None = None
    store_code: str | None = None
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