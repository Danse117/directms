"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, startTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";

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
import {
  sendInquiryAction,
  type SendInquiryState,
} from "@/app/actions/send-inquiry";
import { inquirySchema, type InquiryInput } from "@/lib/schemas/inquiry";

const initialState: SendInquiryState = { ok: false };

export function InquiryForm() {
  const [state, formAction, pending] = useActionState(
    sendInquiryAction,
    initialState
  );
  const lastHandledAt = useRef<number | undefined>(undefined);

  const form = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: "",
      businessName: "",
      email: "",
      phone: "",
      requestedItem: "",
      details: "",
    },
  });

  // React to Server Action results — show toast on success, toast error otherwise.
  useEffect(() => {
    if (state.ok && state.submittedAt && state.submittedAt !== lastHandledAt.current) {
      lastHandledAt.current = state.submittedAt;
      toast.success("Inquiry sent", {
        description: "We'll follow up as soon as possible.",
      });
      form.reset();
    } else if (!state.ok && state.error) {
      toast.error(state.error);
    }
  }, [state, form]);

  function onSubmit(values: InquiryInput) {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(values));
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business / store</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" placeholder="Optional" {...field} />
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
                <FormLabel>Email</FormLabel>
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
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Optional"
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
          name="requestedItem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are you looking for?</FormLabel>
              <FormControl>
                <Input
                  placeholder="Example: specific brand, flavor, size, or other item"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="details"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inquiry details</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="Tell us what you want, quantities, or any details that help."
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
          <label htmlFor="inquiry-website">Website</label>
          <input
            id="inquiry-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          <Send data-icon="inline-start" aria-hidden="true" />
          {pending ? "Sending…" : "Send inquiry"}
        </Button>
      </form>
    </Form>
  );
}
