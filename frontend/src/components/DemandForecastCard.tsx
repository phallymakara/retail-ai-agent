import { TrendingUp, AlertTriangle, AlertOctagon, CheckCircle2, ArrowRight } from "lucide-react"
import type { DemandForecastItem } from "../types/inventory"

interface DemandForecastCardProps {
    forecasts: DemandForecastItem[]
    onProposeAction?: (promptText: string) => void
}

export function DemandForecastCard({ forecasts, onProposeAction }: DemandForecastCardProps) {
    if (!forecasts || forecasts.length === 0) {
        return null
    }

    return (
        <div className="demand-forecast-card">
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TrendingUp size={18} color="#2563eb" />
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1e40af" }}>
                        AI Sales & Demand Forecast ({forecasts.length})
                    </h4>
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>30-Day Sales Velocity Analysis</span>
            </div>

            {/* Forecast Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                {forecasts.map((item, idx) => {
                    const isCritical = item.urgency === "critical"
                    const isWarning = item.urgency === "warning"

                    return (
                        <div
                            key={`${item.sku}-${item.store_code}-${idx}`}
                            style={{
                                borderBottom: "1px solid #f1f5f9",
                                paddingBottom: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px"
                            }}
                        >
                            {/* Row Top: Product & Urgency Tag */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{item.product_name}</span>
                                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748b" }}>({item.sku})</span>
                                </div>

                                <div>
                                    {isCritical ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                            <AlertOctagon size={12} /> Stockout in {item.days_until_stockout} {item.days_until_stockout === 1 ? "day" : "days"}
                                        </span>
                                    ) : isWarning ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                            <AlertTriangle size={12} /> Stockout in {item.days_until_stockout} days
                                        </span>
                                    ) : (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                            <CheckCircle2 size={12} /> Stable ({item.days_until_stockout}+ days)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Row Middle: Metrics */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                                <div>
                                    Branch: <strong style={{ color: "#334155" }}>{item.store_name} ({item.store_code})</strong>
                                </div>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <span>Sales Velocity: <strong style={{ color: "#2563eb" }}>~{item.daily_sales_rate}/day</strong></span>
                                    <span>Available: <strong style={{ color: isCritical ? "#dc2626" : isWarning ? "#d97706" : "#059669" }}>{item.available_quantity} units</strong></span>
                                </div>
                            </div>

                            {/* Row Bottom: Recommendation & Quick Action Button */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                                <div style={{ fontSize: "11px", color: "#334155", lineHeight: "1.4", flex: 1, paddingRight: "8px" }}>
                                    <strong>Recomment:</strong> {item.recommendation}
                                </div>

                                {item.suggested_donor_store_code && item.suggested_transfer_qty && onProposeAction && (
                                    <button
                                        type="button"
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            background: "#2563eb",
                                            color: "#ffffff",
                                            border: "none",
                                            padding: "4px 10px",
                                            borderRadius: "6px",
                                            fontSize: "11px",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                            whiteSpace: "nowrap"
                                        }}
                                        onClick={() => {
                                            const prompt = `transfer ${item.product_name} ${item.suggested_transfer_qty} qty from ${item.suggested_donor_store_code} to ${item.store_code}`
                                            onProposeAction(prompt)
                                        }}
                                    >
                                        Propose Action <ArrowRight size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
