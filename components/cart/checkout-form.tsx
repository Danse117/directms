"use client";

import { useEffect, useRef } from "react";
import { useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCartItems, useCartStore } from "./cart-store";
import {
  placeOrderAction,
  type PlaceOrderState,
} from "@/app/actions/place-order";
import { orderSchema, type OrderInput } from "@/lib/schemas/order";

const initialState: PlaceOrderState = { ok: false };

// Form-only subset — items come from the cart store, not from RHF.
type CheckoutFormValues = Omit<OrderInput, "items">;

const checkoutFormSchema = orderSchema.omit({ items: true });

export function CheckoutForm() {
  const [state, formAction, pending] = useActionState(
    placeOrderAction,
    initialState
  );
  const items = useCartItems();
  const clearCart = useCartStore((s) => s.clear);
  const router = useRouter();
  const lastHandledOrderNumber = useRef<string | undefined>(undefined);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      storeAddress: "",
      notes: "",
    },
  });

  // React to a successful order: clear the cart and navigate to the success page.
  useEffect(() => {
    if (
      state.ok &&
      state.orderNumber &&
      state.orderNumber !== lastHandledOrderNumber.current
    ) {
      lastHandledOrderNumber.current = state.orderNumber;
      clearCart();
      router.push(`/order-success?order=${state.orderNumber}`);
    }
  }, [state, clearCart, router]);

  function onSubmit(values: CheckoutFormValues) {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    const payload: OrderInput = {
      ...values,
      items: items.map((i) => ({
        productId: i.productId,
        flavor: i.flavor,
        quantity: i.quantity,
      })),
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    formData.set("website", "");
    startTransition(() => formAction(formData));
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" placeholder="Jane" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input autoComplete="family-name" placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="storeAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store address (optional)</FormLabel>
              <FormControl>
                <Input
                  autoComplete="street-address"
                  placeholder="123 Main St, Suite 100"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Special instructions or order notes."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Honeypot — visually hidden, off-tab, autofill-suppressed */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-10000px",
            top: "auto",
            width: "1px",
            height: "1px",
            overflow: "hidden",
          }}
        >
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        {state.error && !state.ok ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={pending || items.length === 0}
          className="w-full"
        >
          <Send data-icon="inline-start" aria-hidden="true" />
          {pending ? "Submitting…" : "Submit order"}
        </Button>
      </form>
    </Form>
  );
}
