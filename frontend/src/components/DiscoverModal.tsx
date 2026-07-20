import { useEffect, useMemo, useState } from "react"
import { fetchCatalogProducts } from "../services/catalogApi"
import type { CatalogProduct } from "../services/catalogApi"
import type { CartItem } from "../types/order"

interface DiscoverModalProps {
  isOpen: boolean
  onClose: () => void
  onAddToCart: (item: CartItem) => void
  storeName: string
}

type SortOption = "default" | "price_asc" | "price_desc" | "name_asc"

export function DiscoverModal({
  isOpen,
  onClose,
  onAddToCart,
  storeName,
}: DiscoverModalProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortOption, setSortOption] = useState<SortOption>("default")
  const [addedSkus, setAddedSkus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isOpen) {
      void loadProducts()
    }
  }, [isOpen])

  const loadProducts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchCatalogProducts()
      setProducts(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load products.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return ["All", ...Array.from(set)]
  }, [products])

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        const matchesCategory =
          selectedCategory === "All" ||
          product.category.toLowerCase() === selectedCategory.toLowerCase()

        const query = searchQuery.trim().toLowerCase()
        const matchesQuery =
          !query ||
          product.name.toLowerCase().includes(query) ||
          (product.name_km && product.name_km.toLowerCase().includes(query)) ||
          (product.brand && product.brand.toLowerCase().includes(query)) ||
          product.sku.toLowerCase().includes(query)

        return matchesCategory && matchesQuery
      })
      .sort((a, b) => {
        if (sortOption === "price_asc") {
          return Number(a.price) - Number(b.price)
        }
        if (sortOption === "price_desc") {
          return Number(b.price) - Number(a.price)
        }
        if (sortOption === "name_asc") {
          return a.name.localeCompare(b.name)
        }
        return 0
      })
  }, [products, searchQuery, selectedCategory, sortOption])

  const handleAddToCart = (product: CatalogProduct) => {
    onAddToCart({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      nameKm: product.name_km ?? null,
      imageUrl: product.image_url ?? null,
      unitPrice: product.price,
      currency: product.currency,
      quantity: 1,
    })

    setAddedSkus((prev) => ({ ...prev, [product.sku]: true }))
    setTimeout(() => {
      setAddedSkus((prev) => ({ ...prev, [product.sku]: false }))
    }, 1500)
  }

  if (!isOpen) return null

  return (
    <div className="discover-overlay" onClick={onClose}>
      <div
        className="discover-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="discover-header">
          <div>
            <h2>Discover Products</h2>
            <p className="discover-store-badge">📍 Store: {storeName}</p>
          </div>
          <button
            type="button"
            className="discover-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="discover-controls">
          <div className="discover-search-box">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search products by name, brand or SKU..."
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

          <div className="discover-sort-box">
            <label htmlFor="sort-select">Sort by:</label>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="default">Default</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A - Z</option>
            </select>
          </div>
        </div>

        <div className="discover-category-chips">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-chip ${
                selectedCategory === cat ? "category-chip--active" : ""
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="discover-body">
          {isLoading ? (
            <div className="discover-loading">
              <div className="spinner" />
              <span>Loading store catalog...</span>
            </div>
          ) : error ? (
            <div className="discover-error">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="discover-empty">
              <p>No products found matching your search or category filter.</p>
              <button
                type="button"
                className="discover-reset-filters-btn"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("All")
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="discover-grid">
              {filteredProducts.map((product) => {
                const isAdded = Boolean(addedSkus[product.sku])
                return (
                  <div key={product.id} className="discover-card">
                    <div className="discover-card-img-wrapper">
                      <img
                        src={
                          product.image_url ||
                          "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400"
                        }
                        alt={product.name}
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400"
                        }}
                      />
                      <span className="discover-card-cat">
                        {product.category}
                      </span>
                    </div>

                    <div className="discover-card-info">
                      <h4 className="discover-card-title">{product.name}</h4>
                      {product.name_km && (
                        <p className="discover-card-km">{product.name_km}</p>
                      )}
                      {product.brand && (
                        <span className="discover-card-brand">
                          Brand: {product.brand}
                        </span>
                      )}

                      <div className="discover-card-bottom">
                        <div className="discover-card-price">
                          ${product.price} <span>{product.currency}</span>
                        </div>

                        <button
                          type="button"
                          className={`discover-add-cart-btn ${
                            isAdded ? "added" : ""
                          }`}
                          onClick={() => handleAddToCart(product)}
                        >
                          {isAdded ? "Added ✓" : "+ Add to Cart"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
