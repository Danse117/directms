# DirectMS Catalog — Design Spec

**Date:** 2026-04-11
**Status:** Approved (pre-implementation)
**Author:** Planner session

## 1. Overview

DirectMS is a wholesale B2B catalog for disposable pod/vape products. The existing site (`.original_project/`) is vanilla HTML/CSS/JS with a hardcoded product list, a cart rendered in-memory, and two Netlify Forms for order placement and product inquiries.

This project rebuilds the site as a Next.js 16 application with:

- A polished multi-page frontend (catalog / cart / order-success / admin)
- Supabase for product data, orders, inquiries, and admin authentication
- Supabase Storage for product imagery
- Resend for transactional email (customer order receipts, admin inquiry notifications)
- Netlify for hosting
- A protected admin dashboard for managing products, orders, and inquiries

The rebuild is delivered in three phases, each of which ends in a reviewable, verifiable state.

## 2. Stack decisions

| Area | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.3 (App Router, Turbopack) | Already installed. **Breaking changes vs training data** — see §10 |
| React | 19.2 | Bundled with Next 16; includes View Transitions, `useEffectEvent`, Activity |
| Styling | Tailwind v4 + shadcn (`radix-nova` style, already configured) | Preset already in `components.json` |
| Motion | Motion 12 + React 19.2 `<ViewTransition>` | Motion for component-level; View Transitions for page-level |
| State | `zustand` with `persist` middleware (localStorage) | SSR-safe cart that survives navigation and refreshes |
| Forms | `react-hook-form` + `zod` + shadcn `form` | Single schema used for client-side and server-side validation |
| Backend | Supabase (Postgres + Storage + Auth) | One vendor for three concerns |
| DB client | `@supabase/ssr` canonical pattern | Next.js 16 async `cookies()` support |
| Email | Resend + `@react-email/components` | React Email for JSX templates |
| Deploy | Netlify with `@netlify/plugin-nextjs` | Per user spec |
| Icons | `lucide-react` | Default shadcn icon library |

**Not used:**
- No service-role Supabase key anywhere in the app — RLS is the only enforcement surface
- No `middleware.ts` — Next.js 16 renamed this to `proxy.ts` (nodejs runtime only)
- No client-side Supabase calls for reads — Server Components handle all catalog/order/product reads
- No Netlify Forms — replaced by Server Actions calling Resend + Supabase directly

## 3. Architecture & routes

### 3.1 Public routes

| Route | Type | Purpose |
|---|---|---|
| `/` | Server Component | Hero + product grid + inquiry form |
| `/cart` | Server shell + Client island | Cart review + checkout form |
| `/order-success` | Server Component | Post-checkout confirmation (reads `?order=DM-ABCXXX`) |

### 3.2 Admin routes (protected)

| Route | Purpose |
|---|---|
| `/admin/login` | Email + password sign-in form |
| `/admin` | Redirects to `/admin/orders` |
| `/admin/orders` | Orders list |
| `/admin/orders/[id]` | Order detail (expanded line items) |
| `/admin/products` | Products list with visibility toggle |
| `/admin/products/new` | Create product form |
| `/admin/products/[id]` | Edit product form |
| `/admin/inquiries` | Inquiries list |
| `/admin/inquiries/[id]` | Inquiry detail |

### 3.3 Route protection

- `proxy.ts` at the project root matches `/admin/:path*`, refreshes the Supabase session cookie, and redirects to `/admin/login` when unauthenticated
- `app/admin/layout.tsx` additionally calls `supabase.auth.getUser()` and redirects — defense in depth
- Every admin Server Action begins with `const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Unauthorized')`, because Server Actions are reachable via direct POST regardless of UI (per Next.js 16 docs)

### 3.4 Server/Client split

- **Server Components** own all reads (catalog, orders, products, inquiries, admin detail pages)
- **Client Components** own: cart store, checkout form, inquiry form, product card (flavor/qty/add-to-cart), admin forms, image upload preview
- **Server Actions** own all mutations — every mutation action

### 3.5 `proxy.ts` skeleton

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

(`updateSession` is the helper recommended by `@supabase/ssr` that refreshes the session cookie and optionally redirects.)

