# DirectMS Phase 2 — Supabase + Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Phase 1 stub with a real Supabase + Resend backend so the public site can accept live orders and inquiries. End state: catalog reads from Supabase, `placeOrder` writes a real `orders` row and emails the customer, `sendInquiry` writes a real `inquiries` row and notifies the shop owner, and Phase 1's hardcoded seed file is deleted.

**Architecture:** Server Components own all reads via a `lib/data/*` access layer that wraps `@supabase/ssr`'s server client. Server Actions in `app/actions/*` own all mutations — they re-fetch products from the DB so the client cannot tamper with prices, build the immutable JSONB items snapshot server-side, insert the row, and dispatch a Resend email. RLS is the only enforcement surface; the service-role key is **never** imported. Vitest covers Zod schemas, the data access layer (with a hand-rolled chainable Supabase mock), the email helpers (with a mocked Resend client), and the Server Actions (with mocked data + email layers).

**Tech Stack:** Next.js 16.2.3 (App Router, Turbopack default), React 19.2, TypeScript 5, Supabase (Postgres + Auth) via `@supabase/ssr` and `@supabase/supabase-js`, Resend + `@react-email/components` for transactional email, Zod for schemas, Vitest 3 + `vite-tsconfig-paths` for tests.

---

## Important context for implementers

**Next.js 16 is NOT the Next.js you know.** Before writing any Next.js-specific code, read the relevant files in `node_modules/next/dist/docs/01-app/` (per `AGENTS.md`). The pieces of the docs that matter most for Phase 2:

