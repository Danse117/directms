@AGENTS.md

# DirectMS

Wholesale B2B catalog rebuild. The existing site in `.original_project/` (vanilla HTML/CSS/JS) is being replaced with a Next.js 16 application. See the full design spec at [`docs/superpowers/specs/2026-04-11-directms-catalog-design.md`](docs/superpowers/specs/2026-04-11-directms-catalog-design.md).

## Stack

- **Next.js 16.2.3** (App Router, Turbopack default) — **read `node_modules/next/dist/docs/` before writing Next.js code** (per AGENTS.md, this is NOT the Next.js you know)
- **React 19.2** (bundled with Next 16)
- **Tailwind v4 + shadcn** (`radix-nova` style, configured in `components.json`)
- **Motion 12** + React 19.2 `<ViewTransition>` for animation
- **zustand** + `persist` middleware for cart state (localStorage)
- **react-hook-form + zod** for form validation (shared client/server schemas)
- **Supabase** (Postgres + Storage + Auth) via `@supabase/ssr`
- **Resend** + `@react-email/components` for transactional email
- **Netlify** (with `@netlify/plugin-nextjs`) for hosting

## Delivery phases

The project ships in three sequential phases — **do not start the next phase until the current one passes its definition of done**.

| Phase | Status | Scope |
|---|---|---|
| **Phase 1** — Frontend only | Complete | Hardcoded products, stubbed Server Actions, full UI walkthrough |
| **Phase 2** — Supabase + Resend | Complete | Real backend, Supabase reads/writes, email scaffolded but disabled |
| **Phase 3** — Admin + Deploy | Not started | Protected admin dashboard + Netlify production deploy |

Update this table as phases progress.

## Architectural invariants

These are load-bearing constraints — violating any of them breaks the design:

1. **Server Components own all reads.** Catalog, orders, products, and inquiries are fetched on the server. Never call Supabase from a Client Component for read operations.
2. **Server Actions own all mutations.** No custom REST routes. Every mutation goes through `app/actions/*.ts`.
3. **Every admin Server Action begins with an auth check.** `const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Unauthorized')`. Server Actions are reachable via direct POST independent of the UI (per Next.js 16 docs), so layout-level or proxy-level auth is defense in depth, not a substitute.
4. **Client-supplied prices are never trusted.** `placeOrder` re-fetches every `productId` from Supabase and recomputes line totals and subtotals server-side. The client sends `{ productId, flavor, quantity }` only.
5. **RLS is the only enforcement surface.** The service-role Supabase key is **never** imported anywhere in the app. All operations use the anon key + session-aware SSR client.
6. **Orders are immutable snapshots.** The `orders.items` JSONB column is frozen at insert time — renaming or repricing a product later must never mutate historical orders.
7. **`proxy.ts`, not `middleware.ts`.** Next.js 16 renamed this. The function export is `proxy`, not `middleware`. Only nodejs runtime is supported. The Supabase session helper lives at `lib/supabase/session.ts` (not `middleware.ts`) to avoid filename collision with the Next.js concept.
8. **Async request APIs.** `cookies()`, `headers()`, `params`, `searchParams` are all Promises in Next.js 16 — every call must be `await`ed.

## Working tree conventions

- Implementation plans live in `docs/superpowers/plans/` (generated via `writing-plans` skill, one per phase)
- The design spec is in `docs/superpowers/specs/` — update it if scope shifts, don't fork it
- Use feature branches per phase: `phase-1-frontend`, `phase-2-supabase-resend`, `phase-3-admin-deploy`
- Run `verification-before-completion` and `requesting-code-review` at the end of each phase before claiming it done

## The `.original_project/` directory

Contains the reference HTML/CSS/JS site the new build replaces. **Read-only** — treat it as historical documentation. Use it to recover original product names, flavor lists, copy, and the warm-orange visual starting point during design brainstorming.
