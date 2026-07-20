import json
import asyncio
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import (
    APIConnectionError,
    APIStatusError,
    RateLimitError,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.retail_agent import RetailAgent
from app.db.session import AsyncSessionFactory, get_db_session
from app.schemas.chat import (
    ChatRequest,
    ConversationDetailResponse,
    ConversationResponse,
)
from app.services import retail_catalog
from app.services.conversation_service import (
    add_chat_message,
    create_or_get_conversation,
    delete_conversation,
    get_conversation_details,
    get_user_conversations,
)

router = APIRouter(
    prefix="/api/v1/chat",
    tags=["AI Agent"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


async def stream_agent_response(request: ChatRequest):
    if not request.is_authenticated and request.guest_question_count >= 3:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'You have reached the limit of 3 questions for guest users. Please sign in to continue asking questions.'}, ensure_ascii=False)}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"
        return

    conv_id: str | None = None
    response_id_history: str | None = None

    try:
        async with AsyncSessionFactory() as session:
            conv = await create_or_get_conversation(
                session,
                conversation_id=request.conversation_id,
                auth_user_id=request.auth_user_id,
                store_code=request.store_code,
                first_message=request.message,
            )
            await add_chat_message(
                session,
                conversation_id=conv.id,
                role="user",
                content=request.message,
            )
            await session.commit()
            conv_id = str(conv.id)
            response_id_history = conv.response_id
    except Exception as exc:
        print(f"Warning: Failed to save initial user message to DB: {exc}")

    if conv_id:
        yield f"data: {json.dumps({'type': 'conversation_id', 'conversation_id': conv_id}, ensure_ascii=False)}\n\n"

    # Simulated Image Analysis for Prototype
    is_image_request = request.has_image or any(
        kw in request.message.lower()
        for kw in ["[uploaded image]", "analyze this uploaded image", "image"]
    )

    if is_image_request:
        milk_results = []
        rice_results = []
        try:
            async with AsyncSessionFactory() as session:
                milk_results = await retail_catalog.search_products(session, query="milk", limit=5)
                rice_results = await retail_catalog.search_products(session, query="rice", limit=5)
        except Exception as exc:
            print(f"Catalog search exception for image simulation: {exc}")

        if not milk_results:
            milk_results = [
                {
                    "id": str(uuid.uuid4()),
                    "sku": "MILK-001",
                    "name": "Fresh Whole Milk (1L)",
                    "name_km": "ទឹកដោះគោស្រស់ 1L",
                    "category": "Dairy",
                    "description": "100% Pure Fresh Whole Milk",
                    "price": "2.50",
                    "currency": "USD",
                    "brand": "Angkor Dairy",
                    "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400",
                    "is_active": True,
                }
            ]
        if not rice_results:
            rice_results = [
                {
                    "id": str(uuid.uuid4()),
                    "sku": "RICE-001",
                    "name": "Premium Jasmine Rice (5kg)",
                    "name_km": "អង្ករផ្ការំដួល 5kg",
                    "category": "Grains",
                    "description": "Cambodian Premium Phka Rumduol Jasmine Rice",
                    "price": "8.90",
                    "currency": "USD",
                    "brand": "Angkor Harvest",
                    "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",
                    "is_active": True,
                }
            ]

        simulated_tools = [
            {
                "name": "search_products",
                "arguments": {"query": "milk"},
                "result": milk_results,
            },
            {
                "name": "search_products",
                "arguments": {"query": "rice"},
                "result": rice_results,
            },
        ]

        simulated_text = (
            "I analyzed your uploaded image! I detected the following items in your picture:\n\n"
            "1. 🥛 **Fresh Whole Milk**\n"
            "2. 🌾 **Premium Jasmine Rice**\n\n"
            "Here are the matching products available in our store:"
        )

        simulated_response_id = f"resp-{uuid.uuid4().hex[:12]}"

        if conv_id:
            try:
                async with AsyncSessionFactory() as session:
                    await add_chat_message(
                        session,
                        conversation_id=uuid.UUID(conv_id),
                        role="assistant",
                        content=simulated_text,
                        tool_executions=simulated_tools,
                        response_id=simulated_response_id,
                    )
                    await session.commit()
            except Exception as exc:
                print(f"Warning: Failed to save assistant simulated image response to DB: {exc}")

        yield f"data: {json.dumps({'type': 'tools', 'tool_executions': simulated_tools}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'response_id', 'response_id': simulated_response_id}, ensure_ascii=False)}\n\n"

        words = simulated_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'content', 'delta': chunk}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.015)

        yield "data: {\"type\": \"done\"}\n\n"
        return

    agent = RetailAgent()
    try:
        result = await agent.run(
            request.message,
            previous_response_id=request.previous_response_id or response_id_history,
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

        if conv_id:
            try:
                async with AsyncSessionFactory() as session:
                    await add_chat_message(
                        session,
                        conversation_id=uuid.UUID(conv_id),
                        role="assistant",
                        content=result.text,
                        tool_executions=executions,
                        response_id=result.response_id,
                    )
                    await session.commit()
            except Exception as exc:
                print(f"Warning: Failed to save assistant response to DB: {exc}")

        # 3. Yield tool executions
        yield f"data: {json.dumps({'type': 'tools', 'tool_executions': executions}, ensure_ascii=False)}\n\n"
        
        # 4. Yield response_id for session context
        yield f"data: {json.dumps({'type': 'response_id', 'response_id': result.response_id}, ensure_ascii=False)}\n\n"

        # 5. Yield the text response chunk-by-chunk for smooth typing animation
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


@router.get(
    "/conversations/user/{auth_user_id}",
    response_model=list[ConversationResponse],
)
async def get_user_conversations_route(
    auth_user_id: str,
    session: DatabaseSession,
):
    return await get_user_conversations(session, auth_user_id)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
async def get_conversation_details_route(
    conversation_id: uuid.UUID,
    session: DatabaseSession,
):
    conv = await get_conversation_details(session, conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return conv


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation_route(
    conversation_id: uuid.UUID,
    session: DatabaseSession,
):
    success = await delete_conversation(session, conversation_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    await session.commit()