import { ProductCard } from "./product-card";
import type { Product } from "@/lib/data/products";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <section
      id="products"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16"
    >
      <div className="mb-10 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Shop products
        </p>
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Browse the catalog
        </h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
