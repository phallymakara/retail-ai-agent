from openai import AsyncOpenAI

from app.core.config import settings


class MicrosoftFoundryProvider:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            base_url=settings.AZURE_OPENAI_BASE_URL,
            timeout=settings.AGENT_TIMEOUT_SECONDS,
            max_retries=2,
        )

    async def create_response(
        self,
        *,
        instructions: str,
        input_data,
        tools: list[dict],
        previous_response_id: str | None = None,
    ):
        request = {
            "model": settings.AZURE_AI_MODEL_DEPLOYMENT_NAME,
            "instructions": instructions,
            "input": input_data,
            "tools": tools,
        }

        if previous_response_id is not None:
            request["previous_response_id"] = (
                previous_response_id
            )

        return await self.client.responses.create(**request)