- `01-getting-started/06-fetching-data.md` — Server Component data fetching with an ORM/client
- `02-guides/caching-without-cache-components.md` — Phase 2 does NOT enable Cache Components, so we live in the "previous model" by default. Reads via the Supabase server client opt routes into dynamic rendering automatically because they read cookies via `await cookies()`
- `03-api-reference/04-functions/cookies.md` — `cookies()` is async; the Supabase SSR helpers must `await cookies()` and call `getAll`/`setAll`
- `03-api-reference/03-file-conventions/proxy.md` — Phase 2 does **not** add `proxy.ts` (that's Phase 3). The `lib/supabase/session.ts` helper IS scaffolded in Phase 2 because §6.4 of the spec lists it under Phase 2 — it just has no caller until Phase 3 imports it from `proxy.ts`

**Architectural invariants from CLAUDE.md (non-negotiable):**

1. **Server Components own all reads.** Never call Supabase from a Client Component for read operations.
2. **Server Actions own all mutations.** No custom REST routes. Every mutation goes through `app/actions/*.ts`.
3. **Client-supplied prices are never trusted.** `placeOrder` re-fetches every `productId` from Supabase and recomputes `unit_price`, `line_total`, and `subtotal` server-side. The client sends `{ productId, flavor, quantity }` only.
4. **RLS is the only enforcement surface.** The service-role key is **never** imported anywhere in the app, not even in `.env.example`. All operations use the anon key + the cookie-aware SSR client.
5. **Orders are immutable JSONB snapshots.** The `orders.items` JSONB column is frozen at insert time — renaming or repricing a product later must never mutate historical orders.
6. **Supabase SSR helper lives at `lib/supabase/session.ts`** (not `middleware.ts`) to avoid filename collision with Next.js 16's `proxy.ts` concept.
7. **Async request APIs.** `cookies()`, `headers()`, `params`, `searchParams` are all Promises in Next.js 16 — every call must be `await`ed.

**Test strategy for Phase 2 — TDD is back on.** The Phase 1 UI-only exemption (spec §8.3) does NOT apply to backend work. Every task that touches a Zod schema, a data access function, an email helper, or a Server Action follows red → green → refactor → commit. Verification mechanisms by layer:

| Layer | Mechanism |
|---|---|
| Zod schemas | `safeParse` round-trip tests |
| Data access (`lib/data/*`) | Vitest with a hand-rolled chainable Supabase mock injected via `vi.mock('@/lib/supabase/server')` |
| Email helpers (`lib/email/*`) | Vitest with `vi.mock('resend')` capturing the call args; React Email rendering is left to integration |
| Server Actions (`app/actions/*`) | Vitest with `vi.mock('@/lib/data/*')` and `vi.mock('@/lib/email/*')` so the action is exercised in isolation |
| End-to-end (Supabase + Resend live) | Manual smoke walk-through at Task 18 (definition-of-done) |

**No mocks at the database boundary in production code.** Mocks only live in tests. The data layer always talks to a real `createServerClient` in non-test paths. Mocking strategy described above replaces the *imported module* during the test, not the runtime code.

**Honeypot spam control.** Per spec §8.2, both public Server Actions get a hidden honeypot field in their forms (`name="website"`). The action checks `formData.get('website')` *before* Zod parsing — if non-empty, it returns `{ ok: true }` without writing or emailing. This is invisible to humans but trips most form-bots. Real rate limiting (Upstash, Vercel KV) is explicitly out of scope.

**Order number generation.** Use `crypto.randomBytes(3).toString('hex').toUpperCase()` for 6-character entropy (`DM-XXXXXX`). No retry loop — if a unique-constraint violation surfaces (probability ~1 in 16M per insert), the action throws and the customer can resubmit. Don't over-engineer.

**Environment variables.** `.env.local` is gitignored already (`.env*` is in `.gitignore`). Phase 2 creates `.env.example` with empty values for every required key. The service-role key is **never** added to either file.

**Commit cadence.** Each task ends with a commit. Do not batch commits across tasks — one task, one commit, small reviewable increments.

**Do NOT invent files or features not specified in this plan.** If a task's steps don't cover something you think is needed, stop and ask before adding it. YAGNI.

---

## Data foundation

### Postgres schema (final, after all migrations applied)

```
products
├── id              uuid PK default gen_random_uuid()
├── slug            text unique not null
├── name            text not null
├── subtitle        text
├── price           numeric(10,2) not null check (price >= 0)
├── flavors         jsonb not null default '[]'::jsonb
├── image_path      text
├── is_visible      boolean not null default true
├── sort_order      int not null default 0
├── created_at      timestamptz not null default now()
└── updated_at      timestamptz not null default now()   -- maintained by trigger

orders
├── id              uuid PK default gen_random_uuid()
├── order_number    text unique not null
├── first_name      text not null
├── last_name       text not null
├── email           text not null
├── notes           text
├── items           jsonb not null   -- frozen snapshot, see shape below
├── subtotal        numeric(10,2) not null check (subtotal >= 0)
├── status          text not null default 'pending' check (status in ('pending','fulfilled'))
├── created_at      timestamptz not null default now()
└── fulfilled_at    timestamptz

inquiries
├── id              uuid PK default gen_random_uuid()
├── name            text not null
├── business_name   text
├── email           text not null
├── phone           text
├── requested_item  text not null
├── details         text
└── created_at      timestamptz not null default now()
```

**`orders.items` JSONB shape (snake_case to match the column convention — frozen at insert time):**

```json
[
  {
    "product_id": "uuid string",
    "product_name": "Mega V2 — 10 Packs",
    "flavor": "red bull",
    "quantity": 2,
    "unit_price": 35.00,
    "line_total": 70.00
  }
]
```

### Indexes

| Table | Index | Columns |
|---|---|---|
| `products` | `products_slug_key` | `slug` (unique, auto-created by `unique` constraint) |
| `products` | `products_visible_sort_idx` | `(is_visible, sort_order)` for the catalog list query |
| `orders` | `orders_order_number_key` | `order_number` (unique, auto) |
| `orders` | `orders_created_at_idx` | `created_at desc` for admin order list |
| `orders` | `orders_status_idx` | `status` for status-filtered queries |
| `inquiries` | `inquiries_created_at_idx` | `created_at desc` for admin inquiries list |

### RLS policies (full matrix)

| Table | Anon role | Authenticated role |
|---|---|---|
| `products` | `SELECT` `WHERE is_visible = true` | `ALL` |
| `orders` | `INSERT` only (no SELECT) | `ALL` |
| `inquiries` | `INSERT` only (no SELECT) | `ALL` |

> **Why anon `INSERT` only on `orders`/`inquiries`:** the public site is anonymous and we don't want anyone to read others' orders. The Server Action runs as the same anon role (it's anonymous Postgres-side until Phase 3 layers in admin auth). It can `INSERT` the row but cannot `SELECT` it back, so the action returns the order number from the `RETURNING` clause of the insert itself, not via a follow-up read. Verify this round-trip in the data layer test.

### TypeScript ↔ Postgres conventions

- **Database side:** `snake_case` everywhere (column names, JSONB keys).
- **TypeScript side:** `camelCase` everywhere (prop names, function names).
- **Conversion happens at the data access layer boundary** (`lib/data/*`) — every helper translates the row from snake_case → camelCase before returning, and accepts camelCase input which it translates back. The rest of the app stays camelCase-only.

### `Product` type (Phase 2 — replaces the Phase 1 `lib/products.seed.ts` type)

```ts
// lib/data/products.ts
export type Product = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  flavors: string[]
  imagePath: string | null  // local /products/<slug>.<ext> path, or null
}
```

> **No field rename from Phase 1.** The field stays `imagePath` and stores the same local paths (e.g., `/products/mega-v2-10-packs.jpg`). The data layer returns `row.image_path` verbatim. Phase 3 admin may later switch to Supabase Storage URLs — the field is semantically "image src for the product card" regardless of whether it's local or remote. ProductCard and ProductGrid only need their import path updated.

### `Order` types (snake_case `OrderItemSnapshot` matches the JSONB column)

```ts
// lib/data/orders.ts
export type OrderItemSnapshot = {
  product_id: string
  product_name: string
  flavor: string
  quantity: number
  unit_price: number
  line_total: number
}

export type Order = {
  id: string
  orderNumber: string
  firstName: string
  lastName: string
  email: string
  notes: string | null
  items: OrderItemSnapshot[]
  subtotal: number
  status: 'pending' | 'fulfilled'
  createdAt: string         // ISO datetime returned by Postgres
  fulfilledAt: string | null
}
```

> **Why is `OrderItemSnapshot` snake_case in TypeScript?** Because it lives in the JSONB column. Mapping it back to camelCase would require translating on every read AND every write; mismatched field names between code and DB would silently break the next migration. Treat the snapshot as a frozen DB-shape document.

### `Inquiry` type

```ts
// lib/data/inquiries.ts
export type Inquiry = {
  id: string
  name: string
  businessName: string | null
  email: string
  phone: string | null
  requestedItem: string
  details: string | null
  createdAt: string
}
```

### Test mock pattern for Supabase data layer

The Supabase JS client has a fluent chainable API. Tests inject a hand-rolled fake via `vi.mock('@/lib/supabase/server')`. The fake accepts a script of expected calls and returns the configured response from the terminal `await`. A minimal helper lives at `tests/helpers/supabase-mock.ts`:

```ts
// tests/helpers/supabase-mock.ts
import { vi } from 'vitest'

type MockResult<T> = { data: T; error: null } | { data: null; error: { message: string } }

export type ChainStep = { method: string; args: unknown[] }

/**
 * Build a fake Supabase query builder that records every chained call
 * and resolves to a configured terminal result. The terminal happens
 * when the consumer awaits the chain (queries are thenables).
 */
export function buildQueryBuilder<T>(result: MockResult<T>) {
  const calls: ChainStep[] = []
  const builder: Record<string, unknown> = {}
  const chainable = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']
  for (const method of chainable) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    })
  }
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Make the whole builder thenable so `await builder.from(...).select(...)` resolves
  builder.then = (resolve: (value: MockResult<T>) => void) => resolve(result)
  return { builder, calls }
}

export function buildSupabaseMock<T>(result: MockResult<T>) {
  const { builder, calls } = buildQueryBuilder(result)
  const client = {
    from: vi.fn(() => builder),
  }
  return { client, calls }
}
```

Tests use it like this:

```ts
import { vi } from 'vitest'
import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')

it('returns visible products', async () => {
  const { client, calls } = buildSupabaseMock({ data: [{ id: '1', slug: 'a', /* ... */ }], error: null })
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

  const { getVisibleProducts } = await import('@/lib/data/products')
  const result = await getVisibleProducts()

  expect(calls).toEqual([
    { method: 'select', args: ['*'] },
    { method: 'eq', args: ['is_visible', true] },
    { method: 'order', args: ['sort_order', { ascending: true }] },
  ])
  expect(result[0].imagePath).toBe('/products/mega-v2-10-packs.jpg')
})
```

Memorize this pattern — every data-layer test follows it.

---

## File structure

### New files (created in Phase 2)

```
.env.example                                    # All env vars with empty values, committed

lib/
├── env.ts                                      # Zod-validated env access (server-only)
├── supabase/
│   ├── server.ts                               # createServerSupabaseClient (await cookies + getAll/setAll)
│   ├── client.ts                               # createBrowserSupabaseClient (browser, rarely used)
│   └── session.ts                              # updateSession helper for Phase 3 proxy.ts
├── data/
│   ├── products.ts                             # getVisibleProducts, getProductsByIds, + admin helpers
│   ├── products.test.ts
│   ├── orders.ts                               # createOrder + admin helpers
│   ├── orders.test.ts
│   ├── inquiries.ts                            # createInquiry + admin helpers
│   └── inquiries.test.ts
└── email/
    ├── resend.ts                               # Lazy singleton Resend client
    ├── send-order-receipt.ts                   # Caller for the order-receipt template
    ├── send-order-receipt.test.ts
    ├── send-inquiry-notification.ts            # Caller for the inquiry-notification template
    ├── send-inquiry-notification.test.ts
    └── templates/
        ├── order-receipt.tsx                   # @react-email/components JSX
        └── inquiry-notification.tsx

app/actions/
├── place-order.test.ts                         # Tests written before T15 swaps the impl
└── send-inquiry.test.ts                        # Tests written before T16 swaps the impl

supabase/
└── migrations/
    ├── 001_products.sql                        # table + indexes + RLS
    ├── 002_orders.sql                          # table + indexes + RLS
    ├── 003_inquiries.sql                       # table + indexes + RLS
    ├── 004_updated_at_trigger.sql              # shared trigger applied to products
    └── 005_seed_products.sql                   # 9 seed rows w/ placeholder prices + local image paths

tests/
└── helpers/
    └── supabase-mock.ts                        # Hand-rolled chainable Supabase mock builder

vitest.config.ts                                # Vitest + vite-tsconfig-paths
```

### Files modified in Phase 2

```
package.json                                    # backend deps + vitest dev deps + npm scripts
.gitignore                                      # already covers .env*, no change expected
app/page.tsx                                    # swap seed import → await getVisibleProducts()
app/actions/place-order.ts                      # real impl (re-fetch, compute, insert, email, honeypot)
app/actions/send-inquiry.ts                     # real impl (insert, email, honeypot)
components/products/product-card.tsx            # type import path (+ null-safe subtitle)
components/products/product-grid.tsx            # type import path
components/cart/checkout-form.tsx               # honeypot field + react to ok+orderNumber return
components/inquiry/inquiry-form.tsx             # honeypot field
CLAUDE.md                                       # mark Phase 2 complete in delivery phases table
```

### Files deleted in Phase 2

```
lib/products.seed.ts                            # superseded by lib/data/products.ts
```

---

## Task 1: Install backend runtime dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)

- [ ] **Step 1: Install Supabase + Resend + React Email**

  ```bash
  npm install @supabase/supabase-js @supabase/ssr resend @react-email/components
  ```

  Expected output: `package.json` `dependencies` gains `@supabase/supabase-js`, `@supabase/ssr`, `resend`, `@react-email/components`.

- [ ] **Step 2: Verify the install resolved cleanly**

  ```bash
  npx next lint
  ```

  Expected: passes (no new code yet — this just confirms TypeScript module resolution is intact).

- [ ] **Step 3: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "chore(phase-2): install supabase, resend, react-email"
  ```

---

## Task 2: Install Vitest and configure it

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test`, `test:run`, `test:watch` scripts)

- [ ] **Step 1: Install vitest, the path-alias plugin, and the React Email render helper**

  ```bash
  npm install -D vitest @vitest/ui vite-tsconfig-paths @testing-library/jest-dom @types/node
  ```

  Expected: `devDependencies` gains `vitest`, `@vitest/ui`, `vite-tsconfig-paths`, `@testing-library/jest-dom`. (`@types/node` is likely already present — npm will be a no-op if so.)

- [ ] **Step 2: Create `vitest.config.ts`**

  ```ts
  // vitest.config.ts
  import { defineConfig } from 'vitest/config'
  import tsconfigPaths from 'vite-tsconfig-paths'

  export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
      environment: 'node',
      globals: false,
      include: ['**/*.test.ts', '**/*.test.tsx'],
      exclude: ['node_modules', '.next', '.original_project'],
      setupFiles: [],
      pool: 'forks', // forks isolate React Email rendering side-effects
    },
  })
  ```

- [ ] **Step 3: Add npm scripts**

  Edit `package.json` `scripts` block to add:

  ```json
  {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "eslint",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:ui": "vitest --ui"
    }
  }
  ```

- [ ] **Step 4: Smoke-test the runner with a trivial passing test**

  Create `vitest.smoke.test.ts` at the project root:

  ```ts
  // vitest.smoke.test.ts
  import { describe, it, expect } from 'vitest'

  describe('vitest smoke test', () => {
    it('runs', () => {
      expect(1 + 1).toBe(2)
    })
  })
  ```

  Run:

  ```bash
  npm test
  ```

  Expected: 1 passed test. Then delete the smoke file:

  ```bash
  rm vitest.smoke.test.ts
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add vitest.config.ts package.json package-lock.json
  git commit -m "chore(phase-2): add vitest with vite-tsconfig-paths"
  ```

---

## Task 3: Centralized env access + `.env.example`

**Files:**
- Create: `.env.example`
- Create: `lib/env.ts`
- Create: `lib/env.test.ts`

- [ ] **Step 1: Create `.env.example`**

  ```
  # Supabase — both keys are public-by-design (anon key is RLS-gated)
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=

  # Resend transactional email
  RESEND_API_KEY=
  RESEND_FROM_EMAIL=
  ADMIN_NOTIFICATION_EMAIL=

  # Public site URL — used inside email templates for "view your order" links
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```

  > **CRITICAL:** Do NOT add `SUPABASE_SERVICE_ROLE_KEY`. It is intentionally absent. The service-role key is never imported anywhere in this app — RLS is the only enforcement surface.

- [ ] **Step 2: Write the failing test for `lib/env.ts`**

  Create `lib/env.test.ts`:

  ```ts
  // lib/env.test.ts
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

  describe('serverEnv', () => {
    const ORIGINAL_ENV = process.env

    beforeEach(() => {
      vi.resetModules()
      process.env = { ...ORIGINAL_ENV }
    })

    afterEach(() => {
      process.env = ORIGINAL_ENV
    })

    it('returns all required vars when present', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
      process.env.RESEND_API_KEY = 're_test'
      process.env.RESEND_FROM_EMAIL = 'shop@example.com'
      process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.com'
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

      const { serverEnv } = await import('./env')
      const env = serverEnv()
      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co')
      expect(env.RESEND_API_KEY).toBe('re_test')
      expect(env.ADMIN_NOTIFICATION_EMAIL).toBe('admin@example.com')
    })

    it('throws a descriptive error when a required var is missing', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
      // RESEND_API_KEY intentionally missing
      delete process.env.RESEND_API_KEY
      process.env.RESEND_FROM_EMAIL = 'shop@example.com'
      process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.com'
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

      const { serverEnv } = await import('./env')
      expect(() => serverEnv()).toThrow(/RESEND_API_KEY/)
    })
  })
  ```

- [ ] **Step 3: Run test to confirm it fails**

  ```bash
  npm test -- lib/env.test.ts
  ```

  Expected: FAIL with `Cannot find module './env'`.

- [ ] **Step 4: Implement `lib/env.ts`**

  ```ts
  // lib/env.ts
  import { z } from 'zod'

  /**
   * Server-side environment access with Zod validation.
   *
   * Why it's a function (not a top-level constant): top-level evaluation
   * happens at import time, which fights vitest's `process.env` mutation
   * pattern and Next.js's static analysis. Calling this from the request
   * path (Server Components, Server Actions) is cheap.
   *
   * Never import this from a Client Component — it will leak server-only
   * keys into the client bundle.
   */
  const serverEnvSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email(),
    ADMIN_NOTIFICATION_EMAIL: z.string().email(),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
  })

  export type ServerEnv = z.infer<typeof serverEnvSchema>

  export function serverEnv(): ServerEnv {
    const result = serverEnvSchema.safeParse(process.env)
    if (!result.success) {
      const missing = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      throw new Error(`Invalid environment configuration: ${missing}`)
    }
    return result.data
  }

  /**
   * Public env subset, safe to access from Client Components. Only contains
   * keys with the NEXT_PUBLIC_ prefix.
   */
  export function publicEnv() {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
    }
  }
  ```

- [ ] **Step 5: Run test to verify it passes**

  ```bash
  npm test -- lib/env.test.ts
  ```

  Expected: 2 passed.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/env.ts lib/env.test.ts .env.example
  git commit -m "feat(phase-2): add zod-validated env access + .env.example"
  ```

---

## Task 4: Supabase client wrappers (`server.ts`, `client.ts`, `session.ts`)

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/session.ts`

> **No unit tests for these wrappers.** They're thin configuration around `@supabase/ssr` factories — there's nothing meaningful to assert that isn't already enforced by the type system. Coverage comes from the data layer tests in Tasks 9-11, which mock these modules wholesale.

- [ ] **Step 1: Create `lib/supabase/server.ts`**

  ```ts
  // lib/supabase/server.ts
  import { createServerClient } from '@supabase/ssr'
  import { cookies } from 'next/headers'
  import { serverEnv } from '@/lib/env'

  /**
   * Cookie-aware Supabase client for Server Components and Server Actions.
   *
   * Per Next.js 16, `cookies()` is async — every call must be awaited.
   * The `setAll` callback is allowed to throw inside Server Components
   * because cookies cannot be set during streaming render; it succeeds
   * inside Server Actions and Route Handlers, which is where we actually
   * need to write cookies (Phase 3 admin auth).
   */
  export async function createServerSupabaseClient() {
    const env = serverEnv()
    const cookieStore = await cookies()

    return createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options)
              }
            } catch {
              // Called from a Server Component; ignore.
              // The matching call will succeed inside the Server Action
              // or proxy.ts that triggered the auth refresh.
            }
          },
        },
      }
    )
  }
  ```

- [ ] **Step 2: Create `lib/supabase/client.ts`**

  ```ts
  // lib/supabase/client.ts
  import { createBrowserClient } from '@supabase/ssr'
  import { publicEnv } from '@/lib/env'

  /**
   * Browser-side Supabase client. Phase 2 does not call this — Phase 3's
   * admin login form is the first consumer. It's scaffolded here per
   * spec §6.4 so the wrapper trio is complete.
   */
  export function createBrowserSupabaseClient() {
    const env = publicEnv()
    return createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  ```

- [ ] **Step 3: Create `lib/supabase/session.ts`**

  ```ts
  // lib/supabase/session.ts
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'
  import { serverEnv } from '@/lib/env'

  /**
   * Refresh the Supabase session cookie on every matched request.
   * Called from `proxy.ts` in Phase 3. Phase 2 has no caller — the file
   * is scaffolded per spec §6.4.
   *
   * The filename is `session.ts` (not `middleware.ts`) to avoid colliding
   * with Next.js 16's `proxy.ts` rename — having two "middleware" concepts
   * in the same project is a footgun.
   */
  export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request })
    const env = serverEnv()

    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value)
            }
            response = NextResponse.next({ request })
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options)
            }
          },
        },
      }
    )

    // Touching getUser() is what actually refreshes the session cookie.
    await supabase.auth.getUser()

    return response
  }
  ```

- [ ] **Step 4: Verify the project still builds**

  ```bash
  npx tsc --noEmit
  ```

  Expected: clean (this validates the new wrappers compile against the installed `@supabase/ssr` types).

- [ ] **Step 5: Commit**

  ```bash
  git add lib/supabase/server.ts lib/supabase/client.ts lib/supabase/session.ts
  git commit -m "feat(phase-2): add supabase ssr client wrappers"
  ```

---

## Task 5: Write schema migrations 001-004

**Files:**
- Create: `supabase/migrations/001_products.sql`
- Create: `supabase/migrations/002_orders.sql`
- Create: `supabase/migrations/003_inquiries.sql`
- Create: `supabase/migrations/004_updated_at_trigger.sql`

> **No tests at this layer.** SQL files are run against Postgres in Task 6; verification is "the migration applied without error and the expected tables/policies exist." Apply with `supabase-postgres-best-practices` skill conventions in mind: explicit column types, named constraints, idempotent guards where reasonable.

- [ ] **Step 1: Create `supabase/migrations/001_products.sql`**

  ```sql
  -- 001_products.sql
  -- Wholesale catalog table. Public (anon) read is gated to is_visible = true
  -- via RLS. Admin (authenticated) is unrestricted.

  create extension if not exists pgcrypto;

  create table public.products (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    name        text not null,
    subtitle    text,
    price       numeric(10, 2) not null check (price >= 0),
    flavors     jsonb not null default '[]'::jsonb,
    image_path  text,
    is_visible  boolean not null default true,
    sort_order  int not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  );

  create index products_visible_sort_idx
    on public.products (is_visible, sort_order);

  alter table public.products enable row level security;

  -- Anonymous: SELECT visible rows only
  create policy products_anon_select
    on public.products
    for select
    to anon
    using (is_visible = true);

  -- Authenticated (admin): full access
  create policy products_authenticated_all
    on public.products
    for all
    to authenticated
    using (true)
    with check (true);
  ```

- [ ] **Step 2: Create `supabase/migrations/002_orders.sql`**

  ```sql
  -- 002_orders.sql
  -- Customer orders. Anonymous role can INSERT only — never SELECT,
  -- so the public site cannot read other people's orders. The Server
  -- Action returns the new order_number from the INSERT ... RETURNING
  -- clause, which works under INSERT-only RLS because RETURNING is part
  -- of the same statement.

  create table public.orders (
    id            uuid primary key default gen_random_uuid(),
    order_number  text not null unique,
    first_name    text not null,
    last_name     text not null,
    email         text not null,
    notes         text,
    items         jsonb not null,
    subtotal      numeric(10, 2) not null check (subtotal >= 0),
    status        text not null default 'pending'
                   check (status in ('pending', 'fulfilled')),
    created_at    timestamptz not null default now(),
    fulfilled_at  timestamptz
  );

  create index orders_created_at_idx
    on public.orders (created_at desc);

  create index orders_status_idx
    on public.orders (status);

  alter table public.orders enable row level security;

  -- Anonymous: INSERT only, no SELECT
  create policy orders_anon_insert
    on public.orders
    for insert
    to anon
    with check (true);

  -- Authenticated (admin): full access
  create policy orders_authenticated_all
    on public.orders
    for all
    to authenticated
    using (true)
    with check (true);
  ```

- [ ] **Step 3: Create `supabase/migrations/003_inquiries.sql`**

  ```sql
  -- 003_inquiries.sql
  -- Product inquiries from the public site. Same INSERT-only RLS pattern
  -- as orders.

  create table public.inquiries (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    business_name   text,
    email           text not null,
    phone           text,
    requested_item  text not null,
    details         text,
    created_at      timestamptz not null default now()
  );

  create index inquiries_created_at_idx
    on public.inquiries (created_at desc);

  alter table public.inquiries enable row level security;

  create policy inquiries_anon_insert
    on public.inquiries
    for insert
    to anon
    with check (true);

  create policy inquiries_authenticated_all
    on public.inquiries
    for all
    to authenticated
    using (true)
    with check (true);
  ```

- [ ] **Step 4: Create `supabase/migrations/004_updated_at_trigger.sql`**

  ```sql
  -- 004_updated_at_trigger.sql
  -- Shared trigger that bumps updated_at on every UPDATE. Phase 2
  -- attaches it to products only; future tables can reuse the function.

  create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

  create trigger products_set_updated_at
    before update on public.products
    for each row
    execute function public.set_updated_at();
  ```

- [ ] **Step 5: Lint the SQL by previewing it**

  ```bash
  ls supabase/migrations/
  ```

  Expected: 4 files listed in numeric order. (No SQL parser is installed; the migrations are validated by application in Task 6.)

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/
  git commit -m "feat(phase-2): add postgres schema migrations 001-004"
  ```

---

## Task 6: Apply schema migrations to a Supabase project

**Files:** none (this is an environment task)

> **STOP — user interaction required.** This task creates the Supabase project (if not already created), gets credentials into `.env.local`, and applies migrations 001-004. **Pause before starting and confirm with the user which path to take:**
>
> - **Path A — MCP-driven:** if `mcp__plugin_supabase_supabase__authenticate` is connected, the agent can drive project creation and migration application directly.
> - **Path B — Manual:** the user creates the project at `https://supabase.com/dashboard`, copies the URL/anon key into `.env.local`, and pastes each migration into the SQL Editor in order.
>
> **Path B is the assumed default.** Only switch to Path A if the user explicitly confirms MCP availability.

- [ ] **Step 1: Confirm `.env.local` has the Supabase credentials**

  Ask the user to ensure `.env.local` contains, at minimum:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Project Settings → API>
  ```

  Verify by reading the file (do not log the values to chat):

  ```bash
  test -f .env.local && echo ".env.local exists"
  ```

  If missing, stop and ask the user.

- [ ] **Step 2: Apply migrations 001-005 in order**

  - **Path A (MCP):** call `mcp__plugin_supabase_supabase__authenticate`, then run each migration via the MCP's SQL execution tool in the order `001` → `002` → `003` → `004`. Halt on the first error.
  - **Path B (Manual):** instruct the user to open `https://supabase.com/dashboard/project/<ref>/sql/new`, paste the contents of `supabase/migrations/001_products.sql`, click Run, then repeat for 002 → 003 → 004. Wait for the user to confirm each one succeeded before moving on.

- [ ] **Step 3: Verify the schema landed**

  Have the user run this in the Supabase SQL Editor (or do it via MCP):

  ```sql
  select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  ```

  Expected output: `inquiries`, `orders`, `products`.

  Then verify RLS:

  ```sql
  select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
    order by tablename;
  ```

  Expected: all three tables show `rowsecurity = true`.

- [ ] **Step 4: No commit needed**

  This task changes only the remote Supabase project, not the repo. Skip the commit step and proceed to Task 7.

---

## Task 7: Seed migration `005_seed_products.sql` and apply it

**Files:**
- Create: `supabase/migrations/005_seed_products.sql`

> **Placeholder pricing is intentional.** The user is unsure of real wholesale prices yet — keep the Phase 1 placeholders ($25 / $30 / $35). Update later via the admin UI (Phase 3) when prices are confirmed. Local image paths point to `/products/<slug>.<ext>` files that already exist in `/public/`.

- [ ] **Step 1: Create `supabase/migrations/005_seed_products.sql`**

  ```sql
  -- 005_seed_products.sql
  -- Initial product catalog. Idempotent via ON CONFLICT (slug) so it's
  -- safe to re-run; updates name/price/flavors/image_path/etc on conflict
  -- but preserves the original id and created_at.

  insert into public.products (slug, name, subtitle, price, flavors, image_path, sort_order)
  values
    (
      'mega-v2-10-packs',
      'Mega V2 — 10 Packs',
      '25 flavor options',
      35.00,
      '["red bull","red apple","frozen tangerine","mega melons","Pineapple ice","Frozen blue razz","Frozen peach","Zero nicotine disposable pods","Strawberry banana","Cotton candy","Strawberry and cream","Frozen cranberry lemon","Guava ice","Frozen lychee ice","Blue razz","Mixed berry ice","Grape","Strawberry mint","Clear ice","Cherry cola","Watermelon mint","Frozen grape","Smooth tobacco","Cool mint","clear 5 percent"]'::jsonb,
      '/products/mega-v2-10-packs.jpg',
      10
    ),
    (
      'adalya-5-pieces-20000-puffs',
      'Adalya — 5 Pieces / 20000 Puffs',
      '16 flavor options',
      35.00,
      '["blueberry","Mi amor","Grape mint","Skyfall","Mint point","Love 66","Lady killer","Orange lemonade","Peach ice","Menthol","Passionfruit guava kiwi","Punk man","Blue min","Angel lips","delons","English lord"]'::jsonb,
      '/products/adalya-5-pieces-20000-puffs.jpg',
      20
    ),
    (
      'fume-extra',
      'Fume Extra',
      '16 flavor options',
      25.00,
      '["blueberry cc","Strawberry","Bubblegum","Paradise","Desert breeze","Hawaii juice","Mango","Banana ice","clear","Melon ice","Gummy bears","Strawberry banana","Fresh lychee","Double apple","Unicorn","mint ice"]'::jsonb,
      '/products/fume-extra.webp',
      30
    ),
    (
      'lava-plus',
      'Lava Plus',
      '22 flavor options',
      30.00,
      '["clear ice","Strawberry watermelon bubblegum","Berry mist","Jolly rancher ice","Watermelon mint","Pineapple, coconut rum","Bloom","Fruit blast","Black ice","Havana tobacco","Mango ice","Strawberry lemonade","Guava ice banana milkshake","Peach mango watermelon","Strawberry quake","Banana milkshake","Sour patch","Dragon flume","Sour watermelon candy","Mojito","Fruit ice","cool mint","peach ice"]'::jsonb,
      '/products/lava-plus.webp',
      40
    ),
    (
      'stig',
      'Stig',
      '1 flavor option',
      25.00,
      '["green apple"]'::jsonb,
      '/products/stig.png',
      50
    ),
    (
      'geek-bars-pulse-x',
      'Geek Bars Pulse X',
      '14 flavor options',
      30.00,
      '["Miami MINT","Mexican mango","Strawberry b pop","Lime berry orange","Clear diamond","Clear ice","Banana taffy freeze","Watermelon ice","Sour apple ice","Virginia tobacco","Blue razz ice","White peach raspberry","Banana taffy","Sour mango pineapple"]'::jsonb,
      '/products/geek-bars-pulse-x.jpg',
      60
    ),
    (
      'geek-x-mega',
      'Geek X Mega',
      '12 flavor options',
      30.00,
      '["clear","Strawberry mango ice","Strawberry kiwi ice","Strawberry ice","Cinnamon","Cool mint","Blue razz ice","Cherry lemon breeze","Tobacco","Blackberry b pop","Raspberry jam","Miami mint","Watermelon ice"]'::jsonb,
      '/products/geek-x-mega.png',
      70
    ),
    (
      'myle-mini-box-1500-puffs',
      'Myle Mini Box — 1500 Puffs',
      '10 flavor options',
      25.00,
      '["Cubano","Strawberry watermelon","Ice blueberry","Red apple","Prime pear","Iced apple","Sweet to","Grape ice","Peach ice","Ice watermelon"]'::jsonb,
      '/products/myle-mini-box-1500-puffs.webp',
      80
    ),
    (
      'mini-myle',
      'Mini Myle',
      '7 flavor options',
      25.00,
      '["ice Leche","Raspberry watermelon","Tobacco gold","Ice blueberry","Pink lemonade","Peach ice","Lemon mint"]'::jsonb,
      '/products/mini-myle.jpg',
      90
    )
  on conflict (slug) do update set
    name = excluded.name,
    subtitle = excluded.subtitle,
    price = excluded.price,
    flavors = excluded.flavors,
    image_path = excluded.image_path,
    sort_order = excluded.sort_order;
  ```

- [ ] **Step 2: Apply the seed migration (same Path A / Path B as Task 6)**

  - **Path A:** `mcp__plugin_supabase_supabase__authenticate` then run the migration via MCP.
  - **Path B:** the user pastes `005_seed_products.sql` into the SQL Editor and clicks Run.

- [ ] **Step 3: Verify the seed**

  Run this in the SQL Editor:

  ```sql
  select slug, name, price, sort_order, image_path
    from public.products
    order by sort_order;
  ```

  Expected: 9 rows in sort order (10, 20, 30, ..., 90), with `image_path` populated for each.

- [ ] **Step 4: Commit the migration file**

  ```bash
  git add supabase/migrations/005_seed_products.sql
  git commit -m "feat(phase-2): add seed migration for the 9-product catalog"
  ```

---

## Task 8: Products data access layer (TDD)

**Files:**
- Create: `tests/helpers/supabase-mock.ts`
- Create: `lib/data/products.ts`
- Create: `lib/data/products.test.ts`

- [ ] **Step 1: Create the shared Supabase mock helper**

  Create `tests/helpers/supabase-mock.ts`:

  ```ts
  // tests/helpers/supabase-mock.ts
  import { vi } from 'vitest'

  export type MockResult<T> =
    | { data: T; error: null }
    | { data: null; error: { message: string } }

  export type ChainStep = { method: string; args: unknown[] }

  type AnyFn = (...args: unknown[]) => unknown

  const CHAINABLE_METHODS = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'in',
    'order',
    'limit',
    'returns',
  ] as const

  /**
   * Build a fake Supabase query builder. Every chainable method is recorded
   * in `calls`. The terminal value comes from awaiting the builder itself
   * (PostgrestBuilder is a thenable) or calling .single() / .maybeSingle().
   */
  export function buildQueryBuilder<T>(result: MockResult<T>) {
    const calls: ChainStep[] = []
    const builder: Record<string, AnyFn> & { calls: ChainStep[] } = {
      calls,
    } as never

    for (const method of CHAINABLE_METHODS) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push({ method, args })
        return builder as never
      })
    }
    builder.single = vi.fn(() => Promise.resolve(result) as never)
    builder.maybeSingle = vi.fn(() => Promise.resolve(result) as never)

    // Make the builder thenable so `await builder.from(...).select(...)` works
    builder.then = ((resolve: (value: MockResult<T>) => void) =>
      resolve(result)) as never

    return builder
  }

  /**
   * Convenience: returns a Supabase client whose `from(...)` always returns
   * the same builder. Use `buildSupabaseMockMulti` if a single test needs
   * different responses for different tables.
   */
  export function buildSupabaseMock<T>(result: MockResult<T>) {
    const builder = buildQueryBuilder(result)
    const client = {
      from: vi.fn(() => builder as never),
    }
    return { client, builder, calls: builder.calls }
  }

  /**
   * For tests that need different `from(table)` responses per table.
   */
  export function buildSupabaseMockMulti(
    table: Record<string, MockResult<unknown>>
  ) {
    const builders = new Map<string, ReturnType<typeof buildQueryBuilder>>()
    for (const [name, result] of Object.entries(table)) {
      builders.set(name, buildQueryBuilder(result))
    }
    const client = {
      from: vi.fn((name: string) => {
        const b = builders.get(name)
        if (!b) throw new Error(`No mock builder for table "${name}"`)
        return b as never
      }),
    }
    return { client, builders }
  }
  ```

- [ ] **Step 2: Write the failing test for `getVisibleProducts`**

  Create `lib/data/products.test.ts`:

  ```ts
  // lib/data/products.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'
  import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

  vi.mock('@/lib/supabase/server', () => ({
    createServerSupabaseClient: vi.fn(),
  }))

  const { createServerSupabaseClient } = await import('@/lib/supabase/server')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getVisibleProducts', () => {
    it('returns visible products ordered by sort_order, mapped to camelCase with public image URL', async () => {
      const { client, calls } = buildSupabaseMock({
        data: [
          {
            id: 'uuid-1',
            slug: 'mega-v2-10-packs',
            name: 'Mega V2',
            subtitle: '25 flavor options',
            price: 35,
            flavors: ['red bull', 'cool mint'],
            image_path: '/products/mega-v2-10-packs.jpg',
            is_visible: true,
            sort_order: 10,
          },
          {
            id: 'uuid-2',
            slug: 'stig',
            name: 'Stig',
            subtitle: '1 flavor option',
            price: 25,
            flavors: ['green apple'],
            image_path: null,
            is_visible: true,
            sort_order: 50,
          },
        ],
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { getVisibleProducts } = await import('./products')
      const result = await getVisibleProducts()

      expect(client.from).toHaveBeenCalledWith('products')
      expect(calls).toEqual([
        { method: 'select', args: ['*'] },
        { method: 'eq', args: ['is_visible', true] },
        { method: 'order', args: ['sort_order', { ascending: true }] },
      ])

      expect(result).toEqual([
        {
          id: 'uuid-1',
          slug: 'mega-v2-10-packs',
          name: 'Mega V2',
          subtitle: '25 flavor options',
          price: 35,
          flavors: ['red bull', 'cool mint'],
          imagePath: '/products/mega-v2-10-packs.jpg',
        },
        {
          id: 'uuid-2',
          slug: 'stig',
          name: 'Stig',
          subtitle: '1 flavor option',
          price: 25,
          flavors: ['green apple'],
          imagePath: null,
        },
      ])
    })

    it('throws when supabase returns an error', async () => {
      const { client } = buildSupabaseMock({
        data: null,
        error: { message: 'connection refused' },
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { getVisibleProducts } = await import('./products')
      await expect(getVisibleProducts()).rejects.toThrow(/connection refused/)
    })
  })

  describe('getProductsByIds', () => {
    it('fetches multiple products in a single query and returns them mapped to camelCase', async () => {
      const { client, calls } = buildSupabaseMock({
        data: [
          {
            id: 'uuid-1',
            slug: 'a',
            name: 'A',
            subtitle: null,
            price: 35,
            flavors: ['x'],
            image_path: '/products/a.jpg',
            is_visible: true,
            sort_order: 10,
          },
          {
            id: 'uuid-2',
            slug: 'b',
            name: 'B',
            subtitle: null,
            price: 25,
            flavors: ['y'],
            image_path: null,
            is_visible: true,
            sort_order: 20,
          },
        ],
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { getProductsByIds } = await import('./products')
      const result = await getProductsByIds(['uuid-1', 'uuid-2'])

      expect(calls).toEqual([
        { method: 'select', args: ['*'] },
        { method: 'in', args: ['id', ['uuid-1', 'uuid-2']] },
      ])
      expect(result.map((p) => p.id)).toEqual(['uuid-1', 'uuid-2'])
      expect(result[0].imagePath).toBe('/products/a.jpg')
    })

    it('returns an empty array for an empty input without calling supabase', async () => {
      const { client } = buildSupabaseMock({ data: [], error: null })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { getProductsByIds } = await import('./products')
      const result = await getProductsByIds([])

      expect(result).toEqual([])
      expect(client.from).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 3: Run tests to verify they fail**

  ```bash
  npm test -- lib/data/products.test.ts
  ```

  Expected: FAIL with `Cannot find module './products'`.

- [ ] **Step 4: Implement `lib/data/products.ts`**

  ```ts
  // lib/data/products.ts
  import { createServerSupabaseClient } from '@/lib/supabase/server'

  export type Product = {
    id: string
    slug: string
    name: string
    subtitle: string | null
    price: number
    flavors: string[]
    imagePath: string | null
  }

  type ProductRow = {
    id: string
    slug: string
    name: string
    subtitle: string | null
    price: number | string
    flavors: string[]
    image_path: string | null
    is_visible: boolean
    sort_order: number
  }

  function rowToProduct(row: ProductRow): Product {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subtitle: row.subtitle,
      // Postgres NUMERIC comes back as a string under @supabase/supabase-js;
      // coerce defensively.
      price: typeof row.price === 'string' ? Number(row.price) : row.price,
      flavors: row.flavors,
      imagePath: row.image_path,
    }
  }

  /**
   * Public catalog read. Returns visible products in display order.
   */
  export async function getVisibleProducts(): Promise<Product[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: ProductRow) => rowToProduct(row))
  }

  /**
   * Bulk fetch by ID. Used by `placeOrder` to re-fetch every product the
   * client claims to have added — this is the load-bearing read that
   * prevents client-side price tampering.
   */
  export async function getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return []
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: ProductRow) => rowToProduct(row))
  }

  // ============================================================================
  // Admin helpers — used in Phase 3, scaffolded here per spec §6.5.
  // ============================================================================

  /**
   * Single product by ID. Used by admin edit pages.
   */
  export async function getProductById(id: string): Promise<Product | null> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return rowToProduct(data as ProductRow)
  }

  /**
   * All products including hidden ones. Used by the admin product list.
   */
  export async function getAllProducts(): Promise<Product[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: ProductRow) => rowToProduct(row))
  }

  export type ProductInput = {
    slug: string
    name: string
    subtitle: string | null
    price: number
    flavors: string[]
    imagePath: string | null
    isVisible: boolean
    sortOrder: number
  }

  /**
   * Insert a new product. Phase 3 admin form caller.
   */
  export async function createProduct(input: ProductInput): Promise<Product> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .insert({
        slug: input.slug,
        name: input.name,
        subtitle: input.subtitle,
        price: input.price,
        flavors: input.flavors,
        image_path: input.imagePath,
        is_visible: input.isVisible,
        sort_order: input.sortOrder,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToProduct(data as ProductRow)
  }

  export async function updateProduct(
    id: string,
    input: ProductInput
  ): Promise<Product> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .update({
        slug: input.slug,
        name: input.name,
        subtitle: input.subtitle,
        price: input.price,
        flavors: input.flavors,
        image_path: input.imagePath,
        is_visible: input.isVisible,
        sort_order: input.sortOrder,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToProduct(data as ProductRow)
  }

  export async function deleteProduct(id: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  export async function toggleProductVisibility(
    id: string,
    isVisible: boolean
  ): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('products')
      .update({ is_visible: isVisible })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  ```bash
  npm test -- lib/data/products.test.ts
  ```

  Expected: 4 passed (`getVisibleProducts` 2 cases, `getProductsByIds` 2 cases).

- [ ] **Step 6: Commit**

  ```bash
  git add tests/helpers/supabase-mock.ts lib/data/products.ts lib/data/products.test.ts
  git commit -m "feat(phase-2): add products data access layer with TDD coverage

  - Public reads: getVisibleProducts, getProductsByIds (the latter is the
    load-bearing fetch that prevents client-side price tampering in
    placeOrder)
  - Admin helpers (consumed in Phase 3): getProductById, getAllProducts,
    createProduct, updateProduct, deleteProduct, toggleProductVisibility
  - Snake_case → camelCase translation at the boundary
  - Hand-rolled chainable Supabase mock helper for unit tests"
  ```

---

## Task 9: Orders data access layer (TDD)

**Files:**
- Create: `lib/data/orders.ts`
- Create: `lib/data/orders.test.ts`

- [ ] **Step 1: Write the failing test for `createOrder`**

  Create `lib/data/orders.test.ts`:

  ```ts
  // lib/data/orders.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'
  import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

  vi.mock('@/lib/supabase/server', () => ({
    createServerSupabaseClient: vi.fn(),
  }))

  const { createServerSupabaseClient } = await import('@/lib/supabase/server')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createOrder', () => {
    it('inserts an order with the items snapshot and returns the new order with snake_case items preserved', async () => {
      const { client, calls } = buildSupabaseMock({
        data: {
          id: 'order-uuid',
          order_number: 'DM-ABC123',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          notes: null,
          items: [
            {
              product_id: 'p1',
              product_name: 'Mega V2',
              flavor: 'red bull',
              quantity: 2,
              unit_price: 35,
              line_total: 70,
            },
          ],
          subtotal: 70,
          status: 'pending',
          created_at: '2026-04-11T12:00:00Z',
          fulfilled_at: null,
        },
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { createOrder } = await import('./orders')
      const result = await createOrder({
        orderNumber: 'DM-ABC123',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [
          {
            product_id: 'p1',
            product_name: 'Mega V2',
            flavor: 'red bull',
            quantity: 2,
            unit_price: 35,
            line_total: 70,
          },
        ],
        subtotal: 70,
      })

      expect(client.from).toHaveBeenCalledWith('orders')
      // The first chained call should be insert(...) with snake_case payload
      expect(calls[0]).toEqual({
        method: 'insert',
        args: [
          {
            order_number: 'DM-ABC123',
            first_name: 'Jane',
            last_name: 'Doe',
            email: 'jane@example.com',
            notes: null,
            items: [
              {
                product_id: 'p1',
                product_name: 'Mega V2',
                flavor: 'red bull',
                quantity: 2,
                unit_price: 35,
                line_total: 70,
              },
            ],
            subtotal: 70,
          },
        ],
      })
      expect(calls[1]).toEqual({ method: 'select', args: ['*'] })

      expect(result.orderNumber).toBe('DM-ABC123')
      expect(result.items[0].product_id).toBe('p1')
      expect(result.subtotal).toBe(70)
      expect(result.status).toBe('pending')
    })

    it('throws when supabase returns an error', async () => {
      const { client } = buildSupabaseMock({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { createOrder } = await import('./orders')
      await expect(
        createOrder({
          orderNumber: 'DM-ABC123',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          notes: null,
          items: [],
          subtotal: 0,
        })
      ).rejects.toThrow(/duplicate key/)
    })
  })

  describe('getOrders', () => {
    it('returns orders ordered by created_at desc with camelCase keys', async () => {
      const { client, calls } = buildSupabaseMock({
        data: [
          {
            id: 'order-1',
            order_number: 'DM-AAA111',
            first_name: 'A',
            last_name: 'A',
            email: 'a@x.com',
            notes: null,
            items: [],
            subtotal: 0,
            status: 'pending',
            created_at: '2026-04-11T12:00:00Z',
            fulfilled_at: null,
          },
        ],
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { getOrders } = await import('./orders')
      const result = await getOrders()

      expect(client.from).toHaveBeenCalledWith('orders')
      expect(calls).toEqual([
        { method: 'select', args: ['*'] },
        { method: 'order', args: ['created_at', { ascending: false }] },
      ])
      expect(result[0].orderNumber).toBe('DM-AAA111')
      expect(result[0].createdAt).toBe('2026-04-11T12:00:00Z')
    })
  })

  describe('markOrderFulfilled', () => {
    it('updates status and fulfilled_at', async () => {
      const { client, calls } = buildSupabaseMock({
        data: null,
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { markOrderFulfilled } = await import('./orders')
      await markOrderFulfilled('order-uuid')

      expect(client.from).toHaveBeenCalledWith('orders')
      expect(calls[0].method).toBe('update')
      const updatePayload = calls[0].args[0] as Record<string, unknown>
      expect(updatePayload.status).toBe('fulfilled')
      expect(typeof updatePayload.fulfilled_at).toBe('string')
      expect(calls[1]).toEqual({ method: 'eq', args: ['id', 'order-uuid'] })
    })
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npm test -- lib/data/orders.test.ts
  ```

  Expected: FAIL with `Cannot find module './orders'`.

- [ ] **Step 3: Implement `lib/data/orders.ts`**

  ```ts
  // lib/data/orders.ts
  import { createServerSupabaseClient } from '@/lib/supabase/server'

  export type OrderItemSnapshot = {
    product_id: string
    product_name: string
    flavor: string
    quantity: number
    unit_price: number
    line_total: number
  }

  export type Order = {
    id: string
    orderNumber: string
    firstName: string
    lastName: string
    email: string
    notes: string | null
    items: OrderItemSnapshot[]
    subtotal: number
    status: 'pending' | 'fulfilled'
    createdAt: string
    fulfilledAt: string | null
  }

  type OrderRow = {
    id: string
    order_number: string
    first_name: string
    last_name: string
    email: string
    notes: string | null
    items: OrderItemSnapshot[]
    subtotal: number | string
    status: 'pending' | 'fulfilled'
    created_at: string
    fulfilled_at: string | null
  }

  function rowToOrder(row: OrderRow): Order {
    return {
      id: row.id,
      orderNumber: row.order_number,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      notes: row.notes,
      items: row.items,
      subtotal:
        typeof row.subtotal === 'string' ? Number(row.subtotal) : row.subtotal,
      status: row.status,
      createdAt: row.created_at,
      fulfilledAt: row.fulfilled_at,
    }
  }

  export type CreateOrderInput = {
    orderNumber: string
    firstName: string
    lastName: string
    email: string
    notes: string | null
    items: OrderItemSnapshot[]
    subtotal: number
  }

  /**
   * Public-facing insert. Anonymous role can INSERT but not SELECT, so we
   * rely on PostgREST's `RETURNING *` (the default `.select('*').single()`
   * after `.insert(...)` does this) to get the inserted row back without
   * a separate read.
   */
  export async function createOrder(input: CreateOrderInput): Promise<Order> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number: input.orderNumber,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        notes: input.notes,
        items: input.items,
        subtotal: input.subtotal,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToOrder(data as OrderRow)
  }

  // ============================================================================
  // Admin helpers — used in Phase 3.
  // ============================================================================

  export async function getOrders(): Promise<Order[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: OrderRow) => rowToOrder(row))
  }

  export async function getOrderById(id: string): Promise<Order | null> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return rowToOrder(data as OrderRow)
  }

  export async function markOrderFulfilled(id: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  export async function deleteOrder(id: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  ```bash
  npm test -- lib/data/orders.test.ts
  ```

  Expected: 4 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/data/orders.ts lib/data/orders.test.ts
  git commit -m "feat(phase-2): add orders data access layer with TDD coverage

  - Public createOrder uses INSERT ... RETURNING so the anon role can
    fetch the inserted row back without a SELECT (which RLS forbids)
  - Items snapshot is preserved as snake_case to match the JSONB column
  - Admin helpers (Phase 3): getOrders, getOrderById, markOrderFulfilled,
    deleteOrder"
  ```

---

## Task 10: Inquiries data access layer (TDD)

**Files:**
- Create: `lib/data/inquiries.ts`
- Create: `lib/data/inquiries.test.ts`

- [ ] **Step 1: Write the failing test**

  Create `lib/data/inquiries.test.ts`:

  ```ts
  // lib/data/inquiries.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'
  import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

  vi.mock('@/lib/supabase/server', () => ({
    createServerSupabaseClient: vi.fn(),
  }))

  const { createServerSupabaseClient } = await import('@/lib/supabase/server')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createInquiry', () => {
    it('inserts a row with snake_case keys and returns the new inquiry mapped to camelCase', async () => {
      const { client, calls } = buildSupabaseMock({
        data: {
          id: 'inq-uuid',
          name: 'Jane',
          business_name: 'Acme',
          email: 'jane@example.com',
          phone: '+1-555-0100',
          requested_item: 'Geek Bar 25k puffs',
          details: 'Looking for case quantities',
          created_at: '2026-04-11T12:00:00Z',
        },
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { createInquiry } = await import('./inquiries')
      const result = await createInquiry({
        name: 'Jane',
        businessName: 'Acme',
        email: 'jane@example.com',
        phone: '+1-555-0100',
        requestedItem: 'Geek Bar 25k puffs',
        details: 'Looking for case quantities',
      })

      expect(client.from).toHaveBeenCalledWith('inquiries')
      expect(calls[0]).toEqual({
        method: 'insert',
        args: [
          {
            name: 'Jane',
            business_name: 'Acme',
            email: 'jane@example.com',
            phone: '+1-555-0100',
            requested_item: 'Geek Bar 25k puffs',
            details: 'Looking for case quantities',
          },
        ],
      })
      expect(result.id).toBe('inq-uuid')
      expect(result.businessName).toBe('Acme')
      expect(result.requestedItem).toBe('Geek Bar 25k puffs')
    })

    it('translates undefined optionals to null on the way in', async () => {
      const { client, calls } = buildSupabaseMock({
        data: {
          id: 'inq-uuid',
          name: 'Jane',
          business_name: null,
          email: 'jane@example.com',
          phone: null,
          requested_item: 'Anything',
          details: null,
          created_at: '2026-04-11T12:00:00Z',
        },
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { createInquiry } = await import('./inquiries')
      await createInquiry({
        name: 'Jane',
        businessName: undefined,
        email: 'jane@example.com',
        phone: undefined,
        requestedItem: 'Anything',
        details: undefined,
      })

      const insertArgs = calls[0].args[0] as Record<string, unknown>
      expect(insertArgs.business_name).toBeNull()
      expect(insertArgs.phone).toBeNull()
      expect(insertArgs.details).toBeNull()
    })
  })

  describe('getInquiries', () => {
    it('returns inquiries ordered by created_at desc', async () => {
      const { client, calls } = buildSupabaseMock({
        data: [
          {
            id: 'i1',
            name: 'A',
            business_name: null,
            email: 'a@x.com',
            phone: null,
            requested_item: 'X',
            details: null,
            created_at: '2026-04-11T12:00:00Z',
          },
        ],
        error: null,
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

      const { getInquiries } = await import('./inquiries')
      const result = await getInquiries()

      expect(calls).toEqual([
        { method: 'select', args: ['*'] },
        { method: 'order', args: ['created_at', { ascending: false }] },
      ])
      expect(result[0].id).toBe('i1')
      expect(result[0].requestedItem).toBe('X')
    })
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npm test -- lib/data/inquiries.test.ts
  ```

  Expected: FAIL with `Cannot find module './inquiries'`.

- [ ] **Step 3: Implement `lib/data/inquiries.ts`**

  ```ts
  // lib/data/inquiries.ts
  import { createServerSupabaseClient } from '@/lib/supabase/server'

  export type Inquiry = {
    id: string
    name: string
    businessName: string | null
    email: string
    phone: string | null
    requestedItem: string
    details: string | null
    createdAt: string
  }

  type InquiryRow = {
    id: string
    name: string
    business_name: string | null
    email: string
    phone: string | null
    requested_item: string
    details: string | null
    created_at: string
  }

  function rowToInquiry(row: InquiryRow): Inquiry {
    return {
      id: row.id,
      name: row.name,
      businessName: row.business_name,
      email: row.email,
      phone: row.phone,
      requestedItem: row.requested_item,
      details: row.details,
      createdAt: row.created_at,
    }
  }

  export type CreateInquiryInput = {
    name: string
    businessName: string | null | undefined
    email: string
    phone: string | null | undefined
    requestedItem: string
    details: string | null | undefined
  }

  export async function createInquiry(
    input: CreateInquiryInput
  ): Promise<Inquiry> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        name: input.name,
        business_name: input.businessName ?? null,
        email: input.email,
        phone: input.phone ?? null,
        requested_item: input.requestedItem,
        details: input.details ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToInquiry(data as InquiryRow)
  }

  // ============================================================================
  // Admin helpers — used in Phase 3.
  // ============================================================================

  export async function getInquiries(): Promise<Inquiry[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: InquiryRow) => rowToInquiry(row))
  }

  export async function getInquiryById(id: string): Promise<Inquiry | null> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return rowToInquiry(data as InquiryRow)
  }

  export async function deleteInquiry(id: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('inquiries').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npm test -- lib/data/inquiries.test.ts
  ```

  Expected: 3 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/data/inquiries.ts lib/data/inquiries.test.ts
  git commit -m "feat(phase-2): add inquiries data access layer with TDD coverage"
  ```

---

## Task 11: Resend client singleton

**Files:**
- Create: `lib/email/resend.ts`

> No tests at this layer — it's a 10-line lazy singleton wrapping the Resend constructor. Test coverage comes via the send-helper tests in Tasks 13 and 14, which mock this module wholesale.

- [ ] **Step 1: Create `lib/email/resend.ts`**

  ```ts
  // lib/email/resend.ts
  import { Resend } from 'resend'
  import { serverEnv } from '@/lib/env'

  let cached: Resend | null = null

  /**
   * Lazy singleton Resend client. Lazy because instantiating at module load
   * trips Next.js's static analysis when env vars aren't set yet (e.g.,
   * during the migration tasks before .env.local exists).
   */
  export function getResend(): Resend {
    if (cached) return cached
    const env = serverEnv()
    cached = new Resend(env.RESEND_API_KEY)
    return cached
  }

  /**
   * Test-only escape hatch. Tests should prefer `vi.mock('@/lib/email/resend')`,
   * but if a test needs to swap the singleton in-place this is the way.
   */
  export function __resetResendForTests() {
    cached = null
  }
  ```

- [ ] **Step 2: Verify it compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: clean.

- [ ] **Step 3: Commit**

  ```bash
  git add lib/email/resend.ts
  git commit -m "feat(phase-2): add lazy resend client singleton"
  ```

---

## Task 12: Order receipt email template + send helper (TDD)

**Files:**
- Create: `lib/email/templates/order-receipt.tsx`
- Create: `lib/email/send-order-receipt.ts`
- Create: `lib/email/send-order-receipt.test.ts`

- [ ] **Step 1: Write the failing test for `sendOrderReceipt`**

  Create `lib/email/send-order-receipt.test.ts`:

  ```ts
  // lib/email/send-order-receipt.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'

  vi.mock('@/lib/email/resend', () => ({
    getResend: vi.fn(),
  }))

  vi.mock('@/lib/env', () => ({
    serverEnv: vi.fn(() => ({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'orders@directms.example',
      ADMIN_NOTIFICATION_EMAIL: 'admin@directms.example',
      NEXT_PUBLIC_SITE_URL: 'https://directms.example',
    })),
    publicEnv: vi.fn(() => ({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      NEXT_PUBLIC_SITE_URL: 'https://directms.example',
    })),
  }))

  const { getResend } = await import('@/lib/email/resend')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendOrderReceipt', () => {
    it('calls resend.emails.send with the order recipient and a React element', async () => {
      const send = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null })
      vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

      const { sendOrderReceipt } = await import('./send-order-receipt')
      await sendOrderReceipt({
        orderNumber: 'DM-ABC123',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [
          {
            product_id: 'p1',
            product_name: 'Mega V2',
            flavor: 'red bull',
            quantity: 2,
            unit_price: 35,
            line_total: 70,
          },
        ],
        subtotal: 70,
      })

      expect(send).toHaveBeenCalledTimes(1)
      const call = send.mock.calls[0][0]
      expect(call.from).toBe('orders@directms.example')
      expect(call.to).toBe('jane@example.com')
      expect(call.subject).toContain('DM-ABC123')
      // The `react` prop should be a JSX element, not a string
      expect(call.react).toBeDefined()
      expect(typeof call.react).toBe('object')
    })

    it('throws when resend returns an error', async () => {
      const send = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'rate limited' } })
      vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

      const { sendOrderReceipt } = await import('./send-order-receipt')
      await expect(
        sendOrderReceipt({
          orderNumber: 'DM-ABC123',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          notes: null,
          items: [],
          subtotal: 0,
        })
      ).rejects.toThrow(/rate limited/)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  npm test -- lib/email/send-order-receipt.test.ts
  ```

  Expected: FAIL with `Cannot find module './send-order-receipt'`.

- [ ] **Step 3: Implement `lib/email/templates/order-receipt.tsx`**

  ```tsx
  // lib/email/templates/order-receipt.tsx
  import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Row,
    Column,
    Section,
    Text,
  } from '@react-email/components'
  import type { OrderItemSnapshot } from '@/lib/data/orders'

  export type OrderReceiptProps = {
    orderNumber: string
    firstName: string
    lastName: string
    items: OrderItemSnapshot[]
    subtotal: number
    notes: string | null
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  export function OrderReceipt({
    orderNumber,
    firstName,
    lastName,
    items,
    subtotal,
    notes,
  }: OrderReceiptProps) {
    return (
      <Html>
        <Head />
        <Preview>Your DirectMS order {orderNumber} has been received</Preview>
        <Body
          style={{
            backgroundColor: '#fdf8f3',
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            color: '#1c1c1c',
            padding: '24px 0',
          }}
        >
          <Container
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '560px',
              margin: '0 auto',
              border: '1px solid #efe6d8',
            }}
          >
            <Heading
              as="h1"
              style={{ fontSize: '22px', margin: '0 0 4px 0', color: '#1c1c1c' }}
            >
              Order received
            </Heading>
            <Text style={{ color: '#7c7163', margin: '0 0 24px 0' }}>
              Order number{' '}
              <strong style={{ color: '#1c1c1c', fontFamily: 'ui-monospace, monospace' }}>
                {orderNumber}
              </strong>
            </Text>

            <Text style={{ margin: '0 0 16px 0' }}>
              Hi {firstName} {lastName}, thanks for your order. Here&apos;s a copy
              for your records — we&apos;ll be in touch shortly to confirm
              fulfillment.
            </Text>

            <Hr style={{ border: 'none', borderTop: '1px solid #efe6d8', margin: '20px 0' }} />

            <Section>
              {items.map((item, idx) => (
                <Row key={`${item.product_id}-${item.flavor}-${idx}`} style={{ marginBottom: '12px' }}>
                  <Column>
                    <Text style={{ margin: 0, fontWeight: 600 }}>{item.product_name}</Text>
                    <Text style={{ margin: '2px 0 0 0', color: '#7c7163', fontSize: '13px' }}>
                      {item.flavor} · qty {item.quantity} · {formatCurrency(item.unit_price)} each
                    </Text>
                  </Column>
                  <Column align="right" style={{ verticalAlign: 'top' }}>
                    <Text style={{ margin: 0, fontWeight: 600 }}>
                      {formatCurrency(item.line_total)}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>

            <Hr style={{ border: 'none', borderTop: '1px solid #efe6d8', margin: '20px 0' }} />

            <Row>
              <Column>
                <Text style={{ margin: 0, fontWeight: 600 }}>Subtotal</Text>
              </Column>
              <Column align="right">
                <Text style={{ margin: 0, fontWeight: 600 }}>{formatCurrency(subtotal)}</Text>
              </Column>
            </Row>

            {notes ? (
              <>
                <Hr style={{ border: 'none', borderTop: '1px solid #efe6d8', margin: '20px 0' }} />
                <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Order notes</Text>
                <Text style={{ margin: 0, color: '#7c7163' }}>{notes}</Text>
              </>
            ) : null}
          </Container>
        </Body>
      </Html>
    )
  }
  ```

- [ ] **Step 4: Implement `lib/email/send-order-receipt.ts`**

  ```ts
  // lib/email/send-order-receipt.ts
  import { getResend } from '@/lib/email/resend'
  import { serverEnv } from '@/lib/env'
  import type { OrderItemSnapshot } from '@/lib/data/orders'
  import { OrderReceipt } from './templates/order-receipt'

  export type SendOrderReceiptInput = {
    orderNumber: string
    firstName: string
    lastName: string
    email: string
    notes: string | null
    items: OrderItemSnapshot[]
    subtotal: number
  }

  export async function sendOrderReceipt(input: SendOrderReceiptInput): Promise<void> {
    const env = serverEnv()
    const resend = getResend()
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: input.email,
      subject: `Order received — ${input.orderNumber}`,
      react: OrderReceipt({
        orderNumber: input.orderNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        items: input.items,
        subtotal: input.subtotal,
        notes: input.notes,
      }),
    })
    if (error) throw new Error(error.message)
  }
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  npm test -- lib/email/send-order-receipt.test.ts
  ```

  Expected: 2 passed.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/email/templates/order-receipt.tsx lib/email/send-order-receipt.ts lib/email/send-order-receipt.test.ts
  git commit -m "feat(phase-2): add order receipt email template + send helper

  React Email template renders the customer-facing receipt with line
  items, subtotal, and order notes. The send helper wraps Resend's
  emails.send with the resolved env, throwing on Resend error so the
  caller can decide whether to swallow or surface."
  ```

