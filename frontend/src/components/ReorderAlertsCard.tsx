import { AlertOctagon, AlertTriangle } from "lucide-react"
import type { ReorderAlertItem } from "../types/inventory"

interface ReorderAlertsCardProps {
    alerts: ReorderAlertItem[]
}

export function ReorderAlertsCard({ alerts }: ReorderAlertsCardProps) {
    if (!alerts || alerts.length === 0) {
        return (
            <div className="reorder-alerts-card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857", fontSize: "13px", fontWeight: "600" }}>
                ✨ All inventory items across store branches are healthy and above reorder levels.
            </div>
        )
    }

    return (
        <div className="reorder-alerts-card">
            <div className="proposal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "#b45309" }}>
                        Low Stock & Reorder Alerts ({alerts.length})
                    </h4>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
                {alerts.map((item, idx) => (
                    <div
                        key={`${item.sku}-${item.store_code}-${idx}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 0",
                            borderBottom: "1px solid #f1f5f9"
                        }}
                    >
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{item.product_name}</span>
                                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748b" }}>({item.sku})</span>
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                Store: <strong style={{ color: "#334155" }}>{item.store_name} ({item.store_code})</strong>
                            </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                            <div>
                                {item.status === "out_of_stock" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                        <AlertOctagon size={12} /> Out of Stock
                                    </span>
                                ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                        <AlertTriangle size={12} /> Low Stock
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                                Available: <strong style={{ color: "#b45309" }}>{item.available_quantity}</strong> / Threshold: {item.reorder_level}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
