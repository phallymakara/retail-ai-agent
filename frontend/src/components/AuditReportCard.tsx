import { FileText, History, ArrowRightLeft, ArrowUp, ArrowDown, AlertTriangle, AlertOctagon } from "lucide-react"
import type { InventoryAuditLogItem, InventoryReportData } from "../types/inventory"

interface AuditReportCardProps {
    auditLogs?: InventoryAuditLogItem[]
    report?: InventoryReportData
}

export function AuditReportCard({ auditLogs, report }: AuditReportCardProps) {
    if (report) {
        return (
            <div className="audit-report-card">
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #bfdbfe", paddingBottom: "8px", marginBottom: "12px" }}>
                    <FileText size={16} color="#2563eb" />
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1d4ed8" }}>
                        Report: {report.store_name || report.store_code_filter || "All Branches"}
                    </h4>
                </div>

                {/* Summary Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px", marginBottom: "14px" }}>
                    <div style={{ background: "#ffffff", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>Total Tracked</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{report.total_products_tracked}</div>
                    </div>
                    <div style={{ background: "#ffffff", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>Available Stock</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#059669" }}>{report.total_available_quantity}</div>
                    </div>
                    <div style={{ background: "#ffffff", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>Low Stock</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#d97706" }}>{report.low_stock_count}</div>
                    </div>
                    <div style={{ background: "#ffffff", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>Out of Stock</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#dc2626" }}>{report.out_of_stock_count}</div>
                    </div>
                </div>

                {/* Product Breakdown by Category */}
                {((report.category_breakdown && report.category_breakdown.length > 0) || (report.branch_breakdown && report.branch_breakdown.length > 0)) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Product Breakdown:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "4px" }}>
                            {report.category_breakdown && report.category_breakdown.length > 0 ? (
                                report.category_breakdown.map((cat) => (
                                    <div key={cat.category} style={{ display: "flex", flexDirection: "column", gap: "2px", borderBottom: "1px solid #f1f5f9", padding: "6px 0" }}>
                                        {/* Category Header Row */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                                            <span style={{ color: "#2563eb", fontWeight: "bold" }}>•</span>
                                            <span style={{ fontWeight: "700", color: "#0f172a" }}>{cat.category}</span>
                                            <span style={{ fontSize: "11px", color: "#64748b" }}>({cat.total_items} {cat.total_items === 1 ? "product" : "products"})</span>
                                        </div>

                                        {/* Sub-rows for products inside this category */}
                                        {cat.products && cat.products.length > 0 && (
                                            <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                                                {cat.products.map((p, pIdx) => (
                                                    <div key={`${p.sku}-${pIdx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#334155" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                            <span style={{ color: "#94a3b8" }}>└─</span>
                                                            <span style={{ fontWeight: "600", color: "#1e293b" }}>{p.product_name}</span>
                                                            <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: "10px" }}>({p.sku})</span>
                                                        </div>
                                                        <div style={{ color: "#64748b" }}>
                                                            Available: <strong style={{ color: "#059669" }}>{p.available_quantity}</strong>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                report.branch_breakdown?.map((b) => (
                                    <div key={b.store_code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ color: "#2563eb", fontWeight: "bold" }}>•</span>
                                            <span style={{ fontWeight: "700", color: "#0f172a" }}>{b.store_name} ({b.store_code})</span>
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                                            Items: <strong style={{ color: "#0f172a" }}>{b.total_items}</strong> · Available: <strong style={{ color: "#059669" }}>{b.available_quantity}</strong>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Low Stock Items List */}
                {report.low_stock_items && report.low_stock_items.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#b45309", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={12} /> Low Stock Products ({report.low_stock_items.length}):
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {report.low_stock_items.map((item, idx) => (
                                <div key={`low-${item.sku}-${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12px" }}>
                                    <div>
                                        <span style={{ fontWeight: "700", color: "#0f172a" }}>{item.product_name}</span>
                                        <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "6px" }}>({item.sku})</span>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#b45309", fontWeight: "600" }}>
                                        Branch: {item.store_code} · Left: <strong style={{ color: "#d97706" }}>{item.available_quantity}</strong> (Reorder: {item.reorder_level})
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Out of Stock Items List */}
                {report.out_of_stock_items && report.out_of_stock_items.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                            <AlertOctagon size={12} /> Out of Stock Products ({report.out_of_stock_items.length}):
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {report.out_of_stock_items.map((item, idx) => (
                                <div key={`out-${item.sku}-${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12px" }}>
                                    <div>
                                        <span style={{ fontWeight: "700", color: "#0f172a" }}>{item.product_name}</span>
                                        <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "6px" }}>({item.sku})</span>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: "700" }}>
                                        Branch: {item.store_code} · Out of Stock (0)
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (auditLogs && auditLogs.length > 0) {
        return (
            <div className="audit-report-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #cbd5e1", paddingBottom: "8px", marginBottom: "12px" }}>
                    <History size={16} color="#7c3aed" />
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6d28d9" }}>
                        Inventory Audit Trail ({auditLogs.length})
                    </h4>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
                    {auditLogs.map((log) => (
                        <div key={log.id} style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    {log.change_type.includes("add") || log.change_type.includes("in") ? (
                                        <ArrowUp size={14} color="#16a34a" />
                                    ) : log.change_type.includes("transfer") ? (
                                        <ArrowRightLeft size={14} color="#7c3aed" />
                                    ) : (
                                        <ArrowDown size={14} color="#dc2626" />
                                    )}
                                    <span style={{ fontWeight: "700", color: "#0f172a" }}>{log.product_name || log.sku}</span>
                                    <span style={{ color: "#64748b" }}>({log.store_code})</span>
                                </div>
                                <span style={{ fontWeight: "700", color: log.quantity_delta > 0 ? "#16a34a" : "#dc2626" }}>
                                    {log.quantity_delta > 0 ? `+${log.quantity_delta}` : log.quantity_delta}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                                <span>Staff: {log.staff_name || "System"}</span>
                                <span>{log.reason || log.change_type}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return null
}
