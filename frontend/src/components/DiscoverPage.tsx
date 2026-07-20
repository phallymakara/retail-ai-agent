import { useEffect, useMemo, useRef, useState } from "react"
import { fetchCatalogProducts } from "../services/catalogApi"
import type { CatalogProduct } from "../services/catalogApi"
import type { CartItem } from "../types/order"

interface DiscoverPageProps {
  onAddToCart: (item: CartItem) => void
  storeName?: string
  onSwitchToChat: () => void
}

type SortOption = "default" | "price_asc" | "price_desc" | "name_asc"

export function DiscoverPage({
  onAddToCart,
}: DiscoverPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedSearchImage, setSelectedSearchImage] = useState<string | null>(null)

  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortOption, setSortOption] = useState<SortOption>("default")
  const [addedSkus, setAddedSkus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void loadProducts()
  }, [])

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

  const handleImageSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setSelectedSearchImage(result)
      // Prototype simulated image search: filter for milk & rice items
      setSearchQuery("milk")
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="discover-page-container">
      <div className="discover-page-toolbar">
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
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery("")
                setSelectedSearchImage(null)
              }}
            >
              ✕
            </button>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageSearch}
        />

        <button
          type="button"
          className="discover-image-search-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Search products by image"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        {selectedSearchImage && (
          <div className="search-image-preview-badge">
            <img src={selectedSearchImage} alt="Image search preview" />
            <span>Image Search</span>
            <button
              type="button"
              onClick={() => {
                setSelectedSearchImage(null)
                setSearchQuery("")
              }}
            >
              ✕
            </button>
          </div>
        )}

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

      <div className="discover-page-content">
        {isLoading ? (
          <div className="discover-loading">
            <div className="spinner" />
            <span>Loading store products...</span>
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
  )
}
