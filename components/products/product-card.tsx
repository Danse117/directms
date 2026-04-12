"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCartStore } from "@/components/cart/cart-store";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/products.seed";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const [flavor, setFlavor] = useState<string>(product.flavors[0] ?? "");
  const [quantity, setQuantity] = useState<number>(1);

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flavor) return;
    addItem({
      productId: product.id,
      productName: product.name,
      flavor,
      quantity,
      unitPrice: product.price,
    });
    toast.success("Added to cart", {
      description: `${product.name} · ${flavor} · qty ${quantity}`,
    });
    setQuantity(1);
  }

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <Image
          src={product.imagePath}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <Badge
          variant="secondary"
          className="absolute left-4 top-4 bg-card/90 text-foreground shadow-sm backdrop-blur"
        >
          {product.flavors.length} flavors
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight tracking-tight">
              {product.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.subtitle}
            </p>
          </div>
          <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
            {formatCurrency(product.price)}
          </span>
        </div>

        <form onSubmit={handleAdd} className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`flavor-${product.id}`} className="text-xs">
              Flavor
            </Label>
            <Select value={flavor} onValueChange={setFlavor}>
              <SelectTrigger
                id={`flavor-${product.id}`}
                className="w-full"
                aria-label="Choose flavor"
              >
                <SelectValue placeholder="Choose flavor" />
              </SelectTrigger>
              <SelectContent>
                {product.flavors.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex w-20 flex-col gap-1.5">
              <Label htmlFor={`qty-${product.id}`} className="text-xs">
                Qty
              </Label>
              <Input
                id={`qty-${product.id}`}
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <Button type="submit" className="flex-1" disabled={!flavor}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Add to cart
            </Button>
          </div>
        </form>
      </div>
    </motion.article>
  );
}
