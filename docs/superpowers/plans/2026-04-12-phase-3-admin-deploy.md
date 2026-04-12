# DirectMS Phase 3 — Admin Dashboard + Netlify Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected admin dashboard with full CRUD on products (including image upload), orders, and inquiries, then ship the production deploy to Netlify.

**Architecture:** `proxy.ts` intercepts `/admin/:path*` requests and redirects unauthenticated users to `/admin/login`. The admin layout is a defense-in-depth Server Component that re-checks auth. Every admin Server Action in `app/actions/admin/*.ts` begins with its own `supabase.auth.getUser()` check — Server Actions are reachable via direct POST independent of the UI. Admin pages are async Server Components that fetch data via the existing `lib/data/*` layer. Mutations go through Server Actions only. RLS enforces access — the service-role key is **never** imported. Image uploads go to a public Supabase Storage bucket via the authenticated SSR client.

**Tech Stack:** Next.js 16.2.3 (App Router, `proxy.ts`), React 19.2, TypeScript 5, Supabase (Postgres + Storage + Auth) via `@supabase/ssr`, shadcn (radix-nova), Tailwind v4, Zod, Vitest 4, Netlify + `@netlify/plugin-nextjs`.

---

## Important context for implementers

**Next.js 16 is NOT the Next.js you know.** Before writing any Next.js-specific code, read the relevant files in `node_modules/next/dist/docs/01-app/` (per `AGENTS.md`). The docs that matter most for Phase 3:

- `03-api-reference/03-file-conventions/proxy.md` — The file is `proxy.ts` (NOT `middleware.ts`). The exported function is named `proxy` (NOT `middleware`). Runtime is Node.js only (Edge is not supported). The `config.matcher` uses the same path-to-regexp syntax as before.
- `03-api-reference/04-functions/cookies.md` — `cookies()` is async. Always `await` it.
- `02-guides/authentication.md` — Auth patterns in Next.js 16 use the `proxy.ts` file. Proxy is optimistic only — verify auth inside Server Actions and Server Components.
- `01-getting-started/16-proxy.md` — Getting started guide for proxy.

**Architectural invariants from CLAUDE.md (non-negotiable):**

1. **Every admin Server Action begins with an auth check.** `const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Unauthorized')`. Server Actions are reachable via direct POST, so the proxy redirect and layout guard are defense-in-depth, NOT substitutes.
2. **Server Components own all reads.** Admin list/detail views are async Server Components fetching from Supabase.
3. **Server Actions own all mutations.** No custom REST routes.
4. **Client-supplied prices are never trusted.** `createProduct`/`updateProduct` validate prices server-side via Zod.
5. **RLS is the only enforcement surface.** The service-role key is **never** imported. All operations use the anon key + the cookie-aware SSR client.
6. **`proxy.ts`, not `middleware.ts`.** The function export is `proxy`, not `middleware`.
7. **Async request APIs.** `cookies()`, `headers()`, `params`, `searchParams` are all Promises — every call must be `await`ed.

**What Phase 2 already built (don't duplicate):**

The entire data access layer is scaffolded in `lib/data/`:
- `products.ts` — `getAllProducts()`, `getProductById()`, `createProduct()`, `updateProduct()`, `deleteProduct()`, `toggleProductVisibility()` (all implemented)
- `orders.ts` — `getOrders()`, `getOrderById()`, `markOrderFulfilled()`, `deleteOrder()` (all implemented)
- `inquiries.ts` — `getInquiries()`, `getInquiryById()`, `deleteInquiry()` (all implemented)

The Supabase client trio is ready:
- `lib/supabase/server.ts` — `createServerSupabaseClient()` (cookie-aware SSR client)
- `lib/supabase/client.ts` — `createBrowserSupabaseClient()` (browser client for login form)
- `lib/supabase/session.ts` — `updateSession(request)` (session refresher, called from `proxy.ts`)

Phase 3 wraps these data functions in auth-checked Server Actions and builds the admin UI on top.

**Test strategy — TDD for backend, build-check for UI.**

| Layer | Mechanism |
|---|---|
| Admin Server Actions (`app/actions/admin/*`) | Vitest with `vi.mock('@/lib/data/*')` and `vi.mock('@/lib/supabase/server')` — test auth checks, Zod validation, revalidation calls |
| Admin UI pages | `npm run build` + manual dev-server walkthrough |
| End-to-end | Manual smoke walk-through at Task 16 |

Test files mock the Supabase auth by mocking `createServerSupabaseClient` to return a fake client whose `auth.getUser()` resolves to either a user or null.

**Mock pattern for admin action tests:**

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

function mockAuth(user: { id: string; email: string } | null) {
  const { createServerSupabaseClient } = await import('@/lib/supabase/server')
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  } as any)
}
```

**Commit cadence.** Each task ends with a commit. One task, one commit.

**Do NOT invent files or features not specified in this plan.** YAGNI.

---

## File structure

### New files

```
proxy.ts                                    — Admin route protection
lib/supabase/storage.ts                     — Image URL helper
lib/schemas/admin.ts                        — Login + product form schemas

app/actions/admin/auth.ts                   — signIn, signOut actions
app/actions/admin/auth.test.ts              — Auth action tests
app/actions/admin/products.ts               — Product CRUD actions
app/actions/admin/products.test.ts          — Product action tests
app/actions/admin/orders.ts                 — Order management actions
app/actions/admin/orders.test.ts            — Order action tests
app/actions/admin/inquiries.ts              — Inquiry management actions
app/actions/admin/inquiries.test.ts         — Inquiry action tests

