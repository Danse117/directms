"use server";

import { inquirySchema, type InquiryInput } from "@/lib/schemas/inquiry";

export type SendInquiryState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof InquiryInput, string[]>>;
  submittedAt?: number;
};

export async function sendInquiryAction(
  _prevState: SendInquiryState,
  formData: FormData
): Promise<SendInquiryState> {
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

  const result = inquirySchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: result.error.flatten()
        .fieldErrors as SendInquiryState["fieldErrors"],
    };
  }

  // Phase 1 stub — no DB write, no email. Just return ok with a timestamp
  // so the client can show "Sent!" and the form can reset.
  return { ok: true, submittedAt: Date.now() };
}
