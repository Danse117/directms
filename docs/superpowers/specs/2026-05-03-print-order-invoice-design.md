# Print Order Invoice — Design

**Date:** 2026-05-03
**Phase:** Phase 3 (Admin) extension
**Status:** Approved (pending user spec review)

## Summary

Add a print-friendly invoice view for admin orders. Admins click a Printer button on any row in `/admin/orders` or in the header of `/admin/orders/[id]`. A new tab opens at `/admin/orders/[id]/print` showing a clean invoice layout (DirectMS header, customer block, items table, total, notes, footer) and auto-triggers `window.print()` after web fonts load. The user prints or saves as PDF.

## Goals

- One-click invoice printing from both the orders list and the order detail page.
- Output is a formal-looking invoice suitable to hand to (or send to) the customer.
- "Print → Save as PDF" gives the admin a PDF without adding a PDF library.
- No changes to existing data, mutation, or auth surfaces.

## Non-goals

- No PDF generation library (puppeteer, react-pdf, etc.).
- No emailing the invoice — purely print/save.
- No tax, shipping, or discount lines (subtotal is the final number).
- No editable invoice fields — strictly a render of stored order data.
- No customer-facing invoice page outside `/admin`.

## Architecture

### New route

`app/admin/orders/[id]/print/page.tsx` — Server Component, **outside** the `(dashboard)` route group so it does not inherit the admin sidebar/topbar chrome.

`app/admin/orders/[id]/print/layout.tsx` — minimal layout that:
1. Runs `supabase.auth.getUser()` and `redirect('/admin/login')` if absent (defense in depth on top of `proxy.ts`, matching how the `(dashboard)` layout guards the admin UI).
2. Renders `{children}` with no chrome — just `<html>`/`<body>` from the root layout, plus print-specific CSS.

The page itself:
- Awaits `params` (Next.js 16 async request APIs — invariant #8).
- Calls `getOrderById(id)` from `lib/data/orders.ts` (existing helper, no new data layer).
- Returns `notFound()` if the order is missing.
- Renders the invoice layout (see below).
- Mounts a small `<AutoPrint />` Client Component that calls `window.print()` once after `document.fonts.ready`.

### New components

`components/admin/print-order-button.tsx` (Client Component)
- Renders a `<Button variant="ghost" size="sm">` with the lucide `Printer` icon.
- `onClick` → `window.open(`/admin/orders/${id}/print`, '_blank', 'noopener,noreferrer')`.
- Used in:
  - `app/admin/(dashboard)/orders/page.tsx` — table row actions (next to Eye, Mark Fulfilled, Delete).
  - `app/admin/(dashboard)/orders/[id]/page.tsx` — header area, near the status badge.

`components/admin/auto-print.tsx` (Client Component)
- Single `useEffect` on mount:
  ```ts
  document.fonts.ready.then(() => window.print())
  ```
- Renders `null`. Imported only from the print page.

### Reused

- `getOrderById(id)` from `lib/data/orders.ts` — read-only, already RLS-aware via the SSR Supabase client.
- The proxy gate in `proxy.ts` already covers `/admin/*` — the print URL inherits this protection.

## Invoice layout

Top to bottom inside a centered `max-w-[8.5in]` container:

1. **Header band** — flex row
   - Left: `DirectMS` wordmark (large, bold). Mirrors the `D` brand mark from the original site.
   - Right: `INVOICE` heading; under it `Order #{orderNumber}` and the placed-on date.

2. **Customer block** (`Bill To` heading)
   - `{firstName} {lastName}`
   - Email if present
   - Phone if present
   - Store address if present

3. **Meta row** (right-aligned, small text)
   - `Status: {status.toUpperCase()}` (plain text, no colored pill)
   - `Fulfilled: {fulfilledAt}` if present

4. **Items table**
   - Columns: Product · Flavor · Unit Price · Qty · Line Total
   - Plain 1px borders, no row shading.
   - Right-aligned numeric cells.
   - `thead { display: table-header-group }` so headers repeat across pages.
   - `tr { page-break-inside: avoid }` to prevent mid-row splits.

5. **Totals block** — right-aligned, single line: `Total: ${subtotal}` (bold, larger font, labeled "Total" not "Subtotal" since it is the final amount).

6. **Notes block** (if `notes` is present) — `Notes` heading + body.

7. **Footer** — centered: `Thank you for your business — DirectMS`.

## Print CSS

Inline in the print page (or a co-located CSS module):

```css
@media print {
  @page { size: letter; margin: 0.5in; }
  body { color: black; background: white; }
  /* No chrome to hide — layout has none. */
}

/* Always-on (screen + print): */
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #d4d4d4; padding: 8px; }
th { text-align: left; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
td.num, th.num { text-align: right; }
```

The page also looks like an invoice on screen so the admin can preview before printing.

## Data flow

1. Admin loads `/admin/orders` or `/admin/orders/[id]`.
2. Clicks the Printer button.
3. `window.open('/admin/orders/{id}/print', '_blank', 'noopener,noreferrer')` opens a new tab.
4. New tab: layout runs auth check → page Server Component fetches order → invoice HTML renders.
5. `<AutoPrint />` mounts, `document.fonts.ready` resolves, `window.print()` fires.
6. Browser print dialog appears. User prints or cancels. Tab stays open until manually closed.

No mutations, no Server Actions, no client-sent prices.

## Auth

- `proxy.ts` covers `/admin/*` (existing).
- Print route's own `layout.tsx` calls `supabase.auth.getUser()` and redirects if unauthenticated — defense in depth, matching the existing `(dashboard)` layout pattern.
- No service-role key (invariant #5 — never used anywhere).
- No new RLS policies — reuses the existing `orders` read policy.

## Edge cases

| Case | Handling |
|---|---|
| Order ID not found | `notFound()` → standard Next.js 404 |
| Items array empty | Empty table body, total `$0.00`. Acceptable. |
| Long item list | Headers repeat across pages, rows don't split |
| Long product/flavor strings | `word-wrap: break-word` on cells |
| `window.open` blocked | Rare on direct click; not handled in v1. If users hit it, fall back to `<a target="_blank">` with `onClick` that calls `window.print()` inline. |
| Fonts not loaded when print fires | Wait for `document.fonts.ready` before `window.print()` |
| B&W printer | Pure black text on white, no shaded rows, no colored badges |

## Files changed

**New:**
- `app/admin/orders/[id]/print/layout.tsx`
- `app/admin/orders/[id]/print/page.tsx`
- `components/admin/print-order-button.tsx`
- `components/admin/auto-print.tsx`

**Modified:**
- `app/admin/(dashboard)/orders/page.tsx` — add `<PrintOrderButton orderId={order.id} />` to row actions.
- `app/admin/(dashboard)/orders/[id]/page.tsx` — add the print button to the header area near the status badge.

## Testing

- No new server-side logic warrants unit tests (the page is a thin render of `getOrderById`).
- Manual verification:
  - Dev server up.
  - Click print from `/admin/orders` row → new tab opens, invoice renders, print dialog appears.
  - Click print from `/admin/orders/[id]` header → same.
  - Save as PDF and inspect: header, customer block, items table, total, notes, footer all present.
  - Force B&W print preview to confirm legibility without color.
  - Test with an order containing many items to verify pagination behavior.

## Open questions

None — all clarified during brainstorming:
- Purpose: invoice (B).
- Trigger: dedicated print page in new tab (B).
- Header: just `DirectMS`, no contact info.
- Fields included: all fields from the detail page.
- Totals: subtotal only, labeled "Total".
