from fastapi import APIRouter, HTTPException, status
from openai import (
    APIConnectionError,
    APIStatusError,
    RateLimitError,
)

from app.agents.retail_agent import RetailAgent
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ToolExecutionResponse,
)


router = APIRouter(
    prefix="/api/v1/chat",
    tags=["AI Agent"],
)


@router.post(
    "",
    response_model=ChatResponse,
)
async def chat(
    request: ChatRequest,
) -> ChatResponse:
    agent = RetailAgent()

    try:
        result = await agent.run(
            request.message,
            previous_response_id=(
                request.previous_response_id
            ),
        )

        executions = [
            ToolExecutionResponse(
                name=execution.name,
                arguments=execution.arguments,
                result=execution.result,
            )
            for execution in result.tool_executions
        ]

        return ChatResponse(
            answer=result.text,
            response_id=result.response_id,
            tools_used=[
                execution.name
                for execution in result.tool_executions
            ],
            tool_executions=executions,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except RateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The AI service is temporarily busy.",
        ) from exc

    except APIConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to connect to Microsoft Foundry.",
        ) from exc

    except APIStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Microsoft Foundry returned an error.",
        ) from exc