app/admin/layout.tsx                        — Auth guard + sidebar + top bar
app/admin/page.tsx                          — Redirect to /admin/orders
app/admin/login/page.tsx                    — Login page (outside layout guard)
app/admin/login/layout.tsx                  — Minimal layout for login (no sidebar)
app/admin/(dashboard)/layout.tsx            — Dashboard layout with sidebar
app/admin/(dashboard)/orders/page.tsx       — Orders list
app/admin/(dashboard)/orders/[id]/page.tsx  — Order detail
app/admin/(dashboard)/products/page.tsx     — Products list
app/admin/(dashboard)/products/new/page.tsx — New product form
app/admin/(dashboard)/products/[id]/page.tsx — Edit product form
app/admin/(dashboard)/inquiries/page.tsx    — Inquiries list
app/admin/(dashboard)/inquiries/[id]/page.tsx — Inquiry detail

components/admin/login-form.tsx             — Client Component, email/password form
components/admin/sidebar.tsx                — Sidebar navigation links
components/admin/product-form.tsx           — Client Component, product create/edit form
components/admin/image-upload.tsx           — Client Component, file input + preview
components/admin/tag-input.tsx              — Client Component, flavor tag input
components/admin/visibility-toggle.tsx      — Client Component, Switch for is_visible
components/admin/delete-dialog.tsx          — Client Component, alert-dialog wrapper

supabase/migrations/006_storage.sql         — Product images storage bucket + RLS
```

### Modified files

```
app/admin/layout.tsx                        — (new, but wraps admin routes)
```

### Notes on route groups

The admin area uses a route group `(dashboard)` to separate the login page from the authenticated dashboard. This gives login its own layout (no sidebar) while the dashboard pages share the sidebar layout:

- `/admin/login` → `app/admin/login/layout.tsx` (minimal, no auth check)
- `/admin/orders`, `/admin/products`, `/admin/inquiries` → `app/admin/(dashboard)/layout.tsx` (sidebar + auth guard)
- `app/admin/layout.tsx` wraps everything — just the `<html>` shell
- `app/admin/page.tsx` redirects to `/admin/orders`

---

## Task 1: Install shadcn primitives

**Files:**
- Modify: `components/ui/*.tsx` (auto-generated by shadcn CLI)
- Modify: `package.json` (auto-updated)

- [ ] **Step 1: Install the required shadcn components**

```bash
npx shadcn@latest add table dialog alert-dialog dropdown-menu switch sheet skeleton tabs --yes
```

Expected: 8 components installed under `components/ui/`.

- [ ] **Step 2: Verify the components exist**

```bash
ls components/ui/table.tsx components/ui/dialog.tsx components/ui/alert-dialog.tsx components/ui/dropdown-menu.tsx components/ui/switch.tsx components/ui/sheet.tsx components/ui/skeleton.tsx components/ui/tabs.tsx
```

Expected: All 8 files listed without errors.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/ package.json package-lock.json
git commit -m "chore(phase-3): install shadcn table, dialog, alert-dialog, dropdown-menu, switch, sheet, skeleton, tabs"
```

---

## Task 2: Storage bucket migration + image URL helper

**Files:**
- Create: `supabase/migrations/006_storage.sql`
- Create: `lib/supabase/storage.ts`

- [ ] **Step 1: Create the storage bucket migration**

Create `supabase/migrations/006_storage.sql`:

```sql
-- 006_storage.sql
-- Public storage bucket for product images. Authenticated users can
-- upload/update/delete; everyone can read (public bucket).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Authenticated users can upload files
create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Authenticated users can update files
create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

-- Authenticated users can delete files
create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- Everyone can read (public bucket)
create policy "Public read access for product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');
```

- [ ] **Step 2: Create the image URL helper**

Create `lib/supabase/storage.ts`:

```typescript
// lib/supabase/storage.ts

/**
 * Construct the public URL for a product image stored in Supabase Storage.
 * Uses NEXT_PUBLIC_ env vars so it works in both server and client contexts.
 */
export function getProductImageUrl(imagePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_storage.sql lib/supabase/storage.ts
git commit -m "feat(phase-3): add product-images storage bucket migration + URL helper"
```

---

## Task 3: Admin auth schemas

**Files:**
- Create: `lib/schemas/admin.ts`
- Create: `lib/schemas/admin.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/admin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { loginSchema, productFormSchema } from './admin'

describe('loginSchema', () => {
  it('accepts valid email + password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@directms.com',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'secret123' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@directms.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('productFormSchema', () => {
  it('accepts a valid product', () => {
    const result = productFormSchema.safeParse({
      name: 'Mega V2',
      slug: 'mega-v2',
      subtitle: '10 Packs',
      price: '35.00',
      flavors: '["red bull", "grape"]',
      isVisible: 'on',
      sortOrder: '0',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.price).toBe(35)
      expect(result.data.flavors).toEqual(['red bull', 'grape'])
      expect(result.data.isVisible).toBe(true)
      expect(result.data.sortOrder).toBe(0)
    }
  })

  it('rejects empty name', () => {
    const result = productFormSchema.safeParse({
      name: '',
      slug: 'test',
      price: '10',
      flavors: '["mint"]',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid slug format', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'INVALID SLUG!',
      price: '10',
      flavors: '["mint"]',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'test',
      price: '-5',
      flavors: '["mint"]',
    })
    expect(result.success).toBe(false)
  })

  it('coerces string price to number', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'test',
      price: '29.99',
      flavors: '["mint"]',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.price).toBe(29.99)
    }
  })

  it('defaults isVisible to false when missing', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'test',
      price: '10',
      flavors: '["mint"]',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isVisible).toBe(false)
    }
  })

  it('rejects empty flavors array', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'test',
      price: '10',
      flavors: '[]',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid flavors JSON', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'test',
      price: '10',
      flavors: 'not json',
    })
    expect(result.success).toBe(false)
  })

  it('treats empty subtitle as undefined', () => {
    const result = productFormSchema.safeParse({
      name: 'Test',
      slug: 'test',
      price: '10',
      flavors: '["mint"]',
      subtitle: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subtitle).toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/schemas/admin.test.ts
```

Expected: FAIL — module `./admin` not found.

- [ ] **Step 3: Write the schemas**

Create `lib/schemas/admin.ts`:

```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

/**
 * Product form schema. Values arrive as strings from FormData,
 * so price and sortOrder use `z.coerce`. Flavors arrives as a
 * JSON-stringified array. isVisible arrives as "on" (checkbox
 * checked) or is missing (unchecked).
 */
export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers, and hyphens'
    ),
  subtitle: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  flavors: z
    .string()
    .transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val)
        if (!Array.isArray(parsed) || parsed.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Enter at least one flavor',
          })
          return z.NEVER
        }
        return parsed as string[]
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid flavors format',
        })
        return z.NEVER
      }
    }),
  isVisible: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((val) => val === 'on' || val === 'true' || val === true)
    .default(false),
  sortOrder: z.coerce.number().int().default(0),
})

