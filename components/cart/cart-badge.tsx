"use client";

import { useEffect, useState } from "react";
import { useCartCount } from "./cart-store";

export function CartBadge() {
  const [mounted, setMounted] = useState(false);
  const count = useCartCount();

  useEffect(() => {
    setMounted(true);
  }, []);

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
