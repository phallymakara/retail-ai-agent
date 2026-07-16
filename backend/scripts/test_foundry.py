import asyncio

from app.agents.providers.microsoft_foundry import (
    MicrosoftFoundryProvider,
)


async def main():
    provider = MicrosoftFoundryProvider()

    response = await provider.create_response(
        instructions=(
            "You are a connection-testing assistant."
        ),
        input_data=(
            "Reply with exactly: "
            "Microsoft Foundry connection successful"
        ),
        tools=[],
    )

    print(response.output_text)


asyncio.run(main())