---

## Task 13: Inquiry notification email template + send helper (TDD)

**Files:**
- Create: `lib/email/templates/inquiry-notification.tsx`
- Create: `lib/email/send-inquiry-notification.ts`
- Create: `lib/email/send-inquiry-notification.test.ts`

- [ ] **Step 1: Write the failing test**

  Create `lib/email/send-inquiry-notification.test.ts`:

  ```ts
  // lib/email/send-inquiry-notification.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'

  vi.mock('@/lib/email/resend', () => ({ getResend: vi.fn() }))
  vi.mock('@/lib/env', () => ({
    serverEnv: vi.fn(() => ({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'orders@directms.example',
      ADMIN_NOTIFICATION_EMAIL: 'admin@directms.example',
      NEXT_PUBLIC_SITE_URL: 'https://directms.example',
    })),
    publicEnv: vi.fn(() => ({})),
  }))

  const { getResend } = await import('@/lib/email/resend')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendInquiryNotification', () => {
    it('emails the admin with the inquiry details', async () => {
      const send = vi.fn().mockResolvedValue({ data: { id: 'm1' }, error: null })
      vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

      const { sendInquiryNotification } = await import('./send-inquiry-notification')
      await sendInquiryNotification({
        name: 'Jane Doe',
        businessName: 'Acme',
        email: 'jane@example.com',
        phone: '+1-555-0100',
        requestedItem: 'Geek Bar 25k',
        details: 'Looking for case quantities',
      })

      expect(send).toHaveBeenCalledTimes(1)
      const call = send.mock.calls[0][0]
      expect(call.from).toBe('orders@directms.example')
      expect(call.to).toBe('admin@directms.example')
      expect(call.subject).toContain('Geek Bar 25k')
      expect(call.replyTo).toBe('jane@example.com')
      expect(call.react).toBeDefined()
    })

    it('handles missing optional fields gracefully', async () => {
      const send = vi.fn().mockResolvedValue({ data: { id: 'm1' }, error: null })
      vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

      const { sendInquiryNotification } = await import('./send-inquiry-notification')
      await sendInquiryNotification({
        name: 'Jane',
        businessName: undefined,
        email: 'jane@example.com',
        phone: undefined,
        requestedItem: 'X',
        details: undefined,
      })

      expect(send).toHaveBeenCalledTimes(1)
    })

    it('throws when resend returns an error', async () => {
      const send = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
      vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

      const { sendInquiryNotification } = await import('./send-inquiry-notification')
      await expect(
        sendInquiryNotification({
          name: 'Jane',
          businessName: undefined,
          email: 'jane@example.com',
          phone: undefined,
          requestedItem: 'X',
          details: undefined,
        })
      ).rejects.toThrow(/boom/)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  npm test -- lib/email/send-inquiry-notification.test.ts
  ```

  Expected: FAIL with `Cannot find module './send-inquiry-notification'`.

