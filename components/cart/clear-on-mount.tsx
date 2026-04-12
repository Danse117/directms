"use client";

import { useEffect } from "react";
import { useCartStore } from "./cart-store";

export function ClearOnMount() {
  const clear = useCartStore((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
