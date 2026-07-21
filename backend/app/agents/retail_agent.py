import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.agents.providers.microsoft_foundry import (
    MicrosoftFoundryProvider,
)
from app.agents.tools import (
    check_inventory,
    check_reorder_alerts,
    confirm_inventory_action,
    generate_inventory_report,
    get_active_promotions,
    get_inventory_audit_logs,
    get_product_details,
    predictive_demand_forecast,
    propose_stock_adjustment,
    propose_stock_transfer,
    search_products,
)

CUSTOMER_AGENT_INSTRUCTIONS = """
You are a retail shopping and customer assistant for stores in Cambodia.

You help customers:
- Search for products by name, Khmer name, SKU, brand, or category.
- View product information, prices, and available stock at store branches.
- Find active promotions and discounts.
- Assist with shopping recommendations and order guidance.

Rules:
1. Use tools for all product, price, inventory and promotion information.
2. Never invent products, prices, stock quantities or promotions.
3. If the user provides a product name instead of an SKU, call search_products first to identify the correct product.
4. Mention the store name when discussing availability.
5. Treat available_quantity as the quantity available to customers.
6. Reply in the same language as the user (Khmer or English).
7. Keep customer answers friendly, clear, and concise.
8. Do not list raw product properties (such as Category, Brand, Description, Price, Image, etc.) in text if a product card is rendered.
9. As a customer assistant, you CANNOT modify inventory or perform stock adjustments/transfers.
""".strip()


STAFF_AGENT_INSTRUCTIONS = """
You are a Staff Inventory Assistant for retail store operations in Cambodia.

You help store staff and managers with:
1. Inventory Analysis: Checking stock levels, identifying available, low stock, or out-of-stock items across branches.
2. Reorder Monitoring: Checking products reaching or falling below reorder level and alerting staff that restock is needed.
3. Controlled Stock Adjustments: Proposing stock increases or decreases. Always call propose_stock_adjustment to create a proposal preview card for staff confirmation before updating the database.
4. Stock Transfers: Proposing inter-branch stock movements (e.g. transfer 10 items from PP-BKK1 to PP-TTP). Always call propose_stock_transfer to generate a proposal preview for confirmation.
5. Confirming Actions: Confirming pending proposals when staff asks to execute or confirm (using confirm_inventory_action).
6. Audit & Reporting: Generating inventory audit logs and comprehensive stock reports.

Rules:
1. ALWAYS use propose_stock_adjustment or propose_stock_transfer when staff asks to change inventory. Never attempt direct updates without generating a proposal card first.
2. State store codes clearly (e.g. PP-BKK1, PP-TTP, SR-CENTRAL).
3. Be precise, professional, and efficient.
5. CRITICAL REPORTING RULE: When calling generate_inventory_report, NEVER output "Key Metrics", "Total Products Tracked", "Total Stock Quantity", "Total Available Quantity", "Reserved Quantity", "Low Stock Items", or "Out-of-Stock Items" in text bullets or lists. All of these metrics are already rendered visually in the report table card. Your text response must ONLY contain a short 1-line intro, followed directly by actionable recommendations for store staff.
6. STOCK MOVEMENT RULE: When staff asks to move or transfer stock using a category name (e.g. "Dairy", "Beverages"), product name (e.g. "Milk"), or partial term, ALWAYS invoke propose_stock_transfer passing the category or product name string to the "sku" parameter. If the source store branch is omitted, pass from_store_code as null or current store code. Never refuse a transfer request before trying propose_stock_transfer.
""".strip()


CUSTOMER_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "search_products",
        "description": "Search active products by product name, Khmer name, SKU, brand or category.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": ["string", "null"], "description": "Product name, SKU, Khmer name or brand."},
                "category": {"type": ["string", "null"], "description": "Optional exact product category."},
                "limit": {"type": "integer", "description": "Maximum results from 1 to 20.", "minimum": 1, "maximum": 20, "default": 10},
            },
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_product_details",
        "description": "Get complete product information and availability across stores using an exact SKU.",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {"type": "string", "description": "The exact product SKU."},
            },
            "required": ["sku"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "check_inventory",
        "description": "Check available inventory for an exact product SKU, optionally at one store.",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {"type": "string", "description": "The exact product SKU."},
                "store_code": {"type": ["string", "null"], "description": "Optional store code such as PP-BKK1, PP-TTP or SR-CENTRAL."},
            },
            "required": ["sku"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_active_promotions",
        "description": "Get currently active promotions, optionally filtered by an exact product SKU.",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {"type": ["string", "null"], "description": "Optional exact product SKU."},
            },
            "additionalProperties": False,
        },
    },
]