- [ ] **Step 3: Implement `lib/email/templates/inquiry-notification.tsx`**

  ```tsx
  // lib/email/templates/inquiry-notification.tsx
  import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
  } from '@react-email/components'

  export type InquiryNotificationProps = {
    name: string
    businessName: string | null | undefined
    email: string
    phone: string | null | undefined
    requestedItem: string
    details: string | null | undefined
  }

  export function InquiryNotification({
    name,
    businessName,
    email,
    phone,
    requestedItem,
    details,
  }: InquiryNotificationProps) {
    return (
      <Html>
        <Head />
        <Preview>New product inquiry: {requestedItem}</Preview>
        <Body
          style={{
            backgroundColor: '#fdf8f3',
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            color: '#1c1c1c',
            padding: '24px 0',
          }}
        >
          <Container
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '560px',
              margin: '0 auto',
              border: '1px solid #efe6d8',
            }}
          >
            <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
              New product inquiry
            </Heading>

            <Section>
              <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>
                Requested item
              </Text>
              <Text style={{ margin: '0 0 16px 0' }}>{requestedItem}</Text>

              <Hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #efe6d8',
                  margin: '12px 0',
                }}
              />

              <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>From</Text>
              <Text style={{ margin: 0 }}>{name}</Text>
              {businessName ? (
                <Text style={{ margin: 0, color: '#7c7163' }}>{businessName}</Text>
              ) : null}
              <Text style={{ margin: '4px 0 0 0', color: '#7c7163' }}>{email}</Text>
              {phone ? (
                <Text style={{ margin: 0, color: '#7c7163' }}>{phone}</Text>
              ) : null}

              {details ? (
                <>
                  <Hr
                    style={{
                      border: 'none',
                      borderTop: '1px solid #efe6d8',
                      margin: '16px 0',
                    }}
                  />
                  <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Details</Text>
                  <Text style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{details}</Text>
                </>
              ) : null}
            </Section>
          </Container>
        </Body>
      </Html>
    )
  }
  ```

