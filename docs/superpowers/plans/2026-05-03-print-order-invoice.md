# Print Order Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a print-friendly invoice view for admin orders, accessible via a Printer button in the orders list (per row) and the order detail header.

**Architecture:** New route at `/admin/orders/[id]/print` rendered outside the `(dashboard)` route group so it has no admin chrome. Page is a Server Component that re-uses `getOrderById`. A small client component auto-fires `window.print()` after web fonts load. Two button placements (`<PrintOrderButton>`) open the print URL in a new tab.

**Tech Stack:** Next.js 16 (App Router, Server Components, async `params`), React 19.2, Tailwind v4, shadcn `Button`, `lucide-react` (`Printer` icon), Supabase SSR client (already wired).

**Reference docs:** Next.js 16 docs in `node_modules/next/dist/docs/` — see especially `01-app/03-api-reference/03-file-conventions/route-groups.md` and `01-app/03-api-reference/03-file-conventions/layout.md`. **This is NOT the Next.js you know** — read these before writing route/layout code.

**Spec:** `docs/superpowers/specs/2026-05-03-print-order-invoice-design.md`

---

## File map

**New:**
- `components/admin/auto-print.tsx` — client component that calls `window.print()` after fonts ready
- `components/admin/print-order-button.tsx` — client component, ghost button with `Printer` icon, opens print URL in new tab
- `app/admin/orders/[id]/print/layout.tsx` — minimal layout, server-side auth check, no chrome
- `app/admin/orders/[id]/print/page.tsx` — Server Component, fetches order, renders invoice
- `app/admin/orders/[id]/print/print.css` — invoice + print CSS, imported by the layout

**Modified:**
- `app/admin/(dashboard)/orders/page.tsx` — add `<PrintOrderButton />` to row actions
- `app/admin/(dashboard)/orders/[id]/page.tsx` — add `<PrintOrderButton />` to header

---

## Task 1: Create the AutoPrint client component

**Files:**
- Create: `components/admin/auto-print.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect } from 'react'

/**
 * Fires window.print() once on mount, after web fonts have loaded.
 * Mounted by the print page so the print dialog appears automatically
 * when the tab opens.
 */
export function AutoPrint() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const trigger = () => window.print()
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(trigger)
    } else {
      trigger()
    }
  }, [])

  return null
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to this file. (Other files may have unrelated errors that already existed — only new errors in `components/admin/auto-print.tsx` should block.)

- [ ] **Step 3: Commit**

```bash
git add components/admin/auto-print.tsx
git commit -m "feat(admin): add AutoPrint client component for print page"
```

---

## Task 2: Create the PrintOrderButton client component

**Files:**
- Create: `components/admin/print-order-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PrintOrderButtonProps = {
  orderId: string
  /**
   * 'icon' for compact use in table rows.
   * 'default' for the order detail header (icon + label).
   */
  variant?: 'icon' | 'default'
}

