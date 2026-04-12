"use client";

import { motion } from "motion/react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem as CartItemType } from "./cart-store";
import { formatCurrency } from "@/lib/format";

export function CartItem({ item }: { item: CartItemType }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const lineTotal = item.unitPrice * item.quantity;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">
          {item.productName}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Flavor: <span className="text-foreground">{item.flavor}</span>
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatCurrency(item.unitPrice)} each
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Decrease quantity"
            onClick={() =>
              updateQuantity(item.productId, item.flavor, item.quantity - 1)
            }
          >
            <Minus aria-hidden="true" />
          </Button>
          <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
            {item.quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Increase quantity"
            onClick={() =>
              updateQuantity(item.productId, item.flavor, item.quantity + 1)
            }
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="min-w-[5ch] text-right text-base font-semibold tabular-nums text-foreground">
            {formatCurrency(lineTotal)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove from cart"
            onClick={() => removeItem(item.productId, item.flavor)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.li>
  );
}