- [ ] **Step 4: Implement `lib/email/send-inquiry-notification.ts`**

  ```ts
  // lib/email/send-inquiry-notification.ts
  import { getResend } from '@/lib/email/resend'
  import { serverEnv } from '@/lib/env'
  import { InquiryNotification } from './templates/inquiry-notification'

  export type SendInquiryNotificationInput = {
    name: string
    businessName: string | null | undefined
    email: string
    phone: string | null | undefined
    requestedItem: string
    details: string | null | undefined
  }

  export async function sendInquiryNotification(
    input: SendInquiryNotificationInput
  ): Promise<void> {
    const env = serverEnv()
    const resend = getResend()
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: env.ADMIN_NOTIFICATION_EMAIL,
      replyTo: input.email,
      subject: `New inquiry: ${input.requestedItem}`,
      react: InquiryNotification({
        name: input.name,
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        requestedItem: input.requestedItem,
        details: input.details,
      }),
    })
    if (error) throw new Error(error.message)
  }
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  npm test -- lib/email/send-inquiry-notification.test.ts
  ```

  Expected: 3 passed.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/email/templates/inquiry-notification.tsx lib/email/send-inquiry-notification.ts lib/email/send-inquiry-notification.test.ts
  git commit -m "feat(phase-2): add inquiry notification email template + send helper

  Sends to ADMIN_NOTIFICATION_EMAIL with replyTo set to the customer's
  email so the shop owner can reply directly from their inbox."
  ```

---

## Task 14: Real `placeOrder` Server Action + checkout form changes (TDD)

**Files:**
- Modify: `app/actions/place-order.ts`
- Create: `app/actions/place-order.test.ts`
- Modify: `components/cart/checkout-form.tsx`

> **Highest-stakes task in Phase 2.** Three things must be ironclad:
> 1. The action re-fetches every `productId` from Supabase and recomputes prices server-side.
> 2. The honeypot field bails before any DB or email work happens.
> 3. Email failure does NOT fail the order — the row is already persisted.

- [ ] **Step 1: Write the failing test**

  Create `app/actions/place-order.test.ts`:

  ```ts
  // app/actions/place-order.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'

  vi.mock('@/lib/data/products', () => ({
    getProductsByIds: vi.fn(),
  }))
  vi.mock('@/lib/data/orders', () => ({
    createOrder: vi.fn(),
  }))
  vi.mock('@/lib/email/send-order-receipt', () => ({
    sendOrderReceipt: vi.fn(),
  }))

  const { getProductsByIds } = await import('@/lib/data/products')
  const { createOrder } = await import('@/lib/data/orders')
  const { sendOrderReceipt } = await import('@/lib/email/send-order-receipt')

  function buildFormData(payload: unknown, honeypot = '') {
    const fd = new FormData()
    fd.set('payload', JSON.stringify(payload))
    fd.set('website', honeypot) // honeypot field
    return fd
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('placeOrderAction', () => {
    it('re-fetches products from the DB, recomputes the subtotal server-side, inserts, and emails the customer', async () => {
      vi.mocked(getProductsByIds).mockResolvedValue([
        {
          id: 'p1',
          slug: 'mega-v2',
          name: 'Mega V2',
          subtitle: null,
          price: 35, // canonical price from DB
          flavors: ['red bull'],
          imagePath: null,
        },
        {
          id: 'p2',
          slug: 'stig',
          name: 'Stig',
          subtitle: null,
          price: 25,
          flavors: ['green apple'],
          imagePath: null,
        },
      ])
      vi.mocked(createOrder).mockResolvedValue({
        id: 'order-uuid',
        orderNumber: 'DM-IGNORED', // overwritten by what the action passes in
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [],
        subtotal: 0,
        status: 'pending',
        createdAt: '2026-04-11T12:00:00Z',
        fulfilledAt: null,
      })
      vi.mocked(sendOrderReceipt).mockResolvedValue(undefined)

      const { placeOrderAction } = await import('./place-order')
      const result = await placeOrderAction(
        { ok: false },
        buildFormData({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          notes: '',
          items: [
            // Client claims absurdly low prices — should be ignored.
            { productId: 'p1', flavor: 'red bull', quantity: 2 },
            { productId: 'p2', flavor: 'green apple', quantity: 1 },
          ],
        })
      )

      expect(result.ok).toBe(true)
      expect(result.orderNumber).toMatch(/^DM-[A-F0-9]{6}$/)

      expect(getProductsByIds).toHaveBeenCalledWith(['p1', 'p2'])

      // createOrder must have received DB-truth prices and computed subtotal
      const createCall = vi.mocked(createOrder).mock.calls[0][0]
      expect(createCall.subtotal).toBe(2 * 35 + 1 * 25)
      expect(createCall.items).toEqual([
        {
          product_id: 'p1',
          product_name: 'Mega V2',
          flavor: 'red bull',
          quantity: 2,
          unit_price: 35,
          line_total: 70,
        },
        {
          product_id: 'p2',
          product_name: 'Stig',
          flavor: 'green apple',
          quantity: 1,
          unit_price: 25,
          line_total: 25,
        },
      ])

      expect(sendOrderReceipt).toHaveBeenCalledTimes(1)
    })

    it('returns ok without writing or emailing when the honeypot field is filled', async () => {
      const { placeOrderAction } = await import('./place-order')
      const result = await placeOrderAction(
        { ok: false },
        buildFormData(
          {
            firstName: 'Spam',
            lastName: 'Bot',
            email: 'spam@bot.com',
            notes: '',
            items: [{ productId: 'p1', flavor: 'red bull', quantity: 1 }],
          },
          'http://spam.example' // honeypot triggered
        )
      )

      expect(result.ok).toBe(true)
      expect(getProductsByIds).not.toHaveBeenCalled()
      expect(createOrder).not.toHaveBeenCalled()
      expect(sendOrderReceipt).not.toHaveBeenCalled()
    })

    it('returns field errors for invalid input', async () => {
      const { placeOrderAction } = await import('./place-order')
      const result = await placeOrderAction(
        { ok: false },
        buildFormData({
          firstName: '',
          lastName: '',
          email: 'not-an-email',
          notes: '',
          items: [],
        })
      )

      expect(result.ok).toBe(false)
      expect(result.fieldErrors).toBeDefined()
      expect(result.fieldErrors?.firstName).toBeDefined()
      expect(result.fieldErrors?.email).toBeDefined()
      expect(result.fieldErrors?.items).toBeDefined()
      expect(getProductsByIds).not.toHaveBeenCalled()
    })

    it('rejects when the client sends a productId that no longer exists in the DB', async () => {
      vi.mocked(getProductsByIds).mockResolvedValue([
        {
          id: 'p1',
          slug: 'mega-v2',
          name: 'Mega V2',
          subtitle: null,
          price: 35,
          flavors: ['red bull'],
          imagePath: null,
        },
        // p2 deliberately missing
      ])

      const { placeOrderAction } = await import('./place-order')
      const result = await placeOrderAction(
        { ok: false },
        buildFormData({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          notes: '',
          items: [
            { productId: 'p1', flavor: 'red bull', quantity: 1 },
            { productId: 'p2', flavor: 'green apple', quantity: 1 },
          ],
        })
      )

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/no longer available/i)
      expect(createOrder).not.toHaveBeenCalled()
    })

    it('does NOT fail the order when the email send fails — order is already persisted', async () => {
      vi.mocked(getProductsByIds).mockResolvedValue([
        {
          id: 'p1',
          slug: 'mega-v2',
          name: 'Mega V2',
          subtitle: null,
          price: 35,
          flavors: ['red bull'],
          imagePath: null,
        },
      ])
      vi.mocked(createOrder).mockResolvedValue({
        id: 'order-uuid',
        orderNumber: 'DM-XXX111',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [],
        subtotal: 0,
        status: 'pending',
        createdAt: '2026-04-11T12:00:00Z',
        fulfilledAt: null,
      })
      vi.mocked(sendOrderReceipt).mockRejectedValue(new Error('Resend down'))

      const { placeOrderAction } = await import('./place-order')
      const result = await placeOrderAction(
        { ok: false },
        buildFormData({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          notes: '',
          items: [{ productId: 'p1', flavor: 'red bull', quantity: 1 }],
        })
      )

      expect(result.ok).toBe(true)
      expect(result.orderNumber).toMatch(/^DM-[A-F0-9]{6}$/)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  npm test -- app/actions/place-order.test.ts
  ```

  Expected: FAIL — the existing stub doesn't call `getProductsByIds`/`createOrder`/`sendOrderReceipt` and uses `redirect` instead of returning `{ ok, orderNumber }`.

- [ ] **Step 3: Replace `app/actions/place-order.ts` with the real implementation**

  ```ts
  // app/actions/place-order.ts
  'use server'

  import { randomBytes } from 'node:crypto'
  import { orderSchema, type OrderInput } from '@/lib/schemas/order'
  import { getProductsByIds } from '@/lib/data/products'
  import { createOrder } from '@/lib/data/orders'
  import { sendOrderReceipt } from '@/lib/email/send-order-receipt'

  export type PlaceOrderState = {
    ok: boolean
    error?: string
    fieldErrors?: Partial<Record<keyof OrderInput, string[]>>
    orderNumber?: string
  }

  function generateOrderNumber(): string {
    return `DM-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  export async function placeOrderAction(
    _prevState: PlaceOrderState,
    formData: FormData
  ): Promise<PlaceOrderState> {
    // 1. Honeypot bail-out — silent success so bots can't tell they were caught
    const honeypot = formData.get('website')
    if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
      return { ok: true, orderNumber: generateOrderNumber() }
    }

    // 2. Parse JSON payload
    const raw = formData.get('payload')
    if (typeof raw !== 'string') {
      return { ok: false, error: 'Missing payload' }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'Invalid JSON payload' }
    }

    // 3. Zod validate
    const result = orderSchema.safeParse(parsed)
    if (!result.success) {
      return {
        ok: false,
        error: 'Please fix the highlighted fields',
        fieldErrors: result.error.flatten()
          .fieldErrors as PlaceOrderState['fieldErrors'],
      }
    }
    const input = result.data

    // 4. Re-fetch products from the DB — never trust client prices
    const productIds = Array.from(new Set(input.items.map((i) => i.productId)))
    const products = await getProductsByIds(productIds)
    const productById = new Map(products.map((p) => [p.id, p]))

    // 5. Verify every claimed product exists
    for (const item of input.items) {
      if (!productById.has(item.productId)) {
        return {
          ok: false,
          error: 'One or more items are no longer available. Please refresh and try again.',
        }
      }
    }

    // 6. Build server-computed items snapshot
    const itemsSnapshot = input.items.map((item) => {
      const product = productById.get(item.productId)!
      const lineTotal = product.price * item.quantity
      return {
        product_id: product.id,
        product_name: product.name,
        flavor: item.flavor,
        quantity: item.quantity,
        unit_price: product.price,
        line_total: lineTotal,
      }
    })
    const subtotal = itemsSnapshot.reduce((sum, line) => sum + line.line_total, 0)

    // 7. Insert into DB
    const orderNumber = generateOrderNumber()
    try {
      await createOrder({
        orderNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        notes: input.notes ?? null,
        items: itemsSnapshot,
        subtotal,
      })
    } catch (err) {
      console.error('[placeOrder] createOrder failed:', err)
      return {
        ok: false,
        error: 'Could not save your order. Please try again in a moment.',
      }
    }

    // 8. Send receipt email — log + continue on failure
    try {
      await sendOrderReceipt({
        orderNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        notes: input.notes ?? null,
        items: itemsSnapshot,
        subtotal,
      })
    } catch (err) {
      console.error('[placeOrder] sendOrderReceipt failed:', err)
      // Intentionally swallow — order is already persisted; admin can resend
    }

    return { ok: true, orderNumber }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npm test -- app/actions/place-order.test.ts
  ```

  Expected: 5 passed.

- [ ] **Step 5: Update `components/cart/checkout-form.tsx` to react to the new return shape and clear the cart on success**

  Replace the file's contents with:

  ```tsx
  // components/cart/checkout-form.tsx
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
      // Honeypot field — empty for real submissions
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
          {/* Visible fields */}
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
  ```

  > **Note on honeypot wiring:** the test in Step 1 sets `website` directly via `formData.set('website', honeypot)` and bypasses RHF entirely, so we don't need RHF to know about it. The hidden `<input name="website">` is included in the form's native FormData when the form submits — but because we use `form.handleSubmit(onSubmit)` and build the FormData manually inside `onSubmit`, the hidden field isn't picked up automatically. We have to explicitly set `formData.set('website', '')` (or read it off `event.target` in a `<form action={...}>` setup). The simplest correct path: keep the manual FormData build and set `website: ''` for legitimate submissions; bots that fire native form submission will trip the action's check via the rendered hidden input.
  >
  > Wait — that's contradictory. Let me re-read it.
  >
  > **Resolution:** since we hand-build the FormData, the hidden DOM input is never read on the legitimate path. Real bots scraping the rendered HTML and POSTing to the action endpoint directly *will* include the input's value (whatever they fill it with) in the multipart body, so the action sees the honeypot. Legitimate submissions go through `onSubmit` which sets `website: ""`. This is the right behavior — the hidden input exists for bots to find and fill, and the action checks `formData.get('website')` regardless of the path.

- [ ] **Step 6: Run the full test suite to make sure nothing else broke**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 7: Build to catch type errors**

  ```bash
  npm run build
  ```

  Expected: clean build (Phase 2 still imports the seed file at this point — that swap happens in Task 16. The build should still succeed.).

- [ ] **Step 8: Commit**

  ```bash
  git add app/actions/place-order.ts app/actions/place-order.test.ts components/cart/checkout-form.tsx
  git commit -m "feat(phase-2): wire placeOrder to supabase + resend with honeypot

  - Server-side price re-fetch via getProductsByIds — client-supplied
    prices are never used to compute the subtotal
  - Items snapshot frozen at insert time (snake_case JSONB)
  - Email send failure does not fail the order (data integrity > delivery)
  - Honeypot 'website' field bails before any DB or email work
  - Crypto.randomBytes order numbers (~16M entropy)
  - CheckoutForm reacts to ok+orderNumber, clears cart, pushes to
    /order-success"
  ```

---

## Task 15: Real `sendInquiry` Server Action + inquiry form change (TDD)

**Files:**
- Modify: `app/actions/send-inquiry.ts`
- Create: `app/actions/send-inquiry.test.ts`
- Modify: `components/inquiry/inquiry-form.tsx`

- [ ] **Step 1: Write the failing test**

  Create `app/actions/send-inquiry.test.ts`:

  ```ts
  // app/actions/send-inquiry.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest'

  vi.mock('@/lib/data/inquiries', () => ({
    createInquiry: vi.fn(),
  }))
  vi.mock('@/lib/email/send-inquiry-notification', () => ({
    sendInquiryNotification: vi.fn(),
  }))

  const { createInquiry } = await import('@/lib/data/inquiries')
  const { sendInquiryNotification } = await import('@/lib/email/send-inquiry-notification')

  function buildFormData(payload: unknown, honeypot = '') {
    const fd = new FormData()
    fd.set('payload', JSON.stringify(payload))
    fd.set('website', honeypot)
    return fd
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendInquiryAction', () => {
    it('inserts the inquiry and emails the admin', async () => {
      vi.mocked(createInquiry).mockResolvedValue({
        id: 'inq-1',
        name: 'Jane',
        businessName: 'Acme',
        email: 'jane@example.com',
        phone: null,
        requestedItem: 'Geek Bar 25k',
        details: null,
        createdAt: '2026-04-11T12:00:00Z',
      })
      vi.mocked(sendInquiryNotification).mockResolvedValue(undefined)

      const { sendInquiryAction } = await import('./send-inquiry')
      const result = await sendInquiryAction(
        { ok: false },
        buildFormData({
          name: 'Jane',
          businessName: 'Acme',
          email: 'jane@example.com',
          phone: '',
          requestedItem: 'Geek Bar 25k',
          details: '',
        })
      )

      expect(result.ok).toBe(true)
      expect(result.submittedAt).toBeTypeOf('number')
      expect(createInquiry).toHaveBeenCalledTimes(1)
      expect(sendInquiryNotification).toHaveBeenCalledTimes(1)
    })

    it('returns ok without writing or emailing when the honeypot is filled', async () => {
      const { sendInquiryAction } = await import('./send-inquiry')
      const result = await sendInquiryAction(
        { ok: false },
        buildFormData(
          {
            name: 'Spam',
            businessName: '',
            email: 'spam@bot.com',
            phone: '',
            requestedItem: 'X',
            details: '',
          },
          'http://spam.example'
        )
      )

      expect(result.ok).toBe(true)
      expect(createInquiry).not.toHaveBeenCalled()
      expect(sendInquiryNotification).not.toHaveBeenCalled()
    })

    it('returns field errors for invalid input', async () => {
      const { sendInquiryAction } = await import('./send-inquiry')
      const result = await sendInquiryAction(
        { ok: false },
        buildFormData({
          name: '',
          businessName: '',
          email: 'not-an-email',
          phone: '',
          requestedItem: '',
          details: '',
        })
      )

      expect(result.ok).toBe(false)
      expect(result.fieldErrors).toBeDefined()
      expect(result.fieldErrors?.name).toBeDefined()
      expect(result.fieldErrors?.email).toBeDefined()
      expect(result.fieldErrors?.requestedItem).toBeDefined()
      expect(createInquiry).not.toHaveBeenCalled()
    })

    it('does NOT fail the inquiry when email send fails — row is already persisted', async () => {
      vi.mocked(createInquiry).mockResolvedValue({
        id: 'inq-1',
        name: 'Jane',
        businessName: null,
        email: 'jane@example.com',
        phone: null,
        requestedItem: 'X',
        details: null,
        createdAt: '2026-04-11T12:00:00Z',
      })
      vi.mocked(sendInquiryNotification).mockRejectedValue(new Error('Resend down'))

      const { sendInquiryAction } = await import('./send-inquiry')
      const result = await sendInquiryAction(
        { ok: false },
        buildFormData({
          name: 'Jane',
          businessName: '',
          email: 'jane@example.com',
          phone: '',
          requestedItem: 'X',
          details: '',
        })
      )

      expect(result.ok).toBe(true)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  npm test -- app/actions/send-inquiry.test.ts
  ```

  Expected: FAIL — the existing stub doesn't call `createInquiry` or `sendInquiryNotification`.

- [ ] **Step 3: Replace `app/actions/send-inquiry.ts` with the real implementation**

  ```ts
  // app/actions/send-inquiry.ts
  'use server'

  import { inquirySchema, type InquiryInput } from '@/lib/schemas/inquiry'
  import { createInquiry } from '@/lib/data/inquiries'
  import { sendInquiryNotification } from '@/lib/email/send-inquiry-notification'

  export type SendInquiryState = {
    ok: boolean
    error?: string
    fieldErrors?: Partial<Record<keyof InquiryInput, string[]>>
    submittedAt?: number
  }

  export async function sendInquiryAction(
    _prevState: SendInquiryState,
    formData: FormData
  ): Promise<SendInquiryState> {
    // 1. Honeypot
    const honeypot = formData.get('website')
    if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
      return { ok: true, submittedAt: Date.now() }
    }

    // 2. Parse JSON payload
    const raw = formData.get('payload')
    if (typeof raw !== 'string') {
      return { ok: false, error: 'Missing payload' }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'Invalid JSON payload' }
    }

    // 3. Zod validate
    const result = inquirySchema.safeParse(parsed)
    if (!result.success) {
      return {
        ok: false,
        error: 'Please fix the highlighted fields',
        fieldErrors: result.error.flatten()
          .fieldErrors as SendInquiryState['fieldErrors'],
      }
    }
    const input = result.data

    // 4. Insert
    try {
      await createInquiry({
        name: input.name,
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        requestedItem: input.requestedItem,
        details: input.details,
      })
    } catch (err) {
      console.error('[sendInquiry] createInquiry failed:', err)
      return {
        ok: false,
        error: 'Could not send your inquiry. Please try again in a moment.',
      }
    }

    // 5. Notify admin — log + continue on failure
    try {
      await sendInquiryNotification({
        name: input.name,
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        requestedItem: input.requestedItem,
        details: input.details,
      })
    } catch (err) {
      console.error('[sendInquiry] sendInquiryNotification failed:', err)
      // Swallow — inquiry is persisted; admin can spot it in the dashboard
    }

    return { ok: true, submittedAt: Date.now() }
  }
  ```

- [ ] **Step 4: Add the honeypot to `components/inquiry/inquiry-form.tsx`**

  Find the `onSubmit` function and update it to set `website` in the FormData:

  ```tsx
    function onSubmit(values: InquiryInput) {
      const formData = new FormData();
      formData.set("payload", JSON.stringify(values));
      formData.set("website", "");
      startTransition(() => formAction(formData));
    }
  ```

  Then, just above the `<Button type="submit" ...>` near the bottom of the JSX, insert the visually-hidden honeypot block:

  ```tsx
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
  ```

  > Use `id="inquiry-website"` (not `id="website"`) to avoid an HTML id collision with the honeypot in CheckoutForm if both forms ever appear on the same page.

- [ ] **Step 5: Run the test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Verify the build still passes**

  ```bash
  npm run build
  ```

  Expected: clean.

- [ ] **Step 7: Commit**

  ```bash
  git add app/actions/send-inquiry.ts app/actions/send-inquiry.test.ts components/inquiry/inquiry-form.tsx
  git commit -m "feat(phase-2): wire sendInquiry to supabase + resend with honeypot

  - Persists the inquiry row first
  - Notifies ADMIN_NOTIFICATION_EMAIL with replyTo set to the customer
  - Email failure does not fail the inquiry
  - Honeypot 'website' field bails silently"
  ```

---

## Task 16: Frontend swap — `app/page.tsx`, ProductCard/ProductGrid, delete seed file

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/products/product-card.tsx`
- Modify: `components/products/product-grid.tsx`
- Delete: `lib/products.seed.ts`

> This is the irreversible swap from Phase 1's hardcoded seed to Phase 2's live Supabase reads. Do it in one task — partial swaps leave the build broken. Product images stay in `/public/products/` as placeholders — Phase 3 admin can later upload to Supabase Storage.

- [ ] **Step 1: Update `components/products/product-card.tsx` to use the new Product type**

  Two changes:

  1. Replace the import:

     ```tsx
     // before
     import type { Product } from "@/lib/products.seed";
     // after
     import type { Product } from "@/lib/data/products";
     ```

  2. The `<Image src={product.imagePath}>` stays the same — the field name and local paths are unchanged. But update the subtitle render to handle `null` (Phase 2 type is `string | null`):

     ```tsx
     // before
     <p className="mt-1 text-sm text-muted-foreground">
       {product.subtitle}
     </p>
     // after
     {product.subtitle ? (
       <p className="mt-1 text-sm text-muted-foreground">
         {product.subtitle}
       </p>
     ) : null}
     ```

- [ ] **Step 2: Update `components/products/product-grid.tsx` to use the new Product type**

  Change one line:

  ```tsx
  // before
  import type { Product } from "@/lib/products.seed";
  // after
  import type { Product } from "@/lib/data/products";
  ```

- [ ] **Step 3: Update `app/page.tsx` to fetch products from Supabase**

  Replace the entire file with:

  ```tsx
  // app/page.tsx
  import { SiteHeader } from "@/components/site/header";
  import { SiteFooter } from "@/components/site/footer";
  import { Hero } from "@/components/site/hero";
  import { ProductGrid } from "@/components/products/product-grid";
  import { InquiryForm } from "@/components/inquiry/inquiry-form";
  import { getVisibleProducts } from "@/lib/data/products";

  export default async function HomePage() {
    const products = await getVisibleProducts();

    return (
      <>
        <SiteHeader />
        <main id="main" className="flex-1">
          <Hero />
          <ProductGrid products={products} />
          <section
            id="inquiry"
            className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16"
          >
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Need something else?
                </p>
                <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                  Send a product inquiry
                </h2>
                <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                  If you don&apos;t see what you need on the site, drop the
                  details below and we&apos;ll follow up as soon as possible.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
                <InquiryForm />
              </div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }
  ```

- [ ] **Step 4: Delete the seed file**

  ```bash
  rm lib/products.seed.ts
  ```

- [ ] **Step 5: Verify TypeScript and the build are clean**

  ```bash
  npx tsc --noEmit
  npm run build
  ```

  Expected: both clean. The build will hit Supabase at build time only if the page is statically rendered — since `getVisibleProducts` calls `await cookies()` indirectly via the Supabase server client, the route opts into dynamic rendering and the build doesn't make a Supabase round-trip. Verify by checking the build output for the home route — it should appear as `λ (Dynamic)` not `○ (Static)`.

  > **If `tsc` complains about unused imports** in any file that referenced the old seed, remove the dead import. Do not leave commented-out lines.

- [ ] **Step 6: Manual sanity check**

  ```bash
  npm run dev
  ```

  Open `http://localhost:3000` and confirm:
  - All 9 products render with local placeholder images
  - The flavor selectors are populated
  - Adding to cart works
  - The cart page shows the items
  - Submitting checkout returns success and redirects to `/order-success?order=DM-XXXXXX`
  - The Supabase dashboard shows a new row in `public.orders`
  - Your inbox shows a Resend test email (or the Resend dashboard shows the send)

  Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 7: Run the test suite one more time**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 8: Commit**

  ```bash
  git add app/page.tsx components/products/product-card.tsx components/products/product-grid.tsx
  git rm lib/products.seed.ts
  git commit -m "feat(phase-2): swap home page from seed to live supabase reads

  - app/page.tsx awaits getVisibleProducts()
  - ProductCard/ProductGrid import from lib/data/products
  - Delete lib/products.seed.ts (placeholder images stay in public/products/)"
  ```

---

## Task 17: Seed the admin user in the Supabase Auth dashboard

**Files:** none (this is an environment task — Phase 3 prep)

> **STOP — user interaction required.** Per spec §6.3 step 6, the single admin user is seeded manually in the Supabase Auth dashboard now so Phase 3 can dive straight into building the admin UI. The user is the only one who can create this account because it's email + password and we shouldn't store credentials in the repo.

- [ ] **Step 1: Tell the user to open the Auth dashboard**

  ```
  https://supabase.com/dashboard/project/<ref>/auth/users
  ```

- [ ] **Step 2: Walk the user through adding the admin user**

  Instructions to relay verbatim:

  1. Click **"Add user"** → **"Create new user"**
  2. Email: the email the shop owner will sign in with
  3. Password: a strong password (the user's responsibility — do not generate or store it in the repo)
  4. Toggle **"Auto Confirm User"** ON (so they don't need an email-confirm step)
  5. Click **Create user**

- [ ] **Step 3: Confirm the user exists**

  Have the user run this in the SQL Editor (it shows the row in `auth.users` without exposing the password hash):

  ```sql
  select id, email, created_at, confirmed_at
    from auth.users
    order by created_at desc
    limit 5;
  ```

  Expected: 1 row with the email the user just entered, `confirmed_at` not null.

- [ ] **Step 4: No commit needed**

  This task changes only the remote Supabase project. Skip the commit and proceed to Task 18.

---

## Task 18: Phase 2 verification + definition-of-done check

**Files:** none — this is the verification gate before merging Phase 2.

> **REQUIRED SUB-SKILL:** invoke `superpowers:verification-before-completion` and follow it to the letter. The steps below are the Phase-2-specific evidence the skill will ask for.

- [ ] **Step 1: Run the full test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass. Capture the count.

- [ ] **Step 2: Run the production build**

  ```bash
  npm run build
  ```

  Expected: clean build. The home route should appear as `λ (Dynamic)` because it reads cookies via the Supabase server client.

- [ ] **Step 3: Run the linter**

  ```bash
  npm run lint
  ```

  Expected: clean.

- [ ] **Step 4: Boot the dev server and walk the full happy path manually**

  ```bash
  npm run dev
  ```

  Test checklist (mark each):
  - [ ] Catalog renders 9 products from Supabase (Network tab shows Supabase Storage URLs for `<img>` tags)
  - [ ] Pick a flavor → set qty 2 → Add to cart → toast appears
  - [ ] Header cart badge shows the count
  - [ ] `/cart` shows the item with the right unit price and line total
  - [ ] Fill out the checkout form with a real test email you control
  - [ ] Submit → redirected to `/order-success?order=DM-XXXXXX`
  - [ ] The cart is empty after redirect
  - [ ] Supabase dashboard → `public.orders` has the new row with the right `subtotal`, `items` JSONB, and `order_number`
  - [ ] Resend dashboard (or your inbox) shows the receipt email
  - [ ] Back on the home page, fill out the Inquiry form → submit → "Inquiry sent" toast
  - [ ] `public.inquiries` has a new row
  - [ ] Resend dashboard shows the admin notification email
  - [ ] Refresh the cart page after adding an item — cart persists across reload
  - [ ] Try the price-tampering attack: in DevTools, edit `localStorage` for the `directms-cart` key, set `unitPrice` to `0.01` for a line, refresh, click checkout. The Supabase row should show the **real** price, not `0.01`. (This is the load-bearing security test.)

  Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 5: Verify no service-role key is anywhere in the repo**

  ```bash
  grep -r "service_role" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.example" --include=".env*" . || echo "no matches"
  ```

  Expected: `no matches`. If there's any hit, stop and remove it.

- [ ] **Step 6: Verify `.env.local` is gitignored and not staged**

  ```bash
  git check-ignore .env.local && echo "ignored"
  git status --short
  ```

  Expected: `.env.local` is `ignored` and does not appear in `git status`.

- [ ] **Step 7: Run the `requesting-code-review` skill on the branch**

  Invoke `superpowers:requesting-code-review` and pass the branch (`phase-2-supabase-resend`). Address any blocker findings before declaring done.

- [ ] **Step 8: No commit at this task**

  Verification produces no code. The next task updates `CLAUDE.md`.

---

## Task 19: Update `CLAUDE.md` to mark Phase 2 complete

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the delivery phases table in `CLAUDE.md`**

  Find this block:

  ```markdown
  | **Phase 2** — Supabase + Resend | Not started | Real backend, real emails, public site is live |
  ```

  Replace with:

  ```markdown
  | **Phase 2** — Supabase + Resend | Complete | Real backend, real emails, public site is live |
  ```

  And update the Phase 1 row if it still says `Not started`:

  ```markdown
  | **Phase 1** — Frontend only | Complete | Hardcoded products, stubbed Server Actions, full UI walkthrough |
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs(phase-2): mark Phase 2 complete in delivery table"
  ```

- [ ] **Step 3: Hand off to the user**

  Phase 2 is done. Tell the user:
  - The branch is ready for review/merge: `phase-2-supabase-resend`
  - Open a PR or merge directly per the user's normal flow
  - Phase 3 (admin dashboard + Netlify deploy) is the next plan to write

---

## Phase 2 — Definition of Done (recap from spec §6.9)

- [x] Catalog loads from Supabase
- [x] `placeOrder` writes an `orders` row and sends a real customer email
- [x] `sendInquiry` writes an `inquiries` row and sends a real admin email
- [x] Invalid inputs return field-level errors via `useActionState`
- [x] Full end-to-end smoke test via `verification-before-completion` skill
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Service-role key is nowhere in the repo
- [x] Architectural invariants (CLAUDE.md) all hold

---

## Self-review notes (planner)

**Spec coverage check:**
- §6.1 Dependencies → Task 1
- §6.2 Environment variables → Task 3
- §6.3 Supabase project setup (create project / migrate / seed migration / seed admin user) → Tasks 6, 7, 17
- §6.4 Supabase client files → Task 4
- §6.5 Data access layer → Tasks 8, 9, 10
- §6.6 Frontend swap → Task 16
- §6.7 Email templates → Tasks 12, 13
- §6.8 Real Server Actions → Tasks 14, 15
- §6.9 Phase 2 DoD → Task 18

**Architectural invariants check:**
- Server Components own all reads ✓ (Task 16 — `app/page.tsx` awaits `getVisibleProducts()`)
- Server Actions own all mutations ✓ (Tasks 14, 15 — no REST routes added)
- Client-supplied prices never trusted ✓ (Task 14 — explicitly tested via the "absurdly low prices" case)
- RLS is the only enforcement surface ✓ (Task 5 — anon role can only INSERT on orders/inquiries)
- Service-role key never imported ✓ (Task 18 step 5 — grep verifies)
- Orders are immutable JSONB snapshots ✓ (Task 9 — items stored as snake_case JSONB; never mutated by admin helpers)
- `proxy.ts` not added in Phase 2 ✓ (Phase 3 work; `session.ts` is scaffolded in Task 4 per spec but has no caller yet)
- Async cookies/headers/params ✓ (Task 4 — `await cookies()`)

**TDD coverage check:**
- Zod schemas → exercised indirectly via Task 14/15 action tests
- Data access (`lib/data/*`) → Tasks 8, 9, 10 (each begins with a failing test before any code exists)
- Email helpers → Tasks 12, 13
- Server Actions → Tasks 14, 15

**Things deliberately NOT in the plan (YAGNI):**
- Real rate limiting (Upstash/Vercel KV) — explicitly out of scope per spec §8.2
- Playwright E2E — out of scope per spec §8.3
- A retry loop on order_number unique-violation — 16M entropy is enough
- Component tests for ProductCard / CheckoutForm UI — UI exemption per spec §8.3
- A `react-email dev` workflow — adding it would mean another devDep and another script. Templates are tested via the helper, which is enough
- Caching policies on the catalog read — Cache Components is not enabled, and the route is dynamic by nature

**Risks the implementer should know about:**
- The honeypot is the simplest possible spam control. If real bot traffic gets through, Phase 2's MVP is intentionally fragile here — talk to the user before adding more
- The data layer test mock is hand-rolled and depends on the chainable surface area we use today. If a future task adds a method like `.range()` or `.rpc()`, the mock helper needs an extra entry in `CHAINABLE_METHODS`. The test suite will fail loudly if a method is missing
- Placeholder images live in `/public/products/` and are NOT uploaded to Supabase Storage in Phase 2. Phase 3 admin upload will create the storage bucket and move to remote images

---

**End of plan.**
