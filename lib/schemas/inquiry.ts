import { z } from "zod";

export const inquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  businessName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z.string().trim().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  requestedItem: z
    .string()
    .trim()
    .min(1, "Tell us what you're looking for")
    .max(200),
  details: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
