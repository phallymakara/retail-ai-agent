import type {
    CreateOrderRequest,
    OrderResponse,
} from "../types/order"

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ??
    "http://127.0.0.1:8000"

export class OrderApiError extends Error {
    status: number
    detail: unknown

    constructor(
        message: string,
        status: number,
        detail?: unknown,
    ) {
        super(message)
        this.name = "OrderApiError"
        this.status = status
        this.detail = detail
    }
}

export async function createOrder(
    request: CreateOrderRequest,
    signal?: AbortSignal,
): Promise<OrderResponse> {
    const response = await fetch(
        `${API_BASE_URL}/api/v1/orders`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
            signal,
        },
    )

    if (!response.ok) {
        let message = `Order failed with status ${response.status}`
        let detail: unknown

        try {
            const body = (await response.json()) as {
                detail?: unknown
            }

            detail = body.detail

            if (typeof body.detail === "string") {
                message = body.detail
            } else if (
                body.detail &&
                typeof body.detail === "object" &&
                "message" in body.detail
            ) {
                const detailMessage = (
                    body.detail as { message?: unknown }
                ).message

                if (typeof detailMessage === "string") {
                    message = detailMessage
                }
            }
        } catch {
            // Keep the fallback message.
        }

        throw new OrderApiError(
            message,
            response.status,
            detail,
        )
    }

    return (await response.json()) as OrderResponse
}

export async function getOrder(
    orderNumber: string,
    signal?: AbortSignal,
): Promise<OrderResponse> {
    const response = await fetch(
        `${API_BASE_URL}/api/v1/orders/${encodeURIComponent(
            orderNumber,
        )}`,
        { signal },
    )

    if (!response.ok) {
        throw new OrderApiError(
            "Unable to retrieve the order.",
            response.status,
        )
    }

    return (await response.json()) as OrderResponse
}