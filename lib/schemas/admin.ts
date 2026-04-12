import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Product form schema. Values arrive as strings from FormData,
 * so price and sortOrder use `z.coerce`. Flavors arrives as a
 * JSON-stringified array. isVisible arrives as "on" (checkbox
 * checked) or is missing (unchecked).
 */
export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens"
    ),
  subtitle: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  flavors: z
    .string()
    .transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter at least one flavor",
          });
          return z.NEVER;
        }
        return parsed as string[];
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid flavors format",
        });
        return z.NEVER;
      }
    }),
  isVisible: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((val) => val === "on" || val === "true" || val === true)
    .default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
