import { useEffect, useMemo, useState } from "react"
import { fetchInventoryReportApi } from "../services/inventoryApi"
import type { InventoryReportData, CategoryProductItem } from "../types/inventory"
import { storeBranches } from "../App"

interface StockInspectorProps {
  onProposeRestock: (sku: string, storeCode: string, quantity: number, reason: string) => void
  onProposeTransfer: (sku: string, fromStoreCode: string, toStoreCode: string, quantity: number, reason: string) => void
  onSwitchToChat: () => void
  initialStoreCode?: string
}

export function StockInspector({
  onProposeRestock,
  onProposeTransfer,
  initialStoreCode,
}: StockInspectorProps) {
  const [selectedBranch, setSelectedBranch] = useState(initialStoreCode || storeBranches[0].code)
  const [report, setReport] = useState<InventoryReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all")

  // Popover & Modal States
  const [activeMenuSku, setActiveMenuSku] = useState<string | null>(null)
  const [modalAction, setModalAction] = useState<{ type: "add" | "deduct" | "transfer"; product: CategoryProductItem & { category: string } } | null>(null)
  const [qty, setQty] = useState("10")
  const [reason, setReason] = useState("")
  const [destBranch, setDestBranch] = useState("")

  // Pre-fill destination branch for transfers
  useEffect(() => {
    if (modalAction?.type === "transfer") {
      const remaining = storeBranches.filter((b) => b.code !== selectedBranch)
      if (remaining.length > 0) {
        setDestBranch(remaining[0].code)
      }
    } else {
      setDestBranch("")
    }
  }, [modalAction, selectedBranch])

  useEffect(() => {
    void loadBranchReport(selectedBranch)
  }, [selectedBranch])

  const loadBranchReport = async (storeCode: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchInventoryReportApi(storeCode)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branch stock report.")
    } finally {
      setIsLoading(false)
    }
  }

  // Construct flat list of products with category references
  const allProducts = useMemo(() => {
    if (!report?.category_breakdown) return []
    const list: (CategoryProductItem & { category: string })[] = []
    report.category_breakdown.forEach((catSummary) => {
      if (catSummary.products) {
        catSummary.products.forEach((p) => {
          list.push({
            ...p,
            category: catSummary.category,
          })
        })
      }
    })
    return list
  }, [report])

  // Extract unique category names
  const categories = useMemo(() => {
    if (!report?.category_breakdown) return ["All"]
    return ["All", ...report.category_breakdown.map((c) => c.category)]
  }, [report])

  // Filter products by search query, category chips, and stock status
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesCategory =
        selectedCategory === "All" || p.category.toLowerCase() === selectedCategory.toLowerCase()

      const query = searchQuery.trim().toLowerCase()
      const matchesQuery =
        !query ||
        p.product_name.toLowerCase().includes(query) ||
        (p.product_name_km && p.product_name_km.toLowerCase().includes(query)) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        p.sku.toLowerCase().includes(query)

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && p.available_quantity > 0 && p.available_quantity <= 5) ||
        (stockFilter === "out" && p.available_quantity <= 0)

      return matchesCategory && matchesQuery && matchesStock
    })
  }, [allProducts, searchQuery, selectedCategory, stockFilter])

  const getAPIImageUrl = (url: string | null | undefined) => {
    if (!url) return "https://img.icons8.com/color/96/box.png"
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
    return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`
  }

  return (
    <div className="stock-inspector-container">
      {/* Branch selector row */}
      <div className="inspector-toolbar" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "16px" }}>
        <div className="discover-sort-box" style={{ gap: "10px", display: "flex", alignItems: "center" }}>
          <label htmlFor="inspector-branch-select" style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
            Select Branch:
          </label>
          <select
            id="inspector-branch-select"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              fontWeight: 700,
              color: "#334155",
              background: "white",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {storeBranches.map((branch) => (
              <option key={branch.code} value={branch.code}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="inspector-loading">
          <div className="spinner" />
          <span>Loading branch inventory catalog...</span>
        </div>
      ) : error ? (
        <div className="inspector-error-box">{error}</div>
      ) : report ? (
        <div className="inspector-content">
          {/* Summary Cards */}
          <div className="inspector-summary-row" style={{ marginBottom: "16px" }}>
            <div className="summary-stat-card">
              <span className="stat-lbl">Tracked SKUs</span>
              <strong className="stat-val">{report.total_products_tracked}</strong>
            </div>
            <div className="summary-stat-card">
              <span className="stat-lbl">Total Stock Count</span>
              <strong className="stat-val">{report.total_stock_quantity} units</strong>
            </div>
            <div className="summary-stat-card">
              <span className="stat-lbl">Available Stock</span>
              <strong className="stat-val stat-val--emerald">{report.total_available_quantity}</strong>
            </div>
            <div className="summary-stat-card">
              <span className="stat-lbl">Low Stock Alerts</span>
              <strong className={`stat-val ${report.low_stock_count > 0 ? "stat-val--rose" : ""}`}>
                {report.low_stock_count}
              </strong>
            </div>
          </div>

          {/* Category Chips, Availability, and Search Filter Panel */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
            {/* Category Filter Chips */}
            <div className="discover-category-chips" style={{ paddingLeft: 0, paddingRight: 0, borderBottom: "none", margin: 0, maxWidth: "600px", overflowX: "auto", display: "flex", gap: "8px", flexWrap: "nowrap", scrollbarWidth: "none" }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-chip ${selectedCategory === cat ? "category-chip--active" : ""}`}
                  style={{ flexShrink: 0 }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Availability Filter Selector */}
            <div className="discover-sort-box" style={{ gap: "10px", display: "flex", alignItems: "center", margin: 0 }}>
              <label htmlFor="inspector-stock-filter" style={{ fontWeight: 700, fontSize: "13px", color: "#475569" }}>
                Availability:
              </label>
              <select
                id="inspector-stock-filter"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#334155",
                  background: "white",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="all">All Stocks</option>
                <option value="low">Low Stock (≤ 5 units)</option>
                <option value="out">Out of Stock (0 units)</option>
              </select>
            </div>

            {/* Search Field Box */}
            <div className="discover-search-box" style={{ width: "380px", background: "white", margin: 0 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Filter by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Products Cards Grid */}
          <div className="discover-grid">
            {filteredProducts.map((prod) => {
              const isLow = prod.available_quantity <= 5
              return (
                <div key={prod.sku} className="discover-card" style={{ padding: "0 0 12px 0", position: "relative" }}>
                  {/* Three dots button */}
                  <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 10 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuSku(activeMenuSku === prod.sku ? null : prod.sku)
                      }}
                      style={{
                        background: "rgba(255, 255, 255, 0.9)",
                        border: "1px solid #cbd5e1",
                        borderRadius: "50%",
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: "#475569",
                      }}
                    >
                      ⋮
                    </button>

                    {/* Popover Menu container */}
                    {activeMenuSku === prod.sku && (
                      <div
                        style={{
                          position: "absolute",
                          top: "32px",
                          right: "0",
                          background: "white",
                          border: "1px solid #cbd5e1",
                          borderRadius: "10px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                          padding: "4px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          minWidth: "130px",
                          zIndex: 100,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuSku(null)
                            setModalAction({ type: "add", product: prod })
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "transparent",
                            border: "none",
                            borderRadius: "6px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#1e293b",
                            cursor: "pointer",
                          }}
                        >
                          ➕ Add Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuSku(null)
                            setModalAction({ type: "deduct", product: prod })
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "transparent",
                            border: "none",
                            borderRadius: "6px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                        >
                          ➖ Deduct Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuSku(null)
                            setModalAction({ type: "transfer", product: prod })
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "transparent",
                            border: "none",
                            borderRadius: "6px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#2563eb",
                            cursor: "pointer",
                          }}
                        >
                          🔄 Transfer
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="discover-card-img-wrapper" style={{ height: "120px" }}>
                    <img src={getAPIImageUrl(prod.image_url)} alt={prod.product_name} />
                    <span className="discover-card-cat">{prod.category}</span>
                  </div>

                  <div className="discover-card-info" style={{ flex: 1, padding: "12px 14px" }}>
                    <h4 className="discover-card-title" style={{ fontSize: "14px", margin: "0 0 2px 0" }}>
                      {prod.product_name}
                    </h4>
                    {prod.product_name_km && (
                      <p className="discover-card-km" style={{ margin: "0 0 4px 0" }}>{prod.product_name_km}</p>
                    )}
                    <span className="sku-badge" style={{ alignSelf: "flex-start", marginBottom: "8px" }}>
                      {prod.sku}
                    </span>

                    {/* Stock level indicators */}
                    <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", marginTop: "6px", alignItems: "center" }}>
                      <span style={{ color: "#64748b", fontWeight: 600 }}>Stock:</span>
                      <strong className={isLow ? "text-rose" : "text-emerald"} style={{ fontWeight: 800 }}>
                        {prod.available_quantity} {prod.available_quantity === 1 ? "unit" : "units"}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "#64748b" }}>
                No stock items matching filter parameters.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="inspector-empty">No report details available.</div>
      )}

      {/* Action Proposal Modal */}
      {modalAction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setModalAction(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid #cbd5e1",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              {modalAction.type === "add" && "➕ Add Stock Proposal"}
              {modalAction.type === "deduct" && "➖ Deduct Stock Proposal"}
              {modalAction.type === "transfer" && "🔄 Stock Transfer Proposal"}
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
              Product: <strong>{modalAction.product.product_name}</strong> ({modalAction.product.sku})
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const qtyVal = parseInt(qty)
                if (isNaN(qtyVal) || qtyVal <= 0) return alert("Please enter a valid quantity.")
                if (modalAction.type === "add") {
                  onProposeRestock(modalAction.product.sku, selectedBranch, qtyVal, reason || "Manual stock increase adjustment.")
                } else if (modalAction.type === "deduct") {
                  onProposeRestock(modalAction.product.sku, selectedBranch, -qtyVal, reason || "Manual stock deduction adjustment.")
                } else if (modalAction.type === "transfer") {
                  if (!destBranch) return alert("Please select a destination branch.")
                  onProposeTransfer(modalAction.product.sku, selectedBranch, destBranch, qtyVal, reason || "Inter-branch stock transfer.")
                }
                setModalAction(null)
                setQty("10")
                setReason("")
              }}
            >
              {/* Transfer Destination Branch selector */}
              {modalAction.type === "transfer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                  <label htmlFor="modal-dest-branch" style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    To Store Branch:
                  </label>
                  <select
                    id="modal-dest-branch"
                    value={destBranch}
                    onChange={(e) => setDestBranch(e.target.value)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontWeight: 650,
                      color: "#334155",
                      outline: "none",
                      background: "white",
                    }}
                  >
                    {storeBranches.filter(b => b.code !== selectedBranch).map(branch => (
                      <option key={branch.code} value={branch.code}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                <label htmlFor="modal-qty" style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Quantity:
                </label>
                <input
                  id="modal-qty"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                  }}
                  required
                />
              </div>

              {/* Reason */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                <label htmlFor="modal-reason" style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Reason / Remarks:
                </label>
                <textarea
                  id="modal-reason"
                  placeholder="Enter explanation for adjustment proposal..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    minHeight: "70px",
                    resize: "none",
                    outline: "none",
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  style={{
                    padding: "10px 16px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    background: modalAction.type === "deduct" ? "#dc2626" : modalAction.type === "transfer" ? "#2563eb" : "#047857",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
