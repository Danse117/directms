import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your DirectMS order and submit for fulfillment.",
};

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <CartView />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