export type ProductFormInput = z.infer<typeof productFormSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/schemas/admin.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/admin.ts lib/schemas/admin.test.ts
git commit -m "feat(phase-3): add login + product form Zod schemas with tests"
```

---

## Task 4: Admin auth Server Actions — signIn, signOut

**Files:**
- Create: `app/actions/admin/auth.ts`
- Create: `app/actions/admin/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/actions/admin/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

// Mock next/navigation redirect — it throws a special error in Next.js
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { redirect } = await import('next/navigation')

function buildFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

function mockSupabaseAuth(
  signInResult: { user: any; session: any } | null,
  signInError: { message: string } | null = null
) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: signInResult ? { user: signInResult.user, session: signInResult.session } : { user: null, session: null },
        error: signInError,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signInAction', () => {
  it('redirects to /admin on successful login', async () => {
    mockSupabaseAuth({ user: { id: 'u1', email: 'admin@test.com' }, session: {} })
    const { signInAction } = await import('./auth')

    await expect(
      signInAction({ ok: false }, buildFormData({ email: 'admin@test.com', password: 'secret' }))
    ).rejects.toThrow('NEXT_REDIRECT:/admin')

    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('returns error on invalid credentials', async () => {
    mockSupabaseAuth(null, { message: 'Invalid login credentials' })
    const { signInAction } = await import('./auth')

    const result = await signInAction(
      { ok: false },
      buildFormData({ email: 'bad@test.com', password: 'wrong' })
    )

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid/i)
  })

  it('returns field errors for invalid email format', async () => {
    const { signInAction } = await import('./auth')
    const result = await signInAction(
      { ok: false },
      buildFormData({ email: 'not-an-email', password: 'secret' })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.email).toBeDefined()
  })

  it('returns field errors for empty password', async () => {
    const { signInAction } = await import('./auth')
    const result = await signInAction(
      { ok: false },
      buildFormData({ email: 'admin@test.com', password: '' })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.password).toBeDefined()
  })
})

describe('signOutAction', () => {
  it('calls signOut and redirects to /admin/login', async () => {
    mockSupabaseAuth({ user: { id: 'u1' }, session: {} })
    const { signOutAction } = await import('./auth')

    await expect(signOutAction()).rejects.toThrow('NEXT_REDIRECT:/admin/login')
    expect(redirect).toHaveBeenCalledWith('/admin/login')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/actions/admin/auth.test.ts
```

Expected: FAIL — module `./auth` not found.

- [ ] **Step 3: Implement the auth actions**

Create `app/actions/admin/auth.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loginSchema, type LoginInput } from '@/lib/schemas/admin'

export type SignInState = {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof LoginInput, string[]>>
}

export async function signInAction(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as SignInState['fieldErrors'],
    }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    return { ok: false, error: 'Invalid email or password' }
  }

  redirect('/admin')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/actions/admin/auth.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/admin/auth.ts app/actions/admin/auth.test.ts
git commit -m "feat(phase-3): add signIn + signOut admin Server Actions with tests"
```

---

## Task 5: Admin product Server Actions

**Files:**
- Create: `app/actions/admin/products.ts`
- Create: `app/actions/admin/products.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/actions/admin/products.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/data/products', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  toggleProductVisibility: vi.fn(),
  getProductById: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { createProduct, updateProduct, deleteProduct, toggleProductVisibility, getProductById } =
  await import('@/lib/data/products')
const { revalidatePath } = await import('next/cache')

function mockAuth(user: { id: string; email: string } | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'products/test.jpg' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  } as any)
}

function buildProductFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  fd.set('name', overrides.name as string ?? 'Test Product')
  fd.set('slug', overrides.slug as string ?? 'test-product')
  fd.set('subtitle', overrides.subtitle as string ?? '')
  fd.set('price', overrides.price as string ?? '25.00')
  fd.set('flavors', overrides.flavors as string ?? '["mint","grape"]')
  fd.set('sortOrder', overrides.sortOrder as string ?? '0')
  if (overrides.isVisible) fd.set('isVisible', overrides.isVisible as string)
  if (overrides.image) fd.set('image', overrides.image)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createProductAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { createProductAction } = await import('./products')
    await expect(createProductAction({ ok: false }, new FormData())).rejects.toThrow('Unauthorized')
  })

  it('validates input and creates product', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    vi.mocked(createProduct).mockResolvedValue({
      id: 'p1', slug: 'test-product', name: 'Test Product', subtitle: null,
      price: 25, flavors: ['mint', 'grape'], imagePath: null,
    })

    const { createProductAction } = await import('./products')
    const fd = buildProductFormData({ isVisible: 'on' })
    const result = await createProductAction({ ok: false }, fd)

    expect(result.ok).toBe(true)
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Product',
        slug: 'test-product',
        price: 25,
        flavors: ['mint', 'grape'],
        isVisible: true,
      })
    )
    expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns field errors for invalid input', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { createProductAction } = await import('./products')
    const fd = buildProductFormData({ name: '', slug: 'INVALID!', price: '-5' })
    const result = await createProductAction({ ok: false }, fd)

    expect(result.ok).toBe(false)
    expect(result.fieldErrors).toBeDefined()
  })
})

