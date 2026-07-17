from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
    )
    previous_response_id: str | None = None


class ToolExecutionResponse(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: Any


class ChatResponse(BaseModel):
    answer: str
    response_id: str
    tools_used: list[str]
    tool_executions: list[ToolExecutionResponse]