## 4. Data model

### 4.1 Tables

#### `products`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `slug` | `text` unique not null | URL/storage-friendly identifier |
| `name` | `text` not null | |
| `subtitle` | `text` | e.g., "25 flavor options" |
| `price` | `numeric(10,2)` not null | per-product price, flavor-agnostic |
| `flavors` | `jsonb` not null default `'[]'` | array of strings |
| `image_path` | `text` | Supabase Storage path, e.g., `products/mega-v2.jpg` |
| `is_visible` | `boolean` not null default `true` | admin toggle |
| `sort_order` | `int` not null default `0` | display order on catalog |
| `created_at` | `timestamptz` default `now()` | |
| `updated_at` | `timestamptz` default `now()` | auto-updated via trigger |

Indexes: `slug` (unique), `is_visible, sort_order` (composite for the catalog list query).

#### `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `order_number` | `text` unique not null | human-readable, e.g., `DM-ABC123` |
| `first_name` | `text` not null | |
| `last_name` | `text` not null | |
| `email` | `text` not null | |
| `notes` | `text` | nullable |
| `items` | `jsonb` not null | `[{ product_id, product_name, flavor, quantity, unit_price, line_total }]` — frozen snapshot |
| `subtotal` | `numeric(10,2)` not null | |
| `status` | `text` not null default `'pending'` | check in (`'pending'`, `'fulfilled'`) |
| `created_at` | `timestamptz` default `now()` | |
| `fulfilled_at` | `timestamptz` | nullable |

Indexes: `created_at desc`, `status`.

**Design decision: `items` is JSONB, not a separate `order_line_items` table.** Orders are immutable snapshots — renaming or repricing a product later must not mutate historical orders. JSONB freezes the snapshot and removes the need for JOINs when displaying order history.

#### `inquiries`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | |
| `business_name` | `text` | nullable |
| `email` | `text` not null | |
| `phone` | `text` | nullable |
| `requested_item` | `text` not null | |
| `details` | `text` | nullable |
| `created_at` | `timestamptz` default `now()` | |

Index: `created_at desc`.

### 4.2 Storage

- Single bucket: `product-images`
- **Public read**, authenticated write (via RLS on `storage.objects`)
- Path convention: `products/{slug}.{ext}`
- Next.js `next.config.ts` gets a `remotePatterns` entry for `<project-ref>.supabase.co`

### 4.3 RLS policies

| Table | Anon (public) | Authenticated |
|---|---|---|
| `products` | `SELECT` where `is_visible = true` | `ALL` |
| `orders` | `INSERT` only | `ALL` |
| `inquiries` | `INSERT` only | `ALL` |
| `storage.objects` (bucket `product-images`) | `SELECT` | `INSERT / UPDATE / DELETE` |

### 4.4 Supabase client strategy

```
lib/supabase/
├── server.ts      # createServerClient — Server Components & Server Actions
├── client.ts      # createBrowserClient — rarely used (admin login form if needed)
└── session.ts     # updateSession helper called from proxy.ts
```

> **Naming note:** Supabase's SSR docs traditionally call this third file `middleware.ts`. We're renaming it to `session.ts` to avoid confusion with the Next.js 16 `middleware` → `proxy` concept. The file still exports an `updateSession(request)` helper; only the filename changes.

The service-role key is **never** imported anywhere. All auth-sensitive operations go through the authenticated SSR client.

### 4.5 Auth setup

- Supabase Auth, email + password only
- **No public signup route exists** in the app
- The single admin user is seeded manually in the Supabase dashboard
- Session persisted via Supabase's standard HTTP-only cookies

## 5. Phase 1 — Frontend only

**Goal:** Fully navigable, styled Next.js site with hardcoded products and stubbed form submissions. No Supabase, no Resend. Ends with a clean `next build` and a reviewable visual design.

### 5.1 Pre-work