describe('updateProductAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { updateProductAction } = await import('./products')
    await expect(updateProductAction('p1', { ok: false }, new FormData())).rejects.toThrow('Unauthorized')
  })

  it('validates and updates product', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    vi.mocked(updateProduct).mockResolvedValue({
      id: 'p1', slug: 'test-product', name: 'Updated', subtitle: null,
      price: 30, flavors: ['mint'], imagePath: null,
    })

    const { updateProductAction } = await import('./products')
    const fd = buildProductFormData({ name: 'Updated', price: '30', flavors: '["mint"]' })
    const result = await updateProductAction('p1', { ok: false }, fd)

    expect(result.ok).toBe(true)
    expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Updated', price: 30 }))
  })
})

describe('deleteProductAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { deleteProductAction } = await import('./products')
    await expect(deleteProductAction('p1')).rejects.toThrow('Unauthorized')
  })

  it('deletes the product and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    vi.mocked(getProductById).mockResolvedValue({
      id: 'p1', slug: 'test', name: 'Test', subtitle: null,
      price: 10, flavors: [], imagePath: 'products/old.jpg',
    })
    const { deleteProductAction } = await import('./products')
    await deleteProductAction('p1')

    expect(deleteProduct).toHaveBeenCalledWith('p1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})

describe('toggleProductVisibilityAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { toggleProductVisibilityAction } = await import('./products')
    await expect(toggleProductVisibilityAction('p1', true)).rejects.toThrow('Unauthorized')
  })

  it('toggles visibility and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { toggleProductVisibilityAction } = await import('./products')
    await toggleProductVisibilityAction('p1', false)

    expect(toggleProductVisibility).toHaveBeenCalledWith('p1', false)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/actions/admin/products.test.ts
```

Expected: FAIL — module `./products` not found.

- [ ] **Step 3: Implement the product admin actions**

Create `app/actions/admin/products.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { productFormSchema, type ProductFormInput } from '@/lib/schemas/admin'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductVisibility,
  getProductById,
} from '@/lib/data/products'

async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return supabase
}

export type ProductActionState = {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ProductFormInput, string[]>>
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await requireAuth()

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    price: formData.get('price'),
    flavors: formData.get('flavors'),
    isVisible: formData.get('isVisible'),
    sortOrder: formData.get('sortOrder'),
  }

  const result = productFormSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as ProductActionState['fieldErrors'],
    }
  }

  // Handle image upload
  let imagePath: string | null = null
  const imageFile = formData.get('image')
  if (imageFile instanceof File && imageFile.size > 0) {
    const ext = imageFile.name.split('.').pop() ?? 'jpg'
    const storagePath = `products/${result.data.slug}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, imageFile, { upsert: true })
    if (uploadError) {
      return { ok: false, error: `Image upload failed: ${uploadError.message}` }
    }
    imagePath = storagePath
  }

  try {
    await createProduct({
      name: result.data.name,
      slug: result.data.slug,
      subtitle: result.data.subtitle ?? null,
      price: result.data.price,
      flavors: result.data.flavors,
      imagePath,
      isVisible: result.data.isVisible,
      sortOrder: result.data.sortOrder,
    })
  } catch (err) {
    console.error('[createProductAction]', err)
    return { ok: false, error: 'Could not create product. The slug may already be taken.' }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { ok: true }
}

export async function updateProductAction(
  id: string,
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await requireAuth()

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    price: formData.get('price'),
    flavors: formData.get('flavors'),
    isVisible: formData.get('isVisible'),
    sortOrder: formData.get('sortOrder'),
  }

  const result = productFormSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as ProductActionState['fieldErrors'],
    }
  }

  // Handle image upload/replacement
  let imagePath: string | null = null
  const imageFile = formData.get('image')
  const existingImagePath = formData.get('existingImagePath') as string | null

  if (imageFile instanceof File && imageFile.size > 0) {
    // Delete old image if it exists
    if (existingImagePath) {
      await supabase.storage.from('product-images').remove([existingImagePath])
    }
    const ext = imageFile.name.split('.').pop() ?? 'jpg'
    const storagePath = `products/${result.data.slug}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, imageFile, { upsert: true })
    if (uploadError) {
      return { ok: false, error: `Image upload failed: ${uploadError.message}` }
    }
    imagePath = storagePath
  } else {
    // Keep existing image
    imagePath = existingImagePath ?? null
  }

  try {
    await updateProduct(id, {
      name: result.data.name,
      slug: result.data.slug,
      subtitle: result.data.subtitle ?? null,
      price: result.data.price,
      flavors: result.data.flavors,
      imagePath,
      isVisible: result.data.isVisible,
      sortOrder: result.data.sortOrder,
    })
  } catch (err) {
    console.error('[updateProductAction]', err)
    return { ok: false, error: 'Could not update product.' }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteProductAction(id: string): Promise<void> {
  const supabase = await requireAuth()

  // Delete image from storage if it exists
  const product = await getProductById(id)
  if (product?.imagePath) {
    await supabase.storage.from('product-images').remove([product.imagePath])
  }

  await deleteProduct(id)
  revalidatePath('/admin/products')
  revalidatePath('/')
}

export async function toggleProductVisibilityAction(
  id: string,
  isVisible: boolean
): Promise<void> {
  await requireAuth()
  await toggleProductVisibility(id, isVisible)
  revalidatePath('/admin/products')
  revalidatePath('/')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/actions/admin/products.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/admin/products.ts app/actions/admin/products.test.ts
git commit -m "feat(phase-3): add admin product Server Actions (create, update, delete, toggle) with tests"
```

---

## Task 6: Admin order + inquiry Server Actions

**Files:**
- Create: `app/actions/admin/orders.ts`
- Create: `app/actions/admin/orders.test.ts`
- Create: `app/actions/admin/inquiries.ts`
- Create: `app/actions/admin/inquiries.test.ts`

- [ ] **Step 1: Write the failing tests for order actions**

Create `app/actions/admin/orders.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/data/orders', () => ({
  markOrderFulfilled: vi.fn(),
  deleteOrder: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { markOrderFulfilled, deleteOrder } = await import('@/lib/data/orders')
const { revalidatePath } = await import('next/cache')

function mockAuth(user: { id: string; email: string } | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('markOrderFulfilledAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { markOrderFulfilledAction } = await import('./orders')
    await expect(markOrderFulfilledAction('o1')).rejects.toThrow('Unauthorized')
  })

  it('marks order fulfilled and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { markOrderFulfilledAction } = await import('./orders')
    await markOrderFulfilledAction('o1')

    expect(markOrderFulfilled).toHaveBeenCalledWith('o1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders')
  })
})