export function PrintOrderButton({
  orderId,
  variant = 'icon',
}: PrintOrderButtonProps) {
  function handleClick() {
    window.open(
      `/admin/orders/${orderId}/print`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={handleClick}
        aria-label="Print order"
        title="Print order"
      >
        <Printer className="size-4" />
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" type="button" onClick={handleClick}>
      <Printer className="size-4" />
      Print invoice
    </Button>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add components/admin/print-order-button.tsx
git commit -m "feat(admin): add PrintOrderButton client component"
```

---

## Task 3: Add the print page CSS

**Files:**
- Create: `app/admin/orders/[id]/print/print.css`

- [ ] **Step 1: Create the stylesheet**

```css
/* Invoice styles — apply to both screen preview and printed output. */

.invoice-page {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.5in;
  background: white;
  color: black;
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid black;
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.invoice-brand {
  font-size: 28pt;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}

.invoice-title-block {
  text-align: right;
}

.invoice-title {
  font-size: 20pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin: 0;
}

.invoice-meta {
  font-size: 10pt;
  margin-top: 4px;
}

.invoice-section {
  margin-bottom: 20px;
}

.invoice-section-heading {
  font-size: 9pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.invoice-customer-row {
  display: flex;
  justify-content: space-between;
  gap: 24px;
}

.invoice-customer dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 12px;
  row-gap: 4px;
  font-size: 10.5pt;
}

.invoice-customer dt {
  color: #555;
}

.invoice-customer dd {
  margin: 0;
}

.invoice-status {
  font-size: 10pt;
  text-align: right;
}

.invoice-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5pt;
}

.invoice-table th,
.invoice-table td {
  border: 1px solid #aaa;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  word-wrap: break-word;
}

.invoice-table thead {
  display: table-header-group;
}

.invoice-table tr {
  page-break-inside: avoid;
}

.invoice-table th {
  background: #f3f3f3;
  font-weight: 700;
}

.invoice-table .num {
  text-align: right;
  white-space: nowrap;
}

.invoice-totals {
  margin-top: 16px;
  text-align: right;
  font-size: 13pt;
  font-weight: 700;
}

.invoice-totals-amount {
  font-size: 16pt;
  margin-left: 8px;
}

.invoice-notes {
  margin-top: 24px;
  padding: 12px 14px;
  border: 1px solid #ccc;
  background: #fafafa;
  font-size: 10.5pt;
  white-space: pre-wrap;
}

.invoice-footer {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid #ccc;
  text-align: center;
  font-size: 9.5pt;
  color: #555;
}

@media print {
  @page {
    size: letter;
    margin: 0.5in;
  }

  html,
  body {
    background: white;
    color: black;
  }

  .invoice-page {
    padding: 0;
    max-width: none;
  }

  .invoice-table th {
    background: white;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/orders/[id]/print/print.css
git commit -m "feat(admin): add invoice print stylesheet"
```

---

## Task 4: Create the print route layout (auth check, no chrome)

**Files:**
- Create: `app/admin/orders/[id]/print/layout.tsx`

This layout deliberately renders no header/sidebar — the print page is its own document. It also performs a server-side auth check (defense in depth on top of `proxy.ts`, matching the pattern in `app/admin/(dashboard)/layout.tsx`).

- [ ] **Step 1: Create the layout**

```tsx
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import './print.css'

export const metadata: Metadata = {
  title: 'Print Invoice',
}

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth: verify auth server-side (proxy.ts is optimistic).
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return <>{children}</>
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/admin/orders/[id]/print/layout.tsx
git commit -m "feat(admin): add chrome-free layout for print route with auth check"
```

---

## Task 5: Create the print page (Server Component)

**Files:**
- Create: `app/admin/orders/[id]/print/page.tsx`

The page reads the order on the server, renders the invoice HTML, and mounts `<AutoPrint />` to fire the print dialog.

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from 'next/navigation'
import { getOrderById } from '@/lib/data/orders'
import { AutoPrint } from '@/components/admin/auto-print'

type Props = {
  params: Promise<{ id: string }>
}

export default async function OrderPrintPage({ params }: Props) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) notFound()

  const placedOn = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const fulfilledOn = order.fulfilledAt
    ? new Date(order.fulfilledAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <main className="invoice-page">
      <AutoPrint />

      <header className="invoice-header">
        <div className="invoice-brand">DirectMS</div>
        <div className="invoice-title-block">
          <h1 className="invoice-title">INVOICE</h1>
          <div className="invoice-meta">Order #{order.orderNumber}</div>
          <div className="invoice-meta">{placedOn}</div>
        </div>
      </header>

      <section className="invoice-section invoice-customer-row">
        <div className="invoice-customer">
          <h2 className="invoice-section-heading">Bill To</h2>
          <dl>
            <dt>Name</dt>
            <dd>
              {order.firstName} {order.lastName}
            </dd>
            {order.email && (
              <>
                <dt>Email</dt>
                <dd>{order.email}</dd>
              </>
            )}
            {order.phone && (
              <>
                <dt>Phone</dt>
                <dd>{order.phone}</dd>
              </>
            )}
            {order.storeAddress && (
              <>
                <dt>Address</dt>
                <dd>{order.storeAddress}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="invoice-status">
          <div>Status: {order.status.toUpperCase()}</div>
          {fulfilledOn && <div>Fulfilled: {fulfilledOn}</div>}
        </div>
      </section>

      <section className="invoice-section">
        <h2 className="invoice-section-heading">Items</h2>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Flavor</th>
              <th className="num">Unit Price</th>
              <th className="num">Qty</th>
              <th className="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td>{item.product_name}</td>
                <td>{item.flavor}</td>
                <td className="num">${item.unit_price.toFixed(2)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">${item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          Total:
          <span className="invoice-totals-amount">
            ${order.subtotal.toFixed(2)}
          </span>
        </div>
      </section>

      {order.notes && (
        <section className="invoice-section">
          <h2 className="invoice-section-heading">Notes</h2>
          <div className="invoice-notes">{order.notes}</div>
        </section>
      )}

      <footer className="invoice-footer">
        Thank you for your business — DirectMS
      </footer>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to this file.

- [ ] **Step 3: Manually verify the page renders**

Start the dev server in a separate terminal: `npm run dev`

Open in a browser (replace `<id>` with a real order id from your local Supabase — pick one from `/admin/orders`):
`http://localhost:3000/admin/orders/<id>/print`

Expected:
- Page renders the invoice (DirectMS header, INVOICE title, customer block, items table, total, footer).
- Browser print dialog appears automatically.
- No admin sidebar or topbar visible.
- Cancelling the dialog leaves the invoice visible on screen.

If you don't have an order yet, create one through the public flow (`/` → add to cart → checkout) before running this step.

- [ ] **Step 4: Commit**

```bash
git add app/admin/orders/[id]/print/page.tsx
git commit -m "feat(admin): add print invoice page with auto-print"
```

---

## Task 6: Wire the print button into the orders list table

**Files:**
- Modify: `app/admin/(dashboard)/orders/page.tsx`

Add `<PrintOrderButton orderId={order.id} />` to the row actions, between the Eye (view) button and the Mark Fulfilled / Delete cluster.

- [ ] **Step 1: Add the import**

Open `app/admin/(dashboard)/orders/page.tsx`. Add this import alongside the existing component imports (after the `DeleteDialog` import):

```tsx
import { PrintOrderButton } from '@/components/admin/print-order-button'
```

- [ ] **Step 2: Add the button to the row actions**

In the same file, locate the `<div className="flex items-center justify-end gap-1">` block inside the actions cell. Insert `<PrintOrderButton />` immediately after the View (Eye) button and before the Mark Fulfilled `<form>`:

```tsx
<div className="flex items-center justify-end gap-1">
  <Button variant="ghost" size="sm" asChild>
    <Link href={`/admin/orders/${order.id}`}>
      <Eye className="size-4" />
    </Link>
  </Button>

  <PrintOrderButton orderId={order.id} />

  {order.status === 'pending' && (
    <form action={markOrderFulfilledAction.bind(null, order.id)}>
      <Button
        variant="ghost"
        size="sm"
        type="submit"
        className="text-green-600 hover:text-green-600"
      >
        <CheckCircle className="size-4" />
      </Button>
    </form>
  )}

  <DeleteDialog
    title="Delete order?"
    description={`This will permanently delete order ${order.orderNumber}. This action cannot be undone.`}
    onConfirm={deleteOrderAction.bind(null, order.id)}
  />
</div>
```

(The unchanged inner contents of the fulfill `<form>` are kept exactly as-is.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually verify**

With the dev server running, open `http://localhost:3000/admin/orders` (logged in as admin).

Expected:
- Each row's actions cell now shows: Eye → Printer → (Mark Fulfilled if pending) → Delete.
- Clicking the Printer icon opens a new tab to `/admin/orders/<id>/print` and triggers the print dialog.
- No JavaScript errors in the browser console.

- [ ] **Step 5: Commit**

```bash
git add app/admin/(dashboard)/orders/page.tsx
git commit -m "feat(admin): add print button to orders list rows"
```

---

## Task 7: Wire the print button into the order detail header

**Files:**
- Modify: `app/admin/(dashboard)/orders/[id]/page.tsx`

Add a labelled print button to the order detail page header, next to the status badge.

- [ ] **Step 1: Add the import**

Open `app/admin/(dashboard)/orders/[id]/page.tsx`. Add this import alongside the existing component imports:

```tsx
import { PrintOrderButton } from '@/components/admin/print-order-button'
```

- [ ] **Step 2: Add the button to the header block**

Locate the existing order header `<div className="flex items-start justify-between">`. Wrap the right-hand status `<Badge>` in a flex row that also contains the print button:

```tsx
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-2xl font-semibold">
      Order {order.orderNumber}
    </h1>
    <p className="text-sm text-muted-foreground mt-1">
      Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </p>
  </div>
  <div className="flex items-center gap-3">
    <PrintOrderButton orderId={order.id} variant="default" />
    <Badge
      variant={order.status === 'fulfilled' ? 'default' : 'secondary'}
      className="text-sm"
    >
      {order.status}
    </Badge>
  </div>
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually verify**

With the dev server running, navigate from `/admin/orders` to a specific order detail page (click the Eye icon).

Expected:
- The header shows "Order <number>" on the left, and a "Print invoice" outline button + status badge on the right.
- Clicking "Print invoice" opens a new tab and fires the print dialog.

- [ ] **Step 5: Commit**

```bash
git add app/admin/(dashboard)/orders/[id]/page.tsx
git commit -m "feat(admin): add print invoice button to order detail header"
```

---

## Task 8: End-to-end manual verification

The feature has no business logic to unit-test; correctness is verified by exercising the UI.

**Files:** none (verification only)

- [ ] **Step 1: Lint and type-check the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors introduced by this feature. Pre-existing warnings unrelated to the print feature are acceptable but should be noted.

- [ ] **Step 2: Walk through the golden path**

With the dev server running and logged in as admin:

1. Navigate to `/admin/orders`.
2. Click the Printer icon on an order row → new tab opens to `/admin/orders/<id>/print`, print dialog fires.
3. In the dialog, choose "Save as PDF" and save to disk. Open the PDF — verify:
   - Top: `DirectMS` wordmark on left, `INVOICE` + order number + date on right.
   - `Bill To` block shows name (and email/phone/address if present).
   - `Status: PENDING` (or `FULFILLED`) on the right; `Fulfilled: <date>` below if applicable.
   - Items table shows all rows with Product, Flavor, Unit Price, Qty, Line Total.
   - `Total: $XX.XX` right-aligned beneath the table.
   - `Notes` block appears only if the order has notes.
   - `Thank you for your business — DirectMS` centered at the bottom.
4. Close the print tab. Navigate back to `/admin/orders` and click the Eye icon on the same order. Click "Print invoice" in the header → same behavior.

- [ ] **Step 3: Verify auth gate**

In a private browser window (not logged in), visit `/admin/orders/<id>/print`.
Expected: redirected to `/admin/login`.

- [ ] **Step 4: Verify the not-found path**

Logged in, visit `/admin/orders/00000000-0000-0000-0000-000000000000/print` (a UUID that doesn't exist).
Expected: standard Next.js 404 page.

- [ ] **Step 5: Verify multi-page printing if any order is long**

If you have an order with many items (or temporarily duplicate items in a test order), confirm in the print preview that:
- The header repeats on each page (because of `thead { display: table-header-group }`).
- Rows do not split across pages mid-cell.

If you don't have a long order, this step is informational only — note in the commit message or PR description that long-order pagination was visually inspected via CSS rules but not exercised with real data.

- [ ] **Step 6: Commit any final fixes (or skip if none)**

If verification surfaced bugs, fix them and commit. Otherwise this step is a no-op.

```bash
git status   # should be clean
```

---

## Done criteria

- All 8 tasks ticked off above.
- `npx tsc --noEmit` passes for the new and modified files.
- `npm run lint` passes (no new errors).
- Manual verification (Task 8) confirms: print button on each list row, print button on detail header, invoice renders correctly, auto-print fires, auth gate works, 404 handled.
- Each task ends with its own commit.
