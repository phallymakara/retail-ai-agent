import json
import asyncio
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import (
    APIConnectionError,
    APIStatusError,
    RateLimitError,
)

from app.agents.retail_agent import RetailAgent
from app.schemas.chat import ChatRequest

router = APIRouter(
    prefix="/api/v1/chat",
    tags=["AI Agent"],
)

async def stream_agent_response(request: ChatRequest):
    agent = RetailAgent()
    try:
        result = await agent.run(
            request.message,
            previous_response_id=request.previous_response_id,
            store_code=request.store_code,
        )

        executions = [
            {
                "name": execution.name,
                "arguments": execution.arguments,
                "result": execution.result,
            }
            for execution in result.tool_executions
        ]

        # 1. Yield tool executions first so the cards render immediately
        yield f"data: {json.dumps({'type': 'tools', 'tool_executions': executions}, ensure_ascii=False)}\n\n"
        
        # 2. Yield response_id for session context
        yield f"data: {json.dumps({'type': 'response_id', 'response_id': result.response_id}, ensure_ascii=False)}\n\n"

        # 3. Yield the text response chunk-by-chunk for smooth typing animation
        words = result.text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'content', 'delta': chunk}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.015)  # 15ms delay per word

        yield "data: {\"type\": \"done\"}\n\n"

    except ValueError as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)}, ensure_ascii=False)}\n\n"
    except RateLimitError as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'The AI service is temporarily busy.'}, ensure_ascii=False)}\n\n"
    except (APIConnectionError, APIStatusError) as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'Unable to connect to Microsoft Foundry.'}, ensure_ascii=False)}\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)}, ensure_ascii=False)}\n\n"

@router.post("")
async def chat(
    request: ChatRequest,
):
    return StreamingResponse(
        stream_agent_response(request),
        media_type="text/event-stream",
    )