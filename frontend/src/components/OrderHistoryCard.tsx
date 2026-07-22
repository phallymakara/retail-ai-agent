import { Calendar, MapPin, Store } from "lucide-react"

export interface OrderItem {
  sku: string
  name: string
  quantity: number
  line_total: number
}

export interface OrderHistoryData {
  order_number: string
  store_name: string
  status: string
  fulfillment_type: string
  total_amount: number
  created_at: string
  items: OrderItem[]
}

interface OrderHistoryCardProps {
  orders: OrderHistoryData[]
}

export function OrderHistoryCard({ orders }: OrderHistoryCardProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="order-history-card-empty" style={{
        padding: "16px",
        background: "rgba(241, 245, 249, 0.5)",
        borderRadius: "12px",
        textAlign: "center",
        color: "#64748b",
        fontSize: "13px"
      }}>
        No past orders found matching this period.
      </div>
    )
  }

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return isoString
    }
  }

  return (
    <div className="order-history-container">
      {orders.map((order) => {
        const parts = order.order_number.split("-")
        const shortNum = parts.length > 2 ? parts[parts.length - 1] : order.order_number

        return (
          <div key={order.order_number} className="order-history-card">
            {/* Header section - static */}
            <div className="order-card-header">
              <div className="order-meta-info">
                <div className="order-num-status">
                  <strong>ORD #{shortNum}</strong>
                  <span className={`order-status-badge status--${order.status}`}>
                    {order.status}
                  </span>
                </div>
                <div className="order-details-summary">
                  <span>
                    <Calendar size={12} />
                    {formatDate(order.created_at)}
                  </span>
                  <span>
                    {order.fulfillment_type === "delivery" ? <MapPin size={12} /> : <Store size={12} />}
                    {order.store_name}
                  </span>
                </div>
              </div>
              
              <div className="order-total">
                <span className="order-total-amount">
                  ${order.total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Static invoice details section */}
            <div className="order-card-details">
              <div className="order-items-table">
                <div className="table-header">
                  <span>PRODUCT</span>
                  <span style={{ textAlign: "center", width: "40px" }}>QTY</span>
                  <span style={{ textAlign: "right" }}>PRICE</span>
                </div>
                {order.items.map((item) => (
                  <div key={item.sku} className="table-row">
                    <span className="item-name">
                      {item.name}
                      <span className="item-sku">{item.sku}</span>
                    </span>
                    <span style={{ textAlign: "center", color: "#64748b", width: "40px" }}>× {item.quantity}</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>${item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="order-invoice-footer">
                <div className="footer-row">
                  <span>Subtotal</span>
                  <span>${order.total_amount.toFixed(2)}</span>
                </div>
                <div className="footer-row grand-total">
                  <span>Grand Total</span>
                  <span>${order.total_amount.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
