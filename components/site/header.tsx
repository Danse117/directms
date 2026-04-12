import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CartBadge } from "@/components/cart/cart-badge";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-base font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            D
          </span>
          <span>DirectMS</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground sm:flex">
          <Link
            href="/#products"
            className="transition-colors hover:text-foreground"
          >
            Catalog
          </Link>
          <Link
            href="/#inquiry"
            className="transition-colors hover:text-foreground"
          >
            Inquiry
          </Link>
        </nav>

        <Link
          href="/cart"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          Cart
          <CartBadge />
        </Link>
      </div>
    </header>
  );
}