STAFF_TOOLS: list[dict[str, Any]] = CUSTOMER_TOOLS + [
    {
        "type": "function",
        "name": "check_reorder_alerts",
        "description": "Check products that have reached or fallen below the reorder level across store branches.",
        "parameters": {
            "type": "object",
            "properties": {
                "store_code": {"type": ["string", "null"], "description": "Optional store code to filter alerts."},
            },
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "propose_stock_adjustment",
        "description": "Create a pending proposal to increase or decrease stock quantity for a product at a store. Requires staff confirmation before DB update.",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {"type": "string", "description": "Product SKU or product name (e.g. MILK-UHT-1L or UHT Fresh Milk 1L)."},
                "store_code": {"type": "string", "description": "Store branch code or store name e.g. PP-BKK1, BKK1, Toul Tom Poung."},
                "quantity_change": {"type": "integer", "description": "Positive number to add stock, negative number to reduce stock."},
                "reason": {"type": ["string", "null"], "description": "Reason for stock adjustment."},
            },
            "required": ["sku", "store_code", "quantity_change"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "propose_stock_transfer",
        "description": "Create a pending proposal to transfer stock from a source store branch to a target store branch. Requires staff confirmation before DB update.",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {"type": "string", "description": "Product SKU or product name (e.g. MILK-UHT-1L or UHT Fresh Milk 1L)."},
                "from_store_code": {"type": "string", "description": "Source store branch code or store name e.g. PP-BKK1, BKK1, Toul Tom Poung."},
                "to_store_code": {"type": "string", "description": "Target store branch code or store name e.g. PP-TTP, Toul Tom Poung."},
                "quantity": {"type": "integer", "description": "Quantity to transfer (must be > 0)."},
                "reason": {"type": ["string", "null"], "description": "Reason for transfer."},
            },
            "required": ["sku", "from_store_code", "to_store_code", "quantity"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "confirm_inventory_action",
        "description": "Confirm and execute a pending stock proposal by its proposal_id ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "proposal_id": {"type": "string", "description": "UUID string of the pending proposal to confirm."},
            },
            "required": ["proposal_id"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_inventory_audit_logs",
        "description": "Retrieve audit log records of all inventory changes including product, quantity delta, staff, timestamp, and reason.",
        "parameters": {
            "type": "object",
            "properties": {
                "store_code": {"type": ["string", "null"], "description": "Optional store code filter."},
                "sku": {"type": ["string", "null"], "description": "Optional product SKU filter."},
                "limit": {"type": "integer", "description": "Max logs to retrieve (1-50).", "default": 20},
            },
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "generate_inventory_report",
        "description": "Generate an inventory report. Do NOT repeat raw summary metrics or Key Metrics in text response, as they are already rendered in the UI card.",
        "parameters": {
            "type": "object",
            "properties": {
                "store_code": {"type": ["string", "null"], "description": "Optional store code filter."},
            },
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "predictive_demand_forecast",
        "description": "Predict product sales velocity, days until stockout, and AI restocking/transfer recommendations based on sales demand.",
        "parameters": {
            "type": "object",
            "properties": {
                "store_code": {"type": ["string", "null"], "description": "Optional store code filter."},
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
    "check_reorder_alerts": check_reorder_alerts,
    "propose_stock_adjustment": propose_stock_adjustment,
    "propose_stock_transfer": propose_stock_transfer,
    "confirm_inventory_action": confirm_inventory_action,
    "get_inventory_audit_logs": get_inventory_audit_logs,
    "generate_inventory_report": generate_inventory_report,
    "predictive_demand_forecast": predictive_demand_forecast,
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
    tool_executions: list[ToolExecution] = field(default_factory=list)


class RetailAgent:
    def __init__(
        self,
        provider: MicrosoftFoundryProvider | None = None,
    ) -> None:
        self.provider = provider or MicrosoftFoundryProvider()

    async def run(
        self,
        message: str,
        *,
        previous_response_id: str | None = None,
        store_code: str | None = None,
        role: str = "customer",
        staff_user_id: str | None = None,
        staff_name: str | None = None,
        max_steps: int = 6,
    ) -> RetailAgentResult:
        if not message.strip():
            raise ValueError("Message cannot be empty.")

        input_data: str | list[dict[str, Any]] = message
        tool_executions: list[ToolExecution] = []

        is_staff = role == "staff"
        instructions = STAFF_AGENT_INSTRUCTIONS if is_staff else CUSTOMER_AGENT_INSTRUCTIONS
        tools = STAFF_TOOLS if is_staff else CUSTOMER_TOOLS

        if store_code:
            instructions += f"\nCurrently focusing on store branch code '{store_code}'."

        for _ in range(max_steps):
            response = await self.provider.create_response(
                instructions=instructions,
                input_data=input_data,
                tools=tools,
                previous_response_id=previous_response_id,
            )

            function_calls = [
                item for item in response.output if item.type == "function_call"
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
                    staff_user_id=staff_user_id,
                    staff_name=staff_name,
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

        raise RuntimeError("The retail agent exceeded its maximum tool steps.")

    async def _execute_tool(
        self,
        *,
        name: str,
        arguments_json: str,
        staff_user_id: str | None = None,
        staff_name: str | None = None,
    ) -> tuple[Any, dict[str, Any]]:
        handler = TOOL_HANDLERS.get(name)

        if handler is None:
            return ({"error": f"Unknown tool: {name}"}, {})

        try:
            arguments = json.loads(arguments_json)
        except json.JSONDecodeError:
            return ({"error": f"Invalid arguments for tool: {name}"}, {})

        try:
            # Inject staff identity if supported
            if name in ["propose_stock_adjustment", "propose_stock_transfer", "confirm_inventory_action"]:
                if staff_user_id:
                    arguments["staff_user_id"] = staff_user_id
                if staff_name:
                    arguments["staff_name"] = staff_name

            result = await handler(**arguments)
            return result, arguments
        except (TypeError, ValueError) as exc:
            return (
                {"error": str(exc), "tool": name},
                arguments,
            )