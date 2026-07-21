import { useState } from "react"
import { CheckCircle2, XCircle, ArrowRight, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react"
import type { InventoryProposalData } from "../types/inventory"
import { confirmProposalApi, cancelProposalApi } from "../services/inventoryApi"

interface InventoryProposalCardProps {
    proposal: InventoryProposalData
    onStatusChange?: (updated: InventoryProposalData) => void
}

export function InventoryProposalCard({ proposal, onStatusChange }: InventoryProposalCardProps) {
    const [currentProposal, setCurrentProposal] = useState<InventoryProposalData>(proposal)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const isTransfer = currentProposal.proposal_type === "transfer"
    const isConfirmed = currentProposal.status === "confirmed"
    const isCancelled = currentProposal.status === "cancelled"
    const isPending = currentProposal.status === "pending"

    const handleConfirm = async () => {
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const updated = await confirmProposalApi(currentProposal.id)
            setCurrentProposal(updated)
            if (onStatusChange) onStatusChange(updated)
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Confirmation failed.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = async () => {
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const updated = await cancelProposalApi(currentProposal.id)
            setCurrentProposal(updated)
            if (onStatusChange) onStatusChange(updated)
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Cancellation failed.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="proposal-card">
            {/* Top Row: Product Name & Status Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                        {currentProposal.product_name || "Product"}
                        {currentProposal.sku && (
                            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748b", marginLeft: "8px", fontWeight: "600" }}>
                                ({currentProposal.sku})
                            </span>
                        )}
                    </h4>
                </div>

                <div>
                    {isConfirmed && (
                        <span className="proposal-status-tag status-tag--executed">
                            <CheckCircle2 size={14} /> Executed & Audited
                        </span>
                    )}
                    {isCancelled && (
                        <span className="proposal-status-tag status-tag--cancelled">
                            <XCircle size={14} /> Cancelled
                        </span>
                    )}
                    {isPending && (
                        <span className="proposal-status-tag status-tag--pending">
                            <AlertTriangle size={14} /> Awaiting Staff Confirmation
                        </span>
                    )}
                </div>
            </div>

            {/* Change Preview Grid */}
            <div className="proposal-stock-grid">
                {/* Source Store */}
                <div>
                    <div className="proposal-stock-label">
                        {isTransfer ? "From Source Branch:" : "Store Branch:"}
                    </div>
                    <div className="proposal-stock-store">
                        {currentProposal.store_name || currentProposal.store_code}
                    </div>
                    <div className="proposal-stock-flow">
                        <span>Before: <strong className="stock-val--before">{currentProposal.previous_quantity}</strong></span>
                        <ArrowRight size={14} />
                        <span>After: <strong className={currentProposal.new_quantity >= currentProposal.previous_quantity ? "stock-val--after-plus" : "stock-val--after-minus"}>{currentProposal.new_quantity}</strong></span>
                    </div>
                </div>

                {/* Target Store (for transfers) */}
                {isTransfer && (
                    <div>
                        <div className="proposal-stock-label">To Target Branch:</div>
                        <div className="proposal-stock-store">
                            {currentProposal.target_store_name || currentProposal.target_store_code}
                        </div>
                        <div className="proposal-stock-flow">
                            <span>Before: <strong className="stock-val--before">{currentProposal.target_previous_quantity ?? 0}</strong></span>
                            <ArrowRight size={14} />
                            <span>After: <strong className="stock-val--after-plus">{currentProposal.target_new_quantity ?? 0}</strong></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Banner */}
            {errorMessage && (
                <div className="proposal-error-banner">
                    {errorMessage}
                </div>
            )}

            {/* Actions for Pending Proposals */}
            {isPending && (
                <div className="proposal-actions">
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="btn-confirm-proposal"
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <>
                                <ShieldCheck size={16} />
                                Confirm
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="btn-cancel-proposal"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    )
}
