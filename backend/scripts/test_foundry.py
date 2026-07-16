import asyncio

from app.agents.providers.microsoft_foundry import (
    MicrosoftFoundryProvider,
)


async def main() -> None:
    provider = MicrosoftFoundryProvider()

    response = await provider.create_response(
        instructions="You are a connection-testing assistant.",
        input_data=(
            "Reply with exactly: "
            "Microsoft Foundry connection successful"
        ),
    )

    print(response.output_text)


if __name__ == "__main__":
    asyncio.run(main())