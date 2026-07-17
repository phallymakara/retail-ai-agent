import { useState } from "react"

import type { ToolExecution } from "../types/chat"
import type { CartItem } from "../types/order"

interface ProductRecord {
    id: string
    sku: string
    name: string
    name_km: string | null
    price: string
    currency: string
    image_url: string | null
    is_active: boolean
    available_quantity: number | null
    category?: string
    brand?: string
}

interface ProductCardProps {
    product: ProductRecord
    onAddToCart: (item: CartItem) => void
}

interface ProductCardsProps {
    executions: ToolExecution[]
    onAddToCart: (item: CartItem) => void
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function parseProduct(
    value: unknown,
): ProductRecord | null {
    if (!isRecord(value)) {
        return null
    }

    if (
        typeof value.id !== "string" ||
        typeof value.sku !== "string" ||
        typeof value.name !== "string" ||
        typeof value.price !== "string"
    ) {
        return null
    }

    return {
        id: value.id,
        sku: value.sku,
        name: value.name,
        name_km:
            typeof value.name_km === "string"
                ? value.name_km
                : null,
        price: value.price,
        currency:
            typeof value.currency === "string"
                ? value.currency
                : "USD",
        image_url:
            typeof value.image_url === "string"
                ? value.image_url
                : null,
        is_active:
            typeof value.is_active === "boolean"
                ? value.is_active
                : true,
        available_quantity: null,
        category:
            typeof value.category === "string"
                ? value.category
                : undefined,
        brand:
            typeof value.brand === "string"
                ? value.brand
                : undefined,
    }
}

function extractProducts(
    executions: ToolExecution[],
): ProductRecord[] {
    const availability = new Map<string, number>()

    for (const execution of executions) {
        if (
            execution.name !== "check_inventory" ||
            !isRecord(execution.result)
        ) {
            continue
        }

        const sku = execution.result.sku
        const totalAvailable =
            execution.result.total_available

        if (
            typeof sku === "string" &&
            typeof totalAvailable === "number"
        ) {
            availability.set(sku, totalAvailable)
        }
    }

    const products = new Map<string, ProductRecord>()

    for (const execution of executions) {
        if (
            execution.name !== "search_products" &&
            execution.name !== "get_product_details"
        ) {
            continue
        }

        const results = Array.isArray(execution.result)
            ? execution.result
            : [execution.result]

        for (const result of results) {
            const product = parseProduct(result)

            if (!product?.is_active) {
                continue
            }

            product.available_quantity =
                availability.get(product.sku) ?? null

            products.set(product.sku, product)
        }
    }

    return [...products.values()]
}

function getProductSpecs(product: ProductRecord): string {
    const specs: Record<string, string> = {
        "MILK-UHT-1L": "1L · Fresh cow milk",
        "RICE-JASMINE-5K": "5kg · Premium Jasmine rice",
        "SHAMP-NOURISH-650": "650ml · For all hair types",
        "SHAMP-CLEAN-600": "600ml · Deep cleansing",
        "SHAMP-SILKY-600": "600ml · Smooth & shine",
    }
    return specs[product.sku] || `${product.category || 'Product'} · Active`
}

function ProductCard({
    product,
    onAddToCart,
    index,
}: ProductCardProps & { index: number }) {
    const maximumQuantity =
        product.available_quantity === null
            ? 99
            : Math.max(product.available_quantity, 1)

    const [quantity, setQuantity] = useState(1)

    const isOutOfStock =
        product.available_quantity !== null &&
        product.available_quantity <= 0

    const isLowStock =
        product.available_quantity !== null &&
        product.available_quantity > 0 &&
        product.available_quantity <= 5

    function changeQuantity(nextQuantity: number) {
        setQuantity(
            Math.min(
                Math.max(nextQuantity, 1),
                maximumQuantity,
            ),
        )
    }

    function createCartItem(): CartItem {
        return {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            nameKm: product.name_km,
            imageUrl: product.image_url,
            unitPrice: product.price,
            currency: product.currency,
            quantity,
        }
    }

    let badgeText = ""
    let badgeClass = ""

    if (isLowStock) {
        badgeText = "Low stock"
        badgeClass = "product-badge--low-stock"
    } else if (index === 0) {
        badgeText = "Best match"
        badgeClass = "product-badge--best-match"
    } else {
        badgeText = "Popular"
        badgeClass = "product-badge--popular"
    }

    return (
        <article className="product-card">
            <div className="product-card__left">
                {badgeText && (
                    <span className={`product-badge ${badgeClass}`}>
                        {badgeText}
                    </span>
                )}

                <div className="product-card__image">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            loading="lazy"
                        />
                    ) : (
                        <span>No image</span>
                    )}
                </div>

                <div className="quantity-selector">
                    <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={quantity <= 1}
                        onClick={() => changeQuantity(quantity - 1)}
                    >
                        −
                    </button>
                    <input
                        type="number"
                        min={1}
                        max={maximumQuantity}
                        value={quantity}
                        disabled={isOutOfStock}
                        aria-label="Product quantity"
                        onChange={(event) =>
                            changeQuantity(Number(event.target.value) || 1)
                        }
                    />
                    <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={isOutOfStock || quantity >= maximumQuantity}
                        onClick={() => changeQuantity(quantity + 1)}
                    >
                        +
                    </button>
                </div>
            </div>

            <div className="product-card__right">
                <div className="product-card__details">
                    <h3>{product.name}</h3>
                    <p className="product-card__specs">
                        {getProductSpecs(product)}
                    </p>

                    <div className="product-card__price">
                        {product.currency === "USD" ? "$" : ""}
                        {product.price}
                    </div>

                    <div className="product-card__stock">
                        {isOutOfStock ? (
                            <span className="stock-status stock-status--out">
                                <span className="status-dot-icon" /> Out of stock
                            </span>
                        ) : isLowStock ? (
                            <span className="stock-status stock-status--low">
                                <span className="status-dot-icon" /> Only {product.available_quantity} left
                            </span>
                        ) : (
                            <span className="stock-status stock-status--in">
                                <span className="status-dot-icon" /> In stock
                            </span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    className="add-cart-button"
                    disabled={isOutOfStock}
                    onClick={() => onAddToCart(createCartItem())}
                >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="cart-btn-icon">
                        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                    Add to cart
                </button>
            </div>
        </article>
    )
}

export function ProductCards({
    executions,
    onAddToCart,
}: ProductCardsProps) {
    const products = extractProducts(executions)

    if (products.length === 0) {
        return null
    }

    return (
        <div className="product-grid">
            {products.map((product, index) => (
                <ProductCard
                    key={product.sku}
                    product={product}
                    index={index}
                    onAddToCart={onAddToCart}
                />
            ))}
        </div>
    )
}