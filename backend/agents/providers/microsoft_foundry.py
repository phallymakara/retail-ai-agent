from collections.abc import Callable, Sequence
from typing import Any

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

from app.core.config import settings


class MicrosoftFoundryProvider:
    def __init__(
        self,
        *,
        credential: Any | None = None,
        client_factory: Callable[..., Any] = FoundryChatClient,
    ) -> None:
        self._credential = credential or AzureCliCredential()

        self._client = client_factory(
            project_endpoint=settings.FOUNDRY_PROJECT_ENDPOINT,
            model=settings.FOUNDRY_MODEL,
            credential=self._credential,
        )

    async def create_response(
        self,
        *,
        instructions: str,
        input_data: str,
        tools: Sequence[Callable[..., Any]] = (),
    ) -> Any:
        agent = Agent(
            client=self._client,
            name="RetailAssistant",
            instructions=instructions,
            tools=list(tools),
        )

        return await agent.run(input_data)