describe('deleteOrderAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { deleteOrderAction } = await import('./orders')
    await expect(deleteOrderAction('o1')).rejects.toThrow('Unauthorized')
  })

  it('deletes order and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { deleteOrderAction } = await import('./orders')
    await deleteOrderAction('o1')

    expect(deleteOrder).toHaveBeenCalledWith('o1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders')
  })
})
```

- [ ] **Step 2: Write the failing tests for inquiry actions**

Create `app/actions/admin/inquiries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/data/inquiries', () => ({
  deleteInquiry: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { deleteInquiry } = await import('@/lib/data/inquiries')
const { revalidatePath } = await import('next/cache')

function mockAuth(user: { id: string; email: string } | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteInquiryAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { deleteInquiryAction } = await import('./inquiries')
    await expect(deleteInquiryAction('i1')).rejects.toThrow('Unauthorized')
  })

  it('deletes inquiry and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { deleteInquiryAction } = await import('./inquiries')
    await deleteInquiryAction('i1')

    expect(deleteInquiry).toHaveBeenCalledWith('i1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/inquiries')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run app/actions/admin/orders.test.ts app/actions/admin/inquiries.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement order actions**

Create `app/actions/admin/orders.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { markOrderFulfilled, deleteOrder } from '@/lib/data/orders'

async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
}

export async function markOrderFulfilledAction(id: string): Promise<void> {
  await requireAuth()
  await markOrderFulfilled(id)
  revalidatePath('/admin/orders')
}

export async function deleteOrderAction(id: string): Promise<void> {
  await requireAuth()
  await deleteOrder(id)
  revalidatePath('/admin/orders')
}
```

- [ ] **Step 5: Implement inquiry actions**

Create `app/actions/admin/inquiries.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteInquiry } from '@/lib/data/inquiries'

async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
}

export async function deleteInquiryAction(id: string): Promise<void> {
  await requireAuth()
  await deleteInquiry(id)
  revalidatePath('/admin/inquiries')
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run app/actions/admin/orders.test.ts app/actions/admin/inquiries.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/actions/admin/orders.ts app/actions/admin/orders.test.ts app/actions/admin/inquiries.ts app/actions/admin/inquiries.test.ts
git commit -m "feat(phase-3): add admin order + inquiry Server Actions with tests"
```

---

## Task 7: proxy.ts — admin route protection

**Files:**
- Create: `proxy.ts`

- [ ] **Step 1: Create proxy.ts**

Create `proxy.ts` at the project root:

```typescript
// proxy.ts
// Next.js 16 renamed middleware.ts → proxy.ts. The exported function
// is `proxy` (not `middleware`). Runtime is Node.js only.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

export async function proxy(request: NextRequest) {
  // Always refresh the Supabase session cookie
  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Only guard /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Check if the user has a Supabase session cookie.
    // This is an optimistic check — real auth verification happens
    // in the admin layout and every Server Action.
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (!hasSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Redirect authenticated users away from /admin/login
  if (pathname === '/admin/login') {
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (hasSession) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(phase-3): add proxy.ts with admin route protection + session refresh"
```

---

## Task 8: Admin login page + login form

**Files:**
- Create: `components/admin/login-form.tsx`
- Create: `app/admin/login/page.tsx`

- [ ] **Step 1: Create the login form Client Component**

Create `components/admin/login-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { signInAction, type SignInState } from '@/app/actions/admin/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: SignInState = { ok: false }

export function LoginForm() {
  const [state, action, isPending] = useActionState(signInAction, initialState)

  return (
    <form action={action} className="grid gap-4">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.fieldErrors?.password && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create the login page**

Create `app/admin/login/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { LoginForm } from '@/components/admin/login-form'

export const metadata: Metadata = {
  title: 'Admin Login',
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
            D
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage your catalog
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/login-form.tsx app/admin/login/page.tsx
git commit -m "feat(phase-3): add admin login page + login form component"
```

---

## Task 9: Admin layout — sidebar, top bar, auth guard

**Files:**
- Create: `components/admin/sidebar.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/(dashboard)/layout.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create the sidebar component**

Create `components/admin/sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Create the root admin layout**

This wraps ALL admin routes (login + dashboard). It provides the HTML shell only — no auth check here because the login page must render for unauthenticated users.

Create `app/admin/layout.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Admin · DirectMS',
    template: '%s · Admin · DirectMS',
  },
}

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
```

- [ ] **Step 3: Create the dashboard layout with auth guard + sidebar**

This wraps only `/admin/orders`, `/admin/products`, `/admin/inquiries` — NOT the login page.

Create `app/admin/(dashboard)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/sidebar'
import { signOutAction } from '@/app/actions/admin/auth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth: verify auth server-side (proxy.ts is optimistic)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            D
          </span>
          <span className="ml-2 text-sm font-semibold">DirectMS Admin</span>
        </div>
        <AdminSidebar />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Dashboard
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="mr-1.5 size-3.5" />
                Logout
              </Button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the admin index redirect**

Create `app/admin/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function AdminIndexPage() {
  redirect('/admin/orders')
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/sidebar.tsx app/admin/layout.tsx app/admin/page.tsx "app/admin/(dashboard)/layout.tsx"
git commit -m "feat(phase-3): add admin dashboard layout with sidebar, top bar, and auth guard"
```

---

## Task 10: Shared admin components — delete dialog, visibility toggle

**Files:**
- Create: `components/admin/delete-dialog.tsx`
- Create: `components/admin/visibility-toggle.tsx`

- [ ] **Step 1: Create the delete confirmation dialog**

Create `components/admin/delete-dialog.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

type DeleteDialogProps = {
  title: string
  description: string
  onConfirm: () => Promise<void>
}

export function DeleteDialog({ title, description, onConfirm }: DeleteDialogProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => startTransition(() => onConfirm())}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Create the visibility toggle**

Create `components/admin/visibility-toggle.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { toggleProductVisibilityAction } from '@/app/actions/admin/products'

type VisibilityToggleProps = {
  productId: string
  isVisible: boolean
}

export function VisibilityToggle({ productId, isVisible }: VisibilityToggleProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Switch
      checked={isVisible}
      disabled={isPending}
      onCheckedChange={(checked) =>
        startTransition(() => toggleProductVisibilityAction(productId, checked))
      }
    />
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/delete-dialog.tsx components/admin/visibility-toggle.tsx
git commit -m "feat(phase-3): add reusable delete dialog + product visibility toggle components"
```

---

## Task 11: Admin orders list + detail pages

**Files:**
- Create: `app/admin/(dashboard)/orders/page.tsx`
- Create: `app/admin/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Create the orders list page**

Create `app/admin/(dashboard)/orders/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { getOrders } from '@/lib/data/orders'
import { markOrderFulfilledAction, deleteOrderAction } from '@/app/actions/admin/orders'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye, CheckCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Orders' }

function FulfillButton({ orderId }: { orderId: string }) {
  const action = markOrderFulfilledAction.bind(null, orderId)
  return (
    <form action={action} className="inline">
      <Button variant="ghost" size="sm" type="submit" title="Mark fulfilled">
        <CheckCircle className="size-4 text-green-600" />
      </Button>
    </form>
  )
}

export default async function AdminOrdersPage() {
  const orders = await getOrders()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    {order.firstName} {order.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.email}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${order.subtotal.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={order.status === 'fulfilled' ? 'default' : 'secondary'}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/orders/${order.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      {order.status === 'pending' && (
                        <FulfillButton orderId={order.id} />
                      )}
                      <DeleteDialog
                        title="Delete order?"
                        description={`This will permanently delete order ${order.orderNumber}. This action cannot be undone.`}
                        onConfirm={deleteOrderAction.bind(null, order.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the order detail page**

Create `app/admin/(dashboard)/orders/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getOrderById } from '@/lib/data/orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Order Detail' }

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await getOrderById(id)
  if (!order) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Order {order.orderNumber}
        </h1>
        <Badge variant={order.status === 'fulfilled' ? 'default' : 'secondary'}>
          {order.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Customer</h2>
          <p className="font-medium">{order.firstName} {order.lastName}</p>
          <p className="text-sm text-muted-foreground">{order.email}</p>
          {order.notes && (
            <div className="pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
          <p className="text-sm">
            <span className="text-muted-foreground">Placed:</span>{' '}
            {new Date(order.createdAt).toLocaleString()}
          </p>
          {order.fulfilledAt && (
            <p className="text-sm">
              <span className="text-muted-foreground">Fulfilled:</span>{' '}
              {new Date(order.fulfilledAt).toLocaleString()}
            </p>
          )}
          <p className="text-lg font-semibold">
            Subtotal: ${order.subtotal.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Flavor</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{item.product_name}</TableCell>
                <TableCell>{item.flavor}</TableCell>
                <TableCell className="text-right font-mono">
                  ${item.unit_price.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right font-mono">
                  ${item.line_total.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/orders/"
git commit -m "feat(phase-3): add admin orders list + detail pages"
```

---

## Task 12: Admin products list page

**Files:**
- Create: `app/admin/(dashboard)/products/page.tsx`

- [ ] **Step 1: Create the products list page**

Create `app/admin/(dashboard)/products/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllProducts } from '@/lib/data/products'
import { deleteProductAction } from '@/app/actions/admin/products'
import { getProductImageUrl } from '@/lib/supabase/storage'
import { VisibilityToggle } from '@/components/admin/visibility-toggle'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil } from 'lucide-react'

export const metadata: Metadata = { title: 'Products' }

export default async function AdminProductsPage() {
  const products = await getAllProducts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new">
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            Add Product
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Flavors</TableHead>
                <TableHead className="text-center">Visible</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.imagePath ? (
                      <img
                        src={getProductImageUrl(product.imagePath)}
                        alt={product.name}
                        className="size-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        N/A
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.subtitle && (
                        <p className="text-xs text-muted-foreground">
                          {product.subtitle}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${product.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.flavors.length}
                  </TableCell>
                  <TableCell className="text-center">
                    <VisibilityToggle
                      productId={product.id}
                      isVisible={
                        /* isVisible is not on the Product type returned by
                           getAllProducts — we need to add it. See note below. */
                        true
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/products/${product.id}`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                      </Link>
                      <DeleteDialog
                        title="Delete product?"
                        description={`This will permanently delete "${product.name}". This action cannot be undone.`}
                        onConfirm={deleteProductAction.bind(null, product.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

**NOTE:** The `Product` type from `lib/data/products.ts` strips `is_visible` during the `rowToProduct` mapping (it only keeps fields needed for the public catalog). The admin product list needs `isVisible`. You must extend the `Product` type or create an `AdminProduct` type that includes `isVisible`. Add `isVisible: boolean` to the `Product` type in `lib/data/products.ts` and update the `rowToProduct` function:

In `lib/data/products.ts`, add `isVisible` to the `Product` type:
```typescript
export type Product = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  flavors: string[]
  imagePath: string | null
  isVisible: boolean   // <-- add this
}
```

And update `rowToProduct`:
```typescript
function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    price: typeof row.price === 'string' ? Number(row.price) : row.price,
    flavors: row.flavors,
    imagePath: row.image_path,
    isVisible: row.is_visible,   // <-- add this
  }
}
```

Then update the `VisibilityToggle` usage above to:
```tsx
<VisibilityToggle productId={product.id} isVisible={product.isVisible} />
```

- [ ] **Step 2: Apply the Product type update**

Edit `lib/data/products.ts` as described above.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run existing tests to confirm no regressions**

```bash
npx vitest run
```

Expected: All existing tests still pass (the new `isVisible` field is present on mock return values or doesn't affect existing tests).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(dashboard)/products/page.tsx" lib/data/products.ts
git commit -m "feat(phase-3): add admin products list page + extend Product type with isVisible"
```

---

## Task 13: Image upload + tag input + product form components

**Files:**
- Create: `components/admin/image-upload.tsx`
- Create: `components/admin/tag-input.tsx`
- Create: `components/admin/product-form.tsx`

- [ ] **Step 1: Create the image upload component**

Create `components/admin/image-upload.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X } from 'lucide-react'

type ImageUploadProps = {
  existingUrl?: string | null
  existingPath?: string | null
}

export function ImageUpload({ existingUrl, existingPath }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null)
  const [hasNewFile, setHasNewFile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPreview(URL.createObjectURL(file))
      setHasNewFile(true)
    }
  }

  function handleRemove() {
    setPreview(null)
    setHasNewFile(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Product preview"
            className="h-32 w-32 rounded-lg border border-border object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 size-6"
            onClick={handleRemove}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <div
          className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-6" />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {!hasNewFile && existingPath && (
        <input type="hidden" name="existingImagePath" value={existingPath} />
      )}
      {!preview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Choose image
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the tag input component**

Create `components/admin/tag-input.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

type TagInputProps = {
  initialTags?: string[]
}

export function TagInput({ initialTags = [] }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const trimmed = value.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const input = inputRef.current
      if (input && input.value.trim()) {
        addTag(input.value)
        input.value = ''
      }
    }
    if (e.key === 'Backspace' && inputRef.current?.value === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        ref={inputRef}
        type="text"
        placeholder="Type a flavor and press Enter"
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (e.target.value.trim()) {
            addTag(e.target.value)
            e.target.value = ''
          }
        }}
      />
      {/* Serialized as JSON for the Server Action */}
      <input type="hidden" name="flavors" value={JSON.stringify(tags)} />
    </div>
  )
}
```

- [ ] **Step 3: Create the product form component**

Create `components/admin/product-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from '@/app/actions/admin/products'
import type { Product } from '@/lib/data/products'
import { getProductImageUrl } from '@/lib/supabase/storage'
import { ImageUpload } from '@/components/admin/image-upload'
import { TagInput } from '@/components/admin/tag-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type ProductFormProps = {
  product?: Product | null
}

const initialState: ProductActionState = { ok: false }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!product

  const boundAction = isEdit
    ? updateProductAction.bind(null, product.id)
    : createProductAction

  const [state, action, isPending] = useActionState(boundAction, initialState)

  useEffect(() => {
    if (state.ok) {
      router.push('/admin/products')
    }
  }, [state.ok, router])

  return (
    <form action={action} className="max-w-xl space-y-6">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={product?.name ?? ''}
          required
          onChange={(e) => {
            if (!isEdit) {
              const slugInput = document.getElementById('slug') as HTMLInputElement
              if (slugInput) slugInput.value = slugify(e.target.value)
            }
          }}
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={product?.slug ?? ''}
          required
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
        />
        {state.fieldErrors?.slug && (
          <p className="text-sm text-destructive">{state.fieldErrors.slug[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input
          id="subtitle"
          name="subtitle"
          defaultValue={product?.subtitle ?? ''}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="price">Price</Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={product?.price?.toString() ?? ''}
          required
        />
        {state.fieldErrors?.price && (
          <p className="text-sm text-destructive">{state.fieldErrors.price[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Flavors</Label>
        <TagInput initialTags={product?.flavors ?? []} />
        {state.fieldErrors?.flavors && (
          <p className="text-sm text-destructive">{state.fieldErrors.flavors[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Image</Label>
        <ImageUpload
          existingUrl={product?.imagePath ? getProductImageUrl(product.imagePath) : null}
          existingPath={product?.imagePath ?? null}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="isVisible"
          name="isVisible"
          value="on"
          defaultChecked={product?.isVisible ?? true}
        />
        <Label htmlFor="isVisible">Visible in catalog</Label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sortOrder">Sort Order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          defaultValue={product ? String((product as any).sortOrder ?? 0) : '0'}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEdit
              ? 'Saving...'
              : 'Creating...'
            : isEdit
              ? 'Save Changes'
              : 'Create Product'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/products')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
```

**NOTE:** The `Product` type doesn't expose `sortOrder`. Add it alongside the `isVisible` change from Task 12. In `lib/data/products.ts`, add to the `Product` type:

```typescript
export type Product = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  flavors: string[]
  imagePath: string | null
  isVisible: boolean
  sortOrder: number   // <-- add this
}
```

And update `rowToProduct`:
```typescript
function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    price: typeof row.price === 'string' ? Number(row.price) : row.price,
    flavors: row.flavors,
    imagePath: row.image_path,
    isVisible: row.is_visible,
    sortOrder: row.sort_order,   // <-- add this
  }
}
```

- [ ] **Step 4: Apply the Product type update for sortOrder**

Edit `lib/data/products.ts` to add `sortOrder` to the `Product` type and `rowToProduct`.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/image-upload.tsx components/admin/tag-input.tsx components/admin/product-form.tsx lib/data/products.ts
git commit -m "feat(phase-3): add image upload, tag input, and product form components"
```

---

## Task 14: Admin product new + edit pages

**Files:**
- Create: `app/admin/(dashboard)/products/new/page.tsx`
- Create: `app/admin/(dashboard)/products/[id]/page.tsx`

- [ ] **Step 1: Create the new product page**

Create `app/admin/(dashboard)/products/new/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductForm } from '@/components/admin/product-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'New Product' }

export default function AdminNewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Product</h1>
      </div>
      <ProductForm />
    </div>
  )
}
```

- [ ] **Step 2: Create the edit product page**

Create `app/admin/(dashboard)/products/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProductById } from '@/lib/data/products'
import { ProductForm } from '@/components/admin/product-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Edit Product' }

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProductById(id)
  if (!product) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit: {product.name}
        </h1>
      </div>
      <ProductForm product={product} />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/products/new/" "app/admin/(dashboard)/products/[id]/"
git commit -m "feat(phase-3): add admin product new + edit pages"
```

---

## Task 15: Admin inquiries list + detail pages

**Files:**
- Create: `app/admin/(dashboard)/inquiries/page.tsx`
- Create: `app/admin/(dashboard)/inquiries/[id]/page.tsx`

- [ ] **Step 1: Create the inquiries list page**

Create `app/admin/(dashboard)/inquiries/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { getInquiries } from '@/lib/data/inquiries'
import { deleteInquiryAction } from '@/app/actions/admin/inquiries'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye } from 'lucide-react'

export const metadata: Metadata = { title: 'Inquiries' }

export default async function AdminInquiriesPage() {
  const inquiries = await getInquiries()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Inquiries</h1>

      {inquiries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inquiries yet.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Requested Item</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell className="font-medium">{inquiry.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {inquiry.businessName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inquiry.email}
                  </TableCell>
                  <TableCell>{inquiry.requestedItem}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inquiry.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/inquiries/${inquiry.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      <DeleteDialog
                        title="Delete inquiry?"
                        description="This will permanently delete this inquiry. This action cannot be undone."
                        onConfirm={deleteInquiryAction.bind(null, inquiry.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the inquiry detail page**

Create `app/admin/(dashboard)/inquiries/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInquiryById } from '@/lib/data/inquiries'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Inquiry Detail' }

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const inquiry = await getInquiryById(id)
  if (!inquiry) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inquiries">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Inquiry</h1>
      </div>

      <div className="max-w-xl space-y-4 rounded-lg border border-border p-6">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Name</p>
          <p>{inquiry.name}</p>
        </div>
        {inquiry.businessName && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Business</p>
            <p>{inquiry.businessName}</p>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p>{inquiry.email}</p>
        </div>
        {inquiry.phone && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Phone</p>
            <p>{inquiry.phone}</p>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            Requested Item
          </p>
          <p>{inquiry.requestedItem}</p>
        </div>
        {inquiry.details && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Details</p>
            <p className="whitespace-pre-wrap">{inquiry.details}</p>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Submitted</p>
          <p className="text-sm text-muted-foreground">
            {new Date(inquiry.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/inquiries/"
git commit -m "feat(phase-3): add admin inquiries list + detail pages"
```

---

## Task 16: Build verification + full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests pass — existing Phase 2 tests + new Phase 3 admin action tests.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Build succeeds with no errors. All admin pages are rendered as dynamic (they read cookies via `createServerSupabaseClient`).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 4: Start dev server and smoke-test manually**

```bash
npm run dev
```

Walk through:
1. Visit `/admin` — should redirect to `/admin/login` (no session)
2. Log in with admin credentials — should redirect to `/admin/orders`
3. Navigate sidebar: Orders, Products, Inquiries
4. Create a product (with image upload) — verify it appears in the public catalog
5. Toggle product visibility — verify it disappears/reappears on public site
6. Edit a product — verify changes persist
7. View an order detail — verify items sub-table renders
8. Mark an order fulfilled — verify status badge updates
9. View an inquiry detail — verify all fields render
10. Log out — should redirect to `/admin/login`

- [ ] **Step 5: Commit any fixes from smoke testing**

If fixes were needed:
```bash
git add -A
git commit -m "fix(phase-3): smoke test fixes"
```

---

## Task 17: Netlify deployment

This task uses the `netlify-deploy` skill. Several steps are interactive and must be run by the user.

**Files:**
- Modify: `package.json` (add `@netlify/plugin-nextjs` if not auto-detected)

- [ ] **Step 1: User runs netlify init (interactive)**

The user must run this themselves since it's interactive:

```bash
npx netlify init
```

This links the repo to a Netlify site.

- [ ] **Step 2: Verify @netlify/plugin-nextjs is installed**

```bash
grep -q "@netlify/plugin-nextjs" package.json || npm install @netlify/plugin-nextjs
```

- [ ] **Step 3: Mirror env vars to Netlify**

Set every env var from `.env.local` in the Netlify site settings:

```bash
npx netlify env:set NEXT_PUBLIC_SUPABASE_URL "<value>"
npx netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "<value>"
npx netlify env:set NEXT_PUBLIC_SITE_URL "<production-url>"
```

- [ ] **Step 4: Draft deploy**

```bash
npx netlify deploy --build
```

Expected: Draft URL is printed. Visit it and smoke-test:
- Public catalog loads
- `/admin/login` loads
- Login works
- Product images load from Supabase Storage

- [ ] **Step 5: Production deploy**

Once draft is green:

```bash
npx netlify deploy --prod
```

- [ ] **Step 6: Verify production**

Visit the production URL and confirm:
- Cold-start auth works
- Supabase Storage images serve correctly
- All admin CRUD operations work
- Public catalog reflects product visibility changes

- [ ] **Step 7: Commit any deploy config files**

```bash
git add netlify.toml .netlify/ 2>/dev/null; git add package.json package-lock.json
git commit -m "chore(phase-3): add Netlify deployment config"
```

---

## Phase 3 — Definition of Done (spec §7.8)

- [ ] Admin login works
- [ ] All CRUD operations work (products, orders, inquiries)
- [ ] Unauth requests to `/admin/*` redirect to `/admin/login`
- [ ] Product visibility toggle reflects immediately on the public catalog
- [ ] Image upload/replace works end-to-end
- [ ] Production deploy is live and all happy paths verified
