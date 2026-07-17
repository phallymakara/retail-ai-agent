import asyncio
import json

from app.agents.retail_agent import RetailAgent
from app.db.session import close_database


async def main() -> None:
    agent = RetailAgent()

    try:
        result = await agent.run(
            "Do you have fresh milk available in "
            "the Siem Reap store?"
        )

        print("\n=== Agent Answer ===")
        print(result.text)

        print("\n=== Tools Used ===")

        for execution in result.tool_executions:
            print(f"\nTool: {execution.name}")
            print(
                "Arguments:",
                json.dumps(
                    execution.arguments,
                    ensure_ascii=False,
                ),
            )
            print(
                "Result:",
                json.dumps(
                    execution.result,
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                ),
            )

        print(f"\nResponse ID: {result.response_id}")

    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())