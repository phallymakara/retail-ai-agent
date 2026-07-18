import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.agents.providers.microsoft_foundry import (
    MicrosoftFoundryProvider,
)
from app.agents.tools import (
    check_inventory,
    get_active_promotions,
    get_product_details,
    search_products,
)


RETAIL_AGENT_INSTRUCTIONS = """
You are a retail shopping and inventory assistant for stores in Cambodia.

You help customers and staff:
- Search for products.
- View product information and prices.
- Check product availability at different stores.
- Find active promotions.

Rules:
1. Use tools for all product, price, inventory and promotion information.
2. Never invent products, prices, stock quantities or promotions.
3. If the user provides a product name instead of an SKU, call
   search_products first to identify the correct product.
4. If there are multiple matching products, ask the user to clarify.
5. Mention the store name when discussing availability.
6. Treat available_quantity as the quantity available to customers.
7. Reply in the same language as the user when possible.
8. Keep customer answers friendly, clear and concise.
9. Do not list raw product properties (such as Category, Brand, Description, Price, Image, etc.) in your text response. Specifically, never output the price (e.g., "Price: $8.50") or image links in the text response, since these are already displayed dynamically in the visual product card directly below your response. Instead, provide a brief, friendly introduction about the product (e.g., "I found this Jasmine Rice for you:") and let the visual product card show the details.
""".strip()


TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "search_products",
        "description": (
            "Search active products by product name, Khmer name, "
            "SKU, brand or category."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": ["string", "null"],
                    "description": (
                        "Product name, SKU, Khmer name or brand."
                    ),
                },
                "category": {
                    "type": ["string", "null"],
                    "description": (
                        "Optional exact product category."
                    ),
                },
                "limit": {
                    "type": "integer",
                    "description": (
                        "Maximum results from 1 to 20."
                    ),
                    "minimum": 1,
                    "maximum": 20,
                    "default": 10,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_product_details",
        "description": (
            "Get complete product information and availability "
            "across stores using an exact SKU."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": "string",
                    "description": "The exact product SKU.",
                },
            },
            "required": ["sku"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "check_inventory",
        "description": (
            "Check available inventory for an exact product SKU, "
            "optionally at one store."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": "string",
                    "description": "The exact product SKU.",
                },
                "store_code": {
                    "type": ["string", "null"],
                    "description": (
                        "Optional store code such as PP-BKK1, "
                        "PP-TTP or SR-CENTRAL."
                    ),
                },
            },
            "required": ["sku"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_active_promotions",
        "description": (
            "Get currently active promotions, optionally filtered "
            "by an exact product SKU."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": ["string", "null"],
                    "description": (
                        "Optional exact product SKU."
                    ),
                },
            },
            "additionalProperties": False,
        },
    },
]


ToolHandler = Callable[..., Awaitable[Any]]

TOOL_HANDLERS: dict[str, ToolHandler] = {
    "search_products": search_products,
    "get_product_details": get_product_details,
    "check_inventory": check_inventory,
    "get_active_promotions": get_active_promotions,
}


@dataclass
class ToolExecution:
    name: str
    arguments: dict[str, Any]
    result: Any


@dataclass
class RetailAgentResult:
    text: str
    response_id: str
    tool_executions: list[ToolExecution] = field(
        default_factory=list
    )


class RetailAgent:
    def __init__(
        self,
        provider: MicrosoftFoundryProvider | None = None,
    ) -> None:
        self.provider = (
            provider or MicrosoftFoundryProvider()
        )

    async def run(
        self,
        message: str,
        *,
        previous_response_id: str | None = None,
        store_code: str | None = None,
        max_steps: int = 6,
    ) -> RetailAgentResult:
        if not message.strip():
            raise ValueError("Message cannot be empty.")

        input_data: str | list[dict[str, Any]] = message
        tool_executions: list[ToolExecution] = []

        instructions = RETAIL_AGENT_INSTRUCTIONS
        if store_code:
            instructions += f"\n10. The user is currently browsing and shopping at the store branch with code '{store_code}'. Prioritize checking inventory and answering queries for this branch, but you can check other branches if requested."

        for _ in range(max_steps):
            response = await self.provider.create_response(
                instructions=instructions,
                input_data=input_data,
                tools=TOOL_DEFINITIONS,
                previous_response_id=previous_response_id,
            )

            function_calls = [
                item
                for item in response.output
                if item.type == "function_call"
            ]

            if not function_calls:
                return RetailAgentResult(
                    text=response.output_text,
                    response_id=response.id,
                    tool_executions=tool_executions,
                )

            tool_outputs: list[dict[str, Any]] = []

            for function_call in function_calls:
                result, arguments = await self._execute_tool(
                    name=function_call.name,
                    arguments_json=function_call.arguments,
                )

                tool_executions.append(
                    ToolExecution(
                        name=function_call.name,
                        arguments=arguments,
                        result=result,
                    )
                )

                tool_outputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": function_call.call_id,
                        "output": json.dumps(
                            result,
                            ensure_ascii=False,
                            default=str,
                        ),
                    }
                )

            input_data = tool_outputs
            previous_response_id = response.id

        raise RuntimeError(
            "The retail agent exceeded its maximum tool steps."
        )

    async def _execute_tool(
        self,
        *,
        name: str,
        arguments_json: str,
    ) -> tuple[Any, dict[str, Any]]:
        handler = TOOL_HANDLERS.get(name)

        if handler is None:
            return (
                {
                    "error": f"Unknown tool: {name}",
                },
                {},
            )

        try:
            arguments = json.loads(arguments_json)
        except json.JSONDecodeError:
            return (
                {
                    "error": (
                        f"Invalid arguments for tool: {name}"
                    ),
                },
                {},
            )

        try:
            result = await handler(**arguments)
            return result, arguments
        except (TypeError, ValueError) as exc:
            return (
                {
                    "error": str(exc),
                    "tool": name,
                },
                arguments,
            )