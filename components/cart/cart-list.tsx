"use client";

import { AnimatePresence } from "motion/react";
import { ShoppingBag } from "lucide-react";

import { CartItem } from "./cart-item";
import { useCartItems, useCartSubtotal } from "./cart-store";
import { formatCurrency } from "@/lib/format";
import { useIsMounted } from "@/lib/use-is-mounted";

export function CartList() {
  const mounted = useIsMounted();
  const items = useCartItems();
  const subtotal = useCartSubtotal();

  if (!mounted) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading your cart…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <ShoppingBag className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          Your cart is empty
        </p>
        <p className="text-xs text-muted-foreground">
          Browse the catalog and add a few items to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.flavor}`}
              item={item}
            />
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-5 py-4">
        <span className="text-sm font-medium text-muted-foreground">
          Subtotal
        </span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {formatCurrency(subtotal)}
        </span>
      </div>
    </div>
  );
}
