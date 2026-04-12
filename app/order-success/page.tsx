import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { ClearOnMount } from "@/components/cart/clear-on-mount";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Order received",
  description: "Your DirectMS order has been received.",
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const orderNumber = order && /^DM-[A-Z0-9]{3,}$/.test(order) ? order : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 py-24 text-center">
          <ClearOnMount />
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Order received
            </h1>
            <p className="max-w-md text-pretty text-base text-muted-foreground">
              Thanks — we&apos;ve got your order and will be in touch shortly
              to confirm fulfillment.
            </p>
          </div>
          {orderNumber ? (
            <div className="rounded-xl border border-border bg-card px-6 py-4 text-sm">
              <span className="text-muted-foreground">Order number</span>
              <br />
              <span className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                {orderNumber}
              </span>
            </div>
          ) : null}
          <Button asChild size="lg">
            <Link href="/">
              Back to catalog
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
