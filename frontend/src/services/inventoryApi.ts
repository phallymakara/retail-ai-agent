import type {
    DemandForecastItem,
    InventoryAuditLogItem,
    InventoryProposalData,
    InventoryReportData,
    ReorderAlertItem,
} from "../types/inventory"

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8000"

export async function confirmProposalApi(
    proposalId: string,
    staffUserId?: string,
    staffName?: string,
): Promise<InventoryProposalData> {
    const response = await fetch(
        `${API_BASE_URL}/api/v1/inventory/proposals/confirm`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                proposal_id: proposalId,
                staff_user_id: staffUserId,
                staff_name: staffName,
            }),
        },
    )

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || "Failed to confirm inventory proposal.")
    }

    return response.json()
}

export async function cancelProposalApi(
    proposalId: string,
): Promise<InventoryProposalData> {
    const response = await fetch(
        `${API_BASE_URL}/api/v1/inventory/proposals/cancel`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposal_id: proposalId }),
        },
    )

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || "Failed to cancel inventory proposal.")
    }

    return response.json()
}

export async function fetchReorderAlertsApi(
    storeCode?: string,
): Promise<ReorderAlertItem[]> {
    const url = new URL(`${API_BASE_URL}/api/v1/inventory/reorder-alerts`)
    if (storeCode) url.searchParams.set("store_code", storeCode)

    const response = await fetch(url.toString())
    if (!response.ok) {
        throw new Error("Failed to fetch reorder alerts.")
    }
    return response.json()
}

export async function fetchAuditLogsApi(
    storeCode?: string,
    sku?: string,
    limit = 20,
): Promise<InventoryAuditLogItem[]> {
    const url = new URL(`${API_BASE_URL}/api/v1/inventory/audit-logs`)
    if (storeCode) url.searchParams.set("store_code", storeCode)
    if (sku) url.searchParams.set("sku", sku)
    url.searchParams.set("limit", limit.toString())

    const response = await fetch(url.toString())
    if (!response.ok) {
        throw new Error("Failed to fetch audit logs.")
    }
    return response.json()
}

export async function fetchInventoryReportApi(
    storeCode?: string,
): Promise<InventoryReportData> {
    const url = new URL(`${API_BASE_URL}/api/v1/inventory/reports`)
    if (storeCode) url.searchParams.set("store_code", storeCode)

    const response = await fetch(url.toString())
    if (!response.ok) {
        throw new Error("Failed to fetch inventory report.")
    }
    return response.json()
}

export function getExportReportPdfUrl(storeCode?: string): string {
    const url = new URL(`${API_BASE_URL}/api/v1/inventory/reports/export/pdf`)
    if (storeCode) url.searchParams.set("store_code", storeCode)
    return url.toString()
}

export function getExportReportExcelUrl(storeCode?: string): string {
    const url = new URL(`${API_BASE_URL}/api/v1/inventory/reports/export/excel`)
    if (storeCode) url.searchParams.set("store_code", storeCode)
    return url.toString()
}

export async function fetchDemandForecastApi(
    storeCode?: string,
): Promise<DemandForecastItem[]> {
    const url = new URL(`${API_BASE_URL}/api/v1/inventory/forecast`)
    if (storeCode) url.searchParams.set("store_code", storeCode)

    const response = await fetch(url.toString())
    if (!response.ok) {
        throw new Error("Failed to fetch AI demand forecast.")
    }
    return response.json()
}
