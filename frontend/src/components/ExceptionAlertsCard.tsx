import { useState } from "react"
import type { InventoryExceptionItem } from "../types/inventory"

interface ExceptionAlertsCardProps {
  exceptions: InventoryExceptionItem[]
  onProposeAction: (promptText: string) => void
}

export function ExceptionAlertsCard({
  exceptions,
  onProposeAction,
}: ExceptionAlertsCardProps) {
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all")

  const filteredItems = exceptions.filter((item) => {
    if (filter === "critical") return item.severity === "critical"
    if (filter === "warning") return item.severity === "warning"
    return true
  })

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <span className="exception-badge exception-badge--critical">🔴 Critical</span>
      case "warning":
        return <span className="exception-badge exception-badge--warning">🟡 Warning</span>
      default:
        return <span className="exception-badge exception-badge--info">🔵 Info</span>
    }
  }

  const handleFixClick = (item: InventoryExceptionItem) => {
    if (item.type === "negative_stock" || item.type === "stock_mismatch") {
      onProposeAction(`propose stock adjustment for product ${item.sku} at store ${item.store_code} with quantity 20 and reason: Reconcile physical inventory mismatch exception alert.`)
    } else if (item.type === "fast_moving_unreplenished") {
      onProposeAction(`propose stock adjustment for product ${item.sku} at store ${item.store_code} with quantity 50 and reason: AI Exception Alert: Urgent restocking for fast-moving items.`)
    } else if (item.type === "dead_stock") {
      onProposeAction(`propose stock transfer for product ${item.sku} from store ${item.store_code} to PP-BKK1 with quantity 25 and reason: AI Exception Alert: Transfer slow-moving stock to active branch.`)
    } else if (item.type === "missing_reason") {
      onProposeAction(`show inventory audit logs for store ${item.store_code} and product ${item.sku}`)
    } else {
      onProposeAction(`show inventory report for store ${item.store_code}`)
    }
  }

  return (
    <div className="demand-forecast-card">
      <div className="forecast-header">
        <div>
          <h3>Inventory Exception Alerts</h3>
          <p className="forecast-subtitle">Critical stock level errors, calculations mismatches, and operational audit gaps</p>
        </div>
        <div className="forecast-filters">
          <button
            type="button"
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Exceptions ({exceptions.length})
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "critical" ? "active" : ""}`}
            onClick={() => setFilter("critical")}
          >
            Critical ({exceptions.filter(e => e.severity === "critical").length})
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "warning" ? "active" : ""}`}
            onClick={() => setFilter("warning")}
          >
            Warnings
          </button>
        </div>
      </div>

      <div className="forecast-table-container">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Product / SKU</th>
              <th>Branch</th>
              <th>Severity</th>
              <th>Exception Details</th>
              <th>Suggested Recovery</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => {
              const rowKey = `${item.sku}-${item.store_code}-${item.type}-${idx}`
              return (
                <tr key={rowKey}>
                  <td>
                    <div className="product-cell">
                      <span className="p-name">{item.product_name}</span>
                      <span className="p-sku">{item.sku}</span>
                    </div>
                  </td>
                  <td><span className="store-badge-cell">{item.store_name}</span></td>
                  <td>{getSeverityBadge(item.severity)}</td>
                  <td>
                    <div className="exception-details-cell">
                      <p className="details-text">{item.details}</p>
                    </div>
                  </td>
                  <td>
                    <span className="suggested-action-lbl">{item.suggested_action}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`action-link-btn ${
                        item.severity === "critical"
                          ? "restock"
                          : item.type === "dead_stock"
                          ? "transfer"
                          : ""
                      }`}
                      onClick={() => handleFixClick(item)}
                    >
                      Resolve Exception
                    </button>
                  </td>
                </tr>
              )
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-forecast-row">
                  No inventory exception alerts found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
