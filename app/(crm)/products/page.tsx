import { getProducts, type ProductFilters } from "@/app/actions/products"
import { ProductsGrid } from "@/components/products"
import type { ProductCategory } from "@/lib/types"

interface ProductsPageProps {
  searchParams: {
    search?: string
    category?: string
    page?: string
  }
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const filters: ProductFilters = {
    search: searchParams.search || undefined,
    category: (searchParams.category as ProductCategory) || undefined,
    page: searchParams.page ? parseInt(searchParams.page) : 1,
    pageSize: 20,
  }

  const { products, total } = await getProducts(filters)

  return <ProductsGrid products={products} total={total} />
}
