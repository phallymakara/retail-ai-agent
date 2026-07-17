export interface CartItem {
    productId: string
    sku: string
    name: string
    nameKm: string | null
    imageUrl: string | null
    unitPrice: string
    currency: string
    quantity: number
}

export interface OrderItemRequest {
    sku: string
    quantity: number
}

export interface CreateOrderRequest {
    store_code: string
    customer_name: string
    customer_phone: string
    customer_email: string | null
    fulfillment_type: "pickup" | "delivery"
    delivery_address: string | null
    customer_note: string | null
    payment_method: "cash" | "pay_at_store"
    items: OrderItemRequest[]
}

export interface OrderItemResponse {
    product_id: string
    sku: string
    name: string
    name_km: string | null
    image_url: string | null
    unit_price: string
    quantity: number
    line_total: string
    currency: string
}

export interface OrderResponse {
    id: string
    order_number: string
    store_code: string
    store_name: string
    customer_name: string
    customer_phone: string
    customer_email: string | null
    fulfillment_type: "pickup" | "delivery"
    delivery_address: string | null
    customer_note: string | null
    status: string
    payment_method: string
    payment_status: string
    subtotal: string
    discount_amount: string
    total_amount: string
    currency: string
    created_at: string
    confirmed_at: string | null
    items: OrderItemResponse[]
}