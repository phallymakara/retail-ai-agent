import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import ChatMessageModel, Conversation


def generate_title(message: str) -> str:
    cleaned = message.strip()
    if not cleaned:
        return "New Conversation"
    if len(cleaned) <= 60:
        return cleaned
    return cleaned[:57] + "..."


async def create_or_get_conversation(
    session: AsyncSession,
    *,
    conversation_id: str | None = None,
    auth_user_id: str | None = None,
    store_code: str | None = None,
    first_message: str = "",
) -> Conversation:
    if conversation_id:
        try:
            conv_uuid = uuid.UUID(conversation_id)
            existing = await session.scalar(
                select(Conversation).where(Conversation.id == conv_uuid)
            )
            if existing:
                if auth_user_id and not existing.auth_user_id:
                    existing.auth_user_id = auth_user_id
                if store_code and not existing.store_code:
                    existing.store_code = store_code
                return existing
        except (ValueError, TypeError):
            pass

    title = generate_title(first_message)
    new_conv = Conversation(
        id=uuid.uuid4(),
        auth_user_id=auth_user_id,
        store_code=store_code,
        title=title,
    )
    session.add(new_conv)
    await session.flush()
    return new_conv


async def add_chat_message(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    role: str,
    content: str,
    tool_executions: list[dict[str, Any]] | None = None,
    response_id: str | None = None,
) -> ChatMessageModel:
    msg = ChatMessageModel(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        role=role,
        content=content,
        tool_executions=tool_executions,
        response_id=response_id,
    )
    session.add(msg)

    if response_id:
        conv = await session.scalar(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        if conv:
            conv.response_id = response_id

    await session.flush()
    return msg


async def get_user_conversations(
    session: AsyncSession,
    auth_user_id: str,
) -> list[Conversation]:
    result = await session.scalars(
        select(Conversation)
        .where(Conversation.auth_user_id == auth_user_id)
        .order_by(Conversation.updated_at.desc())
    )
    return list(result.all())


async def get_conversation_details(
    session: AsyncSession,
    conversation_id: uuid.UUID,
) -> Conversation | None:
    return await session.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )


async def delete_conversation(
    session: AsyncSession,
    conversation_id: uuid.UUID,
) -> bool:
    conv = await session.scalar(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    if conv is None:
        return False
    await session.delete(conv)
    await session.flush()
    return True
