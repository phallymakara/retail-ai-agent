from app.agents.tools.inventory_tools import (
    check_inventory_exceptions,
    check_reorder_alerts,
    confirm_inventory_action,
    generate_inventory_report,
    get_inventory_audit_logs,
    predictive_demand_forecast,
    predictive_reorder_recommendation,
    propose_stock_adjustment,
    propose_stock_transfer,
)
from app.agents.tools.retail import (
    check_inventory,
    get_active_promotions,
    get_product_details,
    search_products,
)

__all__ = [
    "check_inventory",
    "check_inventory_exceptions",
    "check_reorder_alerts",
    "confirm_inventory_action",
    "generate_inventory_report",
    "get_active_promotions",
    "get_inventory_audit_logs",
    "get_product_details",
    "predictive_demand_forecast",
    "predictive_reorder_recommendation",
    "propose_stock_adjustment",
    "propose_stock_transfer",
    "search_products",
]