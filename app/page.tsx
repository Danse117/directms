import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { ProductGrid } from "@/components/products/product-grid";
import { InquiryForm } from "@/components/inquiry/inquiry-form";
import { products } from "@/lib/products.seed";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ProductGrid products={products} />
        <section
          id="inquiry"
          className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16"
        >
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Need something else?
              </p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Send a product inquiry
              </h2>
              <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                If you don&apos;t see what you need on the site, drop the
                details below and we&apos;ll follow up as soon as possible.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
              <InquiryForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
