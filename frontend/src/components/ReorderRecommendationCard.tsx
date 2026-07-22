import { useState } from "react"
import type { ReorderRecommendationItem } from "../types/inventory"

interface ReorderRecommendationCardProps {
  items: ReorderRecommendationItem[]
  onProposeRestock: (sku: string, storeCode: string, quantity: number, reason: string) => void
  onProposeTransfer: (sku: string, fromStoreCode: string, toStoreCode: string, quantity: number, reason: string) => void
}

export function ReorderRecommendationCard({
  items,
  onProposeRestock,
  onProposeTransfer,
}: ReorderRecommendationCardProps) {
  const [filter, setFilter] = useState<"all" | "urgent" | "overstock">("all")

  const filteredItems = items.filter((item) => {
    if (filter === "urgent") return item.status.startsWith("restock_urgent") || item.status === "restock_warning"
    if (filter === "overstock") return item.status === "overstock"
    return true
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "restock_urgent":
      case "restock_urgent_transfer":
        return <span className="reorder-badge reorder-badge--critical">🚨 Urgent</span>
      case "restock_warning":
        return <span className="reorder-badge reorder-badge--warning">⚠️ Warning</span>
      case "overstock":
        return <span className="reorder-badge reorder-badge--overstock">📦 Overstock</span>
      default:
        return <span className="reorder-badge reorder-badge--stable">✓ Stable</span>
    }
  }

  return (
    <div className="reorder-recommendation-card">
      <div className="reorder-card-header">
        <div>
          <h3>AI Reorder & Restock Recommendations</h3>
          <p className="reorder-subtitle">Based on lead times, 30-day velocity, safety stock, and promotions</p>
        </div>
        <div className="reorder-filters">
          <button
            type="button"
            className={`filter-btn ${filter === "all" ? "active all" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Items
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "urgent" ? "active urgent" : ""}`}
            onClick={() => setFilter("urgent")}
          >
            Urgent Restock
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "overstock" ? "active overstock" : ""}`}
            onClick={() => setFilter("overstock")}
          >
            Overstock
          </button>
        </div>
      </div>

      <div className="reorder-table-container">
        <table className="reorder-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Branch</th>
              <th>Avail / Rsvd</th>
              <th>Daily Sales</th>
              <th>Lead Time</th>
              <th>Reorder Point</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => {
              const rowKey = `${item.sku}-${item.store_code}-${idx}`
              return (
                <tr key={rowKey}>
                  <td>
                    <div className="product-cell">
                      <span className="p-name">{item.product_name}</span>
                      <span className="p-sku">{item.sku}</span>
                    </div>
                  </td>
                  <td><span className="store-badge-cell">{item.store_name}</span></td>
                  <td>
                    <div className="stock-info-cell">
                      <strong>{item.available_quantity}</strong>
                      <span>/ {item.reserved_quantity} rsvd</span>
                    </div>
                  </td>
                  <td>
                    <div className="sales-rate-cell">
                      <span>Avg: {item.daily_sales_rate}/d</span>
                      {item.has_active_promotion && (
                        <span className="promo-badge-inline" title="Active Promotion (1.5x Demand Boost)">
                          🔥 Promo: {item.predicted_daily_sales}/d
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{item.lead_time_days} days</td>
                  <td>
                    <div className="rop-cell">
                      <strong>{item.reorder_point}</strong>
                      <span>(safety: {item.safety_stock})</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td>
                    <div className="forecast-actions-cell">
                      {(item.status === "restock_urgent" || item.status === "restock_warning") && item.suggested_quantity > 0 && (
                        <button
                          type="button"
                          className="action-link-btn restock"
                          onClick={() =>
                            onProposeRestock(
                              item.sku,
                              item.store_code,
                              item.suggested_quantity,
                              `AI Reorder Recommendation: Lead-time demand understock risk.`,
                            )
                          }
                        >
                          Restock {item.suggested_quantity}
                        </button>
                      )}
                      {(item.status === "restock_urgent_transfer" || item.status === "overstock") &&
                        item.suggested_transfer_store_code &&
                        item.suggested_quantity > 0 && (
                          <button
                            type="button"
                            className="action-link-btn transfer"
                            onClick={() =>
                              onProposeTransfer(
                                item.sku,
                                item.status === "overstock" ? item.store_code : (item.suggested_transfer_store_code ?? ""),
                                item.status === "overstock" ? (item.suggested_transfer_store_code ?? "") : item.store_code,
                                item.suggested_quantity,
                                `AI Reorder Recommendation: Inter-branch transfer to balance stockout.`,
                              )
                            }
                          >
                            Transfer {item.suggested_quantity}
                          </button>
                        )}
                      {item.status === "healthy" && <span className="no-action-lbl">None</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-forecast-row">
                  No recommendations found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="reorder-summary-footer">
        {filteredItems.map((item, idx) => {
          if (item.status === "healthy") return null
          const itemKey = `rec-row-${item.sku}-${item.store_code}-${idx}`
          return (
            <div key={itemKey} className="recommendation-row">
              <span className="rec-prefix">Recomment:</span>
              <span className="rec-text">{item.recommendation}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
