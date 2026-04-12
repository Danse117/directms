"use client";

import { useCartCount } from "./cart-store";
import { useIsMounted } from "@/lib/use-is-mounted";

export function CartBadge() {
  const mounted = useIsMounted();
  const count = useCartCount();

  const displayed = mounted ? count : 0;

  return (
    <span
      className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground tabular-nums"
      aria-label={`${displayed} item${displayed === 1 ? "" : "s"} in cart`}
    >
      {displayed}
    </span>
  );
}
