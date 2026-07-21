export interface InventoryProposalData {
    id: string
    proposal_type: "adjustment" | "transfer" | string
    product_id: string
    sku?: string | null
    product_name?: string | null
    store_id: string
    store_code?: string | null
    store_name?: string | null
    target_store_id?: string | null
    target_store_code?: string | null
    target_store_name?: string | null
    quantity_change: number
    previous_quantity: number
    new_quantity: number
    target_previous_quantity?: number | null
    target_new_quantity?: number | null
    reason?: string | null
    status: "pending" | "confirmed" | "cancelled" | string
    staff_user_id?: string | null
    staff_name?: string | null
    created_at?: string | null
    executed_at?: string | null
}

export interface ReorderAlertItem {
    sku: string
    product_name: string
    product_name_km?: string | null
    category: string
    store_code: string
    store_name: string
    total_quantity: number
    reserved_quantity: number
    available_quantity: number
    reorder_level: number
    status: "low_stock" | "out_of_stock"
}

export interface InventoryAuditLogItem {
    id: string
    sku?: string | null
    product_name?: string | null
    store_code?: string | null
    store_name?: string | null
    target_store_code?: string | null
    target_store_name?: string | null
    change_type: string
    quantity_delta: number
    previous_quantity: number
    new_quantity: number
    reason?: string | null
    staff_user_id?: string | null
    staff_name?: string | null
    created_at?: string | null
}

export interface BranchSummary {
    store_code: string
    store_name: string
    total_items: number
    total_quantity: number
    available_quantity: number
    low_stock_count: number
    out_of_stock_count: number
}

export interface CategoryProductItem {
    sku: string
    product_name: string
    total_quantity: number
    available_quantity: number
    store_code?: string
}

export interface CategorySummary {
    category: string
    total_items: number
    total_quantity: number
    available_quantity: number
    products?: CategoryProductItem[]
}

export interface InventoryReportItem {
    sku: string
    product_name: string
    category?: string
    store_code: string
    store_name: string
    available_quantity: number
    reorder_level: number
}

export interface InventoryReportData {
    generated_at: string
    store_code_filter?: string | null
    store_name?: string | null
    total_products_tracked: number
    total_stock_quantity: number
    total_available_quantity: number
    total_reserved_quantity: number
    low_stock_count: number
    out_of_stock_count: number
    branch_breakdown?: BranchSummary[]
    category_breakdown?: CategorySummary[]
    low_stock_items?: InventoryReportItem[]
    out_of_stock_items?: InventoryReportItem[]
}

export interface DemandForecastItem {
    sku: string
    product_name: string
    category: string
    store_code: string
    store_name: string
    available_quantity: number
    reorder_level: number
    daily_sales_rate: number
    days_until_stockout: number
    urgency: "critical" | "warning" | "stable" | string
    recommendation: string
    suggested_donor_store_code?: string | null
    suggested_transfer_qty?: number | null
}
