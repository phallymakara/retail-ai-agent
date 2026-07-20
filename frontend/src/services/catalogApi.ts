const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"

export interface CatalogProduct {
  id: string
  sku: string
  name: string
  name_km?: string | null
  category: string
  description?: string | null
  price: string
  currency: string
  brand?: string | null
  image_url?: string | null
  is_active: boolean
}

export async function fetchCatalogProducts(
  query?: string,
  category?: string,
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams()
  if (query) params.append("query", query)
  if (category && category !== "All") params.append("category", category)

  const response = await fetch(
    `${API_BASE_URL}/api/v1/catalog/products?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error("Failed to fetch catalog products.")
  }
  return response.json()
}