- Delete create-next-app boilerplate (`app/page.tsx`, `public/*.svg`)
- Configure Inter (or the design skill's recommendation) via `next/font/google`
- Update root metadata in `app/layout.tsx`
- Install runtime dependencies: `npm install zustand react-hook-form @hookform/resolvers zod sonner`
- Install shadcn primitives: `npx shadcn@latest add input textarea label card badge select separator form sonner`

### 5.2 Design process (first thing in Phase 1)

1. Invoke `frontend-design` and/or `ui-ux-pro-max` to generate 2–3 visual options for the catalog page
2. User picks one
3. Apply the chosen palette, typography, spacing system site-wide via `app/globals.css` CSS variables
4. Invoke `web-design-guidelines` for an accessibility/UX audit pass near the end of Phase 1

### 5.3 Seed data

`lib/products.seed.ts` — typed array of 9 products matching the original:

```ts
export type Product = {
  id: string
  slug: string
  name: string
  subtitle: string
  price: number          // placeholder: $25 / $30 / $35 range
  flavors: string[]
  imagePath: string      // /products/{slug}.{ext} during Phase 1
}
```

Images copied from `.original_project/images/{1..9}.{jpg,webp,png}` → `public/products/{slug}.{ext}`, renamed to slug.

### 5.4 Component tree (new files)

```
components/
├── site/
│   ├── header.tsx         (Client — reads cart count from zustand store)
│   ├── footer.tsx         (Server)
│   └── hero.tsx           (Server)
├── products/
│   ├── product-grid.tsx   (Server — receives product array as prop)
│   └── product-card.tsx   (Client — flavor select + qty + add-to-cart)
├── cart/
│   ├── cart-store.ts      (zustand + persist middleware → localStorage key "directms-cart")
│   ├── cart-list.tsx      (Client)
│   ├── cart-item.tsx      (Client)
│   └── checkout-form.tsx  (Client — useActionState)
├── inquiry/
│   └── inquiry-form.tsx   (Client — useActionState)
└── ui/                    (shadcn — add: input, textarea, label, card, badge, select, separator, form, sonner)
```

### 5.5 Server Actions (stubbed)

```
app/actions/
├── place-order.ts   # Zod validates, redirects to /order-success?order=DM-STUB
└── send-inquiry.ts  # Zod validates, returns { ok: true }
```

**Signatures and Zod schemas are identical to Phase 2's real versions.** Client components don't change between Phase 1 and Phase 2 — only the action implementations do.

### 5.6 Cart state schema

```ts
type CartItem = {
  productId: string
  productName: string
  flavor: string
  quantity: number
  unitPrice: number   // captured at add-time, re-fetched server-side before order placement in Phase 2
}
```

Helpers: `addItem`, `removeItem`, `updateQuantity`, `clear`, `count`, `subtotal`.

### 5.7 Motion scope

- Hero text stagger-in on first paint (Motion)
- Product card subtle lift on hover
- Sonner toast for "added to cart" (shadcn default)
- Cart item add/remove layout animations (Motion `LayoutGroup`)
- Catalog ↔ cart page transition via React 19.2 `<ViewTransition>` with a Motion fallback if transitions look janky

### 5.8 Phase 1 — definition of done

- `npm run dev` boots cleanly
- Full walk-through: catalog → pick flavor → add to cart → `/cart` → fill checkout → redirects to `/order-success`
- Inquiry form submits and shows success
- Cart survives refresh
- `npm run build` passes
- `npm run lint` passes
- Design reviewed via `web-design-guidelines` skill
- `verification-before-completion` skill run before marking Phase 1 complete

## 6. Phase 2 — Supabase + Resend

**Goal:** Replace stubs with real backend. At the end of Phase 2, the public site is fully live and can accept real orders — admin dashboard doesn't exist yet.

### 6.1 Dependencies

```
npm install @supabase/supabase-js @supabase/ssr resend @react-email/components
```
(`zod`, `react-hook-form` presumed added in Phase 1)

### 6.2 Environment variables

`.env.local` (and `.env.example` committed):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=        # verified domain
ADMIN_NOTIFICATION_EMAIL= # where inquiry notifications go
NEXT_PUBLIC_SITE_URL=     # used in email templates
```

### 6.3 Supabase project setup

Executed either via the Supabase MCP authenticate tool (if available in the implementation session) or manually by the user. **Order matters** — images must be uploaded before the seed migration runs, because the seed references real storage paths:

1. Create Supabase project
2. Apply the schema-only migrations (SQL reviewed by `supabase-postgres-best-practices` skill before running):
   - `001_products.sql` — table, indexes, RLS
   - `002_orders.sql` — table, indexes, RLS
   - `003_inquiries.sql` — table, indexes, RLS
   - `004_storage_bucket.sql` — bucket creation + storage RLS
   - `005_updated_at_trigger.sql` — shared trigger attached to `products`
3. Run the one-off image upload script (`scripts/upload-product-images.ts`): reads `public/products/*`, uploads each file to the `product-images` bucket, and prints the resulting storage paths
4. Apply the seed migration `006_seed_products.sql` — inserts the 9 products with real prices (replacing Phase 1 placeholders) and the storage paths from step 3
5. Delete `public/products/` from the repo (images are now served from Supabase Storage)
6. Seed the admin user in the Supabase Auth dashboard (manual step, one-time)

### 6.4 Supabase client files

```
lib/supabase/
├── server.ts   # createServerClient(url, key, { cookies: { getAll, setAll } })
├── client.ts   # createBrowserClient
└── session.ts  # updateSession helper used by proxy.ts
```

All use the canonical `@supabase/ssr` pattern adapted for Next.js 16's async `cookies()` API. Filename `session.ts` is chosen deliberately to avoid collision with the `middleware` → `proxy` rename in Next.js 16 (see §4.4).

### 6.5 Data access layer

```
lib/data/
├── products.ts    # getVisibleProducts, getProductById, getAllProducts, createProduct, updateProduct, deleteProduct, toggleVisibility
├── orders.ts      # createOrder, getOrders, getOrderById, markFulfilled, deleteOrder
└── inquiries.ts   # createInquiry, getInquiries, getInquiryById, deleteInquiry
```

Phase 2 uses only the public subset: `getVisibleProducts`, `createOrder`, `createInquiry`. Admin-side helpers are written in Phase 2 but consumed in Phase 3.

### 6.6 Frontend swap

- `app/page.tsx` swaps `import { products } from '@/lib/products.seed'` for `const products = await getVisibleProducts()`
- `ProductCard` component signature is unchanged (takes same `Product` prop)
- Cart page unchanged (still localStorage)
- Delete `lib/products.seed.ts`
- `next.config.ts` gains `images.remotePatterns` for the Supabase Storage hostname

### 6.7 Email templates

```
lib/email/
├── resend.ts                             # shared client
└── templates/
    ├── order-receipt.tsx                 # to customer: greeting, order number, line items, subtotal, notes
    └── inquiry-notification.tsx          # to ADMIN_NOTIFICATION_EMAIL: item, customer info, details
```

Templates use `@react-email/components`. `react-email dev` runs in the background during Phase 2 for browser previews.

### 6.8 Real Server Actions

#### `placeOrder`

1. Zod-validate `{ firstName, lastName, email, notes, items: [{ productId, flavor, quantity }] }`
2. **Re-fetch each `productId` from the DB** — never trust prices from the client
3. Build the `items` JSONB snapshot from the server-computed values
4. Compute `subtotal` server-side
5. Generate `order_number` (short base36 random, e.g., `DM-ABCXYZ`)
6. `INSERT` into `orders`
7. Send the Resend customer-receipt email
   - On email failure: log + continue; do not fail the order (the row is already persisted)
8. Return `{ ok: true, orderNumber }` → client clears the zustand store, then `router.push('/order-success?order=DM-ABCXYZ')`

#### `sendInquiry`

1. Zod-validate
2. `INSERT` into `inquiries`
3. Send the Resend admin-notification email
4. Return `{ ok: true }`

### 6.9 Phase 2 — definition of done

- Catalog loads from Supabase
- `placeOrder` writes an `orders` row and sends a real customer email
- `sendInquiry` writes an `inquiries` row and sends a real admin email
- Invalid inputs return field-level errors via `useActionState`
- Full end-to-end smoke test via `verification-before-completion` skill
- `npm run build` passes

## 7. Phase 3 — Admin dashboard + deploy

**Goal:** Protected admin area with full CRUD on products, orders, and inquiries. First production deploy to Netlify.

### 7.1 `proxy.ts` + auth plumbing

- `proxy.ts` at project root, matches `/admin/:path*`
- Calls `updateSession(request)` from `lib/supabase/session.ts`
- Redirects unauthenticated requests (except `/admin/login`) to `/admin/login`
- Redirects authenticated requests from `/admin/login` to `/admin`
- Runtime: `nodejs` (default in Next.js 16 `proxy.ts`; edge not supported)

### 7.2 Admin layout

`app/admin/layout.tsx`:
- Async Server Component calling `supabase.auth.getUser()`
- Redirects to `/admin/login` on no-user (defense in depth)
- Sidebar with links: Orders / Products / Inquiries
- Top bar: admin email + logout button
- Wrapped around all `/admin/*` pages

### 7.3 Admin pages

| Route | Data source | UI |
|---|---|---|
| `/admin/orders` | `getOrders()` | Table: order #, customer, email, subtotal, status, date; row actions: view, mark fulfilled, delete |
| `/admin/orders/[id]` | `getOrderById(id)` | Detail view — expanded `items` JSONB as a sub-table |
| `/admin/products` | `getAllProducts()` | Table: image thumb, name, price, flavors count, is_visible toggle, row actions (edit, delete) |
| `/admin/products/new` | — | Form: name, slug, subtitle, price, flavors (tag input), image upload, is_visible |
| `/admin/products/[id]` | `getProductById(id)` | Same form, pre-filled; supports image replacement |
| `/admin/inquiries` | `getInquiries()` | Table: name, business, email, requested item, date; row actions: view, delete |
| `/admin/inquiries/[id]` | `getInquiryById(id)` | Detail view |

### 7.4 Admin Server Actions

Every action begins with an auth check: `const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Unauthorized')`.

- `signIn(formData)` — Zod validate → `signInWithPassword` → `redirect('/admin')`
- `signOut()` — `signOut` → `redirect('/admin/login')`
- `createProduct(formData)` — validate, upload image to Storage, insert row, `revalidatePath('/admin/products')` + `revalidatePath('/')`
- `updateProduct(id, formData)` — validate, replace image if new one provided (delete old first), update row, revalidate
- `deleteProduct(id)` — delete image from storage, delete row, revalidate
- `toggleProductVisibility(id)` — flip `is_visible`, revalidate
- `markOrderFulfilled(id)` — set status + `fulfilled_at`, revalidate
- `deleteOrder(id)` — delete row, revalidate
- `deleteInquiry(id)` — delete row, revalidate

### 7.5 Image upload UX

- Client Component with `<input type="file" accept="image/*">` and a live preview via `URL.createObjectURL`
- Submits multipart FormData to the Server Action
- Server Action extracts via `formData.get('image') as File`, uploads to Storage using the authenticated SSR client (RLS allows writes for authenticated users)

### 7.6 New shadcn primitives

`table`, `form`, `dialog`, `alert-dialog`, `dropdown-menu`, `switch`, `sheet`, `skeleton`, `tabs`.

### 7.7 Deployment (end of Phase 3)

Driven by the `netlify-deploy` skill:

1. Link repo: `npx netlify init` (user must run — interactive)
2. Install `@netlify/plugin-nextjs` if not auto-detected
3. Mirror every env var from `.env.local` into the Netlify site settings
4. `npx netlify deploy --build` → draft deploy → smoke-test
5. `npx netlify deploy --prod` once draft is green
6. Verify: cold-start auth works in production, Supabase Storage images serve correctly, Resend emails deliver from the production site
7. Domain configuration (user task — requires DNS)

### 7.8 Phase 3 — definition of done

- Admin login works
- All CRUD operations work (products, orders, inquiries)
- Unauth requests to `/admin/*` redirect to `/admin/login`
- Product visibility toggle reflects immediately on the public catalog
- Image upload/replace works end-to-end
- Production deploy is live and all happy paths verified

## 8. Cross-cutting concerns

### 8.1 Error handling

| Layer | Strategy |
|---|---|
| Server Action validation failures | Return `{ ok: false, errors }` → surfaced by `useActionState` → field-level errors in the form |
| Server Action unexpected throws | Caught at the action boundary, logged, generic error returned, client shows a toast |
| Email send failures | Logged but do not fail the order. Data integrity > email delivery. Admin can resend later |
| Image upload failures | Inline error on the form; other form fields preserved in memory |

### 8.2 Security

- **Client-supplied prices are never trusted.** `placeOrder` re-fetches every `productId` from the DB and computes totals server-side
- Every admin Server Action begins with an auth check (Server Actions reachable via direct POST per Next.js 16 docs)
- CSRF is handled automatically by Next.js Server Actions
- RLS is the only enforcement surface — no service-role key in the app
- `NEXT_PUBLIC_` prefix only on `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Admin routes get `robots: noindex` via route metadata
- Spam control for public actions: lightweight honeypot field on `placeOrder` and `sendInquiry`. Real rate limiting (Upstash/Vercel KV) is out of scope for the MVP

### 8.3 Testing approach

- **Manual smoke tests** at each phase boundary (detailed in each phase's definition of done)
- **No unit tests for UI components** — low value, high maintenance
- **Zod schemas** may get light `.safeParse()` tests to lock in validation behavior
- **`verification-before-completion` skill** run before each phase is marked complete
- **Playwright E2E is out of scope** for this MVP. If the user wants E2E coverage, we'll add a happy-path pass (checkout, inquiry, admin login) in a follow-up phase
- **TDD skill exception:** pure visual/UI work does not get tests. Correctness-critical code (Server Actions, price math, auth guards) is verified manually + by code review

### 8.4 Accessibility

- Semantic HTML throughout
- Every input has a `<label>`
- Focus rings preserved (not reset)
- Keyboard navigation verified in the admin dashboard
- Color contrast validated by `web-design-guidelines` skill on the chosen palette before Phase 1 ships

### 8.5 SEO / metadata

- Root metadata in `app/layout.tsx`: title, description, og tags, twitter card
- Catalog renders server-side, so products are crawlable
- All `/admin/*` routes export `robots: noindex`

### 8.6 Environment variable management

- `.env.local` gitignored (empty currently)
- `.env.example` committed with all keys and empty values
- Netlify env vars mirror `.env.local` (set during Phase 3 deploy)

### 8.7 Phase boundary discipline

- Each phase gets its own implementation plan, generated from this spec by the `writing-plans` skill
- Feature branches per phase: `phase-1-frontend`, `phase-2-supabase-resend`, `phase-3-admin-deploy`
- Review via `requesting-code-review` skill at the end of each phase
- Phase N+1 does not start until Phase N passes its smoke test

## 9. Open questions / future work

The following are **out of scope** for this spec but could be added later:

- Real rate limiting on public Server Actions (Upstash, Vercel KV, etc.)
- Playwright E2E test suite
- Inventory tracking (stock counts per product)
- Per-flavor pricing (currently per-product only)
- Multi-admin support (currently single hardcoded admin)
- Customer accounts and order history (currently anonymous checkout)
- Product categories / filtering / search
- Cart abandoned-checkout emails
- Internationalization
- Analytics integration

## 10. Next.js 16 pitfalls to watch for

Per `AGENTS.md`, Next.js 16 has breaking changes vs training data. The design accounts for:

- **Async request APIs** — `cookies()`, `headers()`, `params`, `searchParams` are all Promises. Every call must be `await`ed
- **`middleware.ts` → `proxy.ts`** — renamed, and the function export is `proxy` (not `middleware`). Only the nodejs runtime is supported; no `edge`
- **Server Actions reachable via direct POST** — auth must be verified inside every action, not just at the UI layer
- **Turbopack is default** for `next dev` and `next build` — no `--turbopack` flag needed; custom webpack configs will fail the build
- **`revalidateTag` requires a cacheLife profile** as the second argument; single-argument form is deprecated
- **`refresh()` from `next/cache`** is the new way to refresh the client router from a Server Action
- **`next typegen`** generates `PageProps<'/path'>`, `LayoutProps<'/path'>`, `RouteContext<'/path'>` helpers — use these instead of hand-rolled types
- **React 19.2** features available: View Transitions, `useEffectEvent`, Activity

The implementation session for each phase must read the relevant doc in `node_modules/next/dist/docs/` before writing any Next.js-specific code.
