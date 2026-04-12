"use client";

import { CartList } from "@/components/cart/cart-list";
import { CheckoutForm } from "@/components/cart/checkout-form";

export function CartView() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Your cart
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Review your order
          </h1>
        </div>
        <CartList />
      </div>
      <div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-5 flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Checkout
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              Send your order
            </h2>
          </div>
          <CheckoutForm />
        </div>
      </div>
    </div>
  );
}
