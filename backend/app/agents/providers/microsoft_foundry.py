from collections.abc import Sequence
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings


class MicrosoftFoundryProvider:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            api_key=(
                settings.OPENAI_API_KEY.get_secret_value()
            ),
            base_url=str(settings.OPENAI_BASE_URL),
            timeout=settings.AGENT_TIMEOUT_SECONDS,
            max_retries=2,
        )

    async def create_response(
        self,
        *,
        instructions: str,
        input_data: str | list[dict[str, Any]],
        tools: Sequence[dict[str, Any]] = (),
        previous_response_id: str | None = None,
    ) -> Any:
        request: dict[str, Any] = {
            "model": (
                settings.AZURE_AI_MODEL_DEPLOYMENT_NAME
            ),
            "instructions": instructions,
            "input": input_data,
        }

        if tools:
            request["tools"] = list(tools)

        if previous_response_id:
            request["previous_response_id"] = (
                previous_response_id
            )

        return await self.client.responses.create(
            **request
        )