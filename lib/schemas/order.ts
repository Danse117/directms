import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  flavor: z.string().min(1, "Choose a flavor"),
  quantity: z.number().int().min(1).max(999),
});

export const orderSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Enter a valid email"),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be under 1000 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  items: z.array(orderItemSchema).min(1, "Your cart is empty"),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
