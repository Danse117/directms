"use server";

import { redirect } from "next/navigation";
import { orderSchema, type OrderInput } from "@/lib/schemas/order";

export type PlaceOrderState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof OrderInput, string[]>>;
};

function generateOrderNumber(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DM-${random}`;
}

export async function placeOrderAction(
  _prevState: PlaceOrderState,
  formData: FormData
): Promise<PlaceOrderState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, error: "Missing payload" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON payload" };
  }

  const result = orderSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: result.error.flatten().fieldErrors as PlaceOrderState["fieldErrors"],
    };
  }

  // Phase 1 stub — no DB write, no email. Just redirect with a fake order number.
  const orderNumber = generateOrderNumber();
  redirect(`/order-success?order=${orderNumber}`);
}
