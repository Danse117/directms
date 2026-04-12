# DirectMS Phase 1 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully navigable, styled Next.js 16 catalog site with hardcoded products and stubbed Server Actions — no Supabase, no Resend. End state: clean `next build`, `next lint`, and a reviewable visual walkthrough.

**Architecture:** Multi-page App Router site with three public routes (`/`, `/cart`, `/order-success`). Server Components render static shells; Client Components handle the cart store, product cards, and forms. Server Actions are stubbed but use the exact signatures and Zod schemas Phase 2 will reuse unchanged. Cart state lives in a zustand store with `persist` middleware backed by `localStorage` under key `directms-cart`.

**Tech Stack:** Next.js 16.2.3 (App Router, Turbopack default), React 19.2, TypeScript 5, Tailwind v4, shadcn (radix-nova), zustand + persist, react-hook-form + zod + @hookform/resolvers, Motion 12, sonner, Inter via `next/font/google`, lucide-react.

---

## Important context for implementers

**Next.js 16 is NOT the Next.js you know.** Before writing any Next.js-specific code, read the relevant file in `node_modules/next/dist/docs/01-app/` (per `AGENTS.md`). Key breaking changes this plan accounts for:

1. **Async request APIs** — `cookies()`, `headers()`, `params`, `searchParams` are all Promises. Every access must be `await`ed.
2. **Turbopack is default** for `next dev` and `next build` — no `--turbopack` flag is needed.
3. **`middleware.ts` → `proxy.ts`** — Phase 1 does not use `proxy.ts` yet (Phase 3 adds it).
4. **Server Actions are reachable via direct POST** — Phase 1 actions are stubbed, but their signatures assume this.
5. **`useActionState`** is imported from `react`, not `react-dom`.
6. **`redirect()`** from `next/navigation` has return type `never` — TS accepts it as a terminal statement.

**Test strategy for Phase 1 — TDD exception.** Per the design spec §8.3: "pure visual/UI work does not get tests. Correctness-critical code (Server Actions, price math, auth guards) is verified manually + by code review." Phase 1 is almost entirely visual, so most tasks use `npm run build` + manual dev-server verification rather than unit tests. No test runner is added in Phase 1 — vitest will come in Phase 2 when Server Actions own real price math. If a task step says "verify visually in the browser", that is the intended verification mechanism.

**Commit cadence.** Each task ends with a commit. Do not batch commits across tasks — one task, one commit, small reviewable increments.

**Do NOT invent files or features not specified in this plan.** If a task's steps don't cover something you think is needed, stop and ask before adding it. YAGNI.

---

## Design foundation

The Phase 1 visual direction is **warm orange wholesale — refined, not retro**. It retains the brand heritage of the original site (Tailwind `orange-500` on a cream background) and tightens it using shadcn's radix-nova style system. Typography is Inter via `next/font/google` to keep the build self-contained. Motion is restrained — stagger on first paint, subtle card lift on hover, layout animation in the cart list.

The palette below is applied as concrete OKLCH values in Task 4. If the user wants to iterate on the palette after Phase 1 ships, they can invoke the `frontend-design` or `ui-ux-pro-max` skills and the `web-design-guidelines` audit to propose alternates — but the plan itself is self-contained and executable without those skills running.

### Palette (applied in Task 4)

| Token | Light mode | Dark mode | Purpose |
|---|---|---|---|
| `--background` | `oklch(0.99 0.005 75)` | `oklch(0.17 0.015 55)` | page background |
| `--foreground` | `oklch(0.16 0.015 55)` | `oklch(0.97 0.005 75)` | body text |
| `--card` | `oklch(1 0 0)` | `oklch(0.22 0.02 55)` | card surface |
| `--card-foreground` | `oklch(0.16 0.015 55)` | `oklch(0.97 0.005 75)` | text on cards |
| `--primary` | `oklch(0.70 0.19 45)` | `oklch(0.75 0.19 50)` | warm orange CTAs, focus rings |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.17 0.015 55)` | text on primary |
| `--secondary` | `oklch(0.96 0.01 75)` | `oklch(0.27 0.02 55)` | warm cream secondary |
| `--secondary-foreground` | `oklch(0.25 0.02 55)` | `oklch(0.97 0.005 75)` | |
| `--muted` | `oklch(0.96 0.01 75)` | `oklch(0.27 0.02 55)` | |
| `--muted-foreground` | `oklch(0.50 0.015 55)` | `oklch(0.70 0.015 60)` | |
| `--accent` | `oklch(0.93 0.04 60)` | `oklch(0.30 0.04 50)` | pale apricot accent |
| `--accent-foreground` | `oklch(0.25 0.03 50)` | `oklch(0.95 0.01 75)` | |
| `--destructive` | `oklch(0.58 0.22 27)` | `oklch(0.70 0.19 22)` | error states |
| `--border` | `oklch(0.90 0.01 70)` | `oklch(1 0 0 / 10%)` | |
| `--input` | `oklch(0.90 0.01 70)` | `oklch(1 0 0 / 15%)` | |
| `--ring` | `oklch(0.70 0.19 45)` | `oklch(0.75 0.19 50)` | orange focus rings |
| `--radius` | `0.75rem` | `0.75rem` | softer than default `0.625rem` |

### Typography

- **Sans:** Inter via `next/font/google`, variable weights 400/500/600/700, exposed as `--font-sans`.
- **Mono:** default Geist Mono (unchanged — unused in Phase 1 but kept for future).
- Body `16px`, line-height `1.55`. Headings `font-semibold` (600), not black.

### Motion scope

- Hero eyebrow + headline + subhead + CTAs: staggered fade + 12px upward translate on mount (Motion).
- Product card: `whileHover={{ y: -2 }}` subtle lift, 150ms.
- Cart list: `AnimatePresence` + `layout` prop for smooth add/remove transitions.
- Sonner toast for "Added to cart" feedback.
- Page transitions: deferred — React 19.2 `<ViewTransition>` is still experimental under Next.js 16. Phase 1 uses instant navigation; Phase 2+ can revisit.

---

## File structure

### New files (created in Phase 1)

```
app/
├── actions/
│   ├── place-order.ts         # Stubbed Server Action — validates + redirects
│   └── send-inquiry.ts        # Stubbed Server Action — validates + returns ok
├── cart/
│   ├── page.tsx               # Server shell
│   └── cart-view.tsx          # Client island (cart list + checkout form)
├── order-success/
│   └── page.tsx               # Server Component (reads ?order= from searchParams)
└── (overwrite) page.tsx       # Home: hero + product grid + inquiry section

components/
├── site/
│   ├── header.tsx             # Server (logo, nav, cart badge client island)
│   ├── footer.tsx             # Server
│   └── hero.tsx               # Client (Motion stagger-in)
├── products/
│   ├── product-grid.tsx       # Server (maps products → cards)
│   └── product-card.tsx       # Client (flavor select, qty, add to cart)
├── cart/
│   ├── cart-store.ts          # zustand + persist middleware
│   ├── cart-badge.tsx         # Client island for header cart count
│   ├── cart-item.tsx          # Client (Motion layout animation)
│   ├── cart-list.tsx          # Client (maps items → cart-item)
│   ├── checkout-form.tsx      # Client (react-hook-form + useActionState)
│   └── clear-on-mount.tsx     # Client island used by order-success
└── inquiry/
    └── inquiry-form.tsx       # Client (react-hook-form + useActionState)

lib/
├── products.seed.ts           # Product type + 9-product typed array
├── format.ts                  # formatCurrency helper
└── schemas/
    ├── order.ts               # Zod schema for placeOrder payload
    └── inquiry.ts             # Zod schema for sendInquiry payload

public/products/
├── mega-v2-10-packs.jpg
├── adalya-5-pieces-20000-puffs.jpg
├── fume-extra.webp
├── lava-plus.webp
├── stig.png
├── geek-bars-pulse-x.jpg
├── geek-x-mega.png
├── myle-mini-box-1500-puffs.webp
└── mini-myle.jpg
```

### Files modified in Phase 1

```
app/
├── layout.tsx                 # Inter font, metadata, Sonner Toaster
├── globals.css                # Warm-orange palette overrides
└── page.tsx                   # Replaced from create-next-app starter

components/ui/                 # shadcn primitives added via CLI in Task 2
```

### Files deleted in Phase 1

```
public/
├── file.svg
├── globe.svg
├── next.svg
├── vercel.svg
└── window.svg
```

---

## Task 1: Pre-work — clean boilerplate and install runtime dependencies

**Files:**
- Delete: `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`
- Modify: `package.json`, `package-lock.json` (via `npm install`)

- [ ] **Step 1: Delete create-next-app starter SVGs**

  Remove the five placeholder SVGs from the `public/` folder. The `app/page.tsx` starter imports `/next.svg` and `/vercel.svg` — those will be replaced in Task 19, but the files can go now.

  ```bash
  rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
  ```

- [ ] **Step 2: Install runtime dependencies**

  Install the five runtime libraries Phase 1 needs. Use `npm` since the repo uses `package-lock.json`.

  ```bash
  npm install zustand react-hook-form @hookform/resolvers zod sonner
  ```

  Expected output: package.json updated with `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `sonner` under `dependencies`.

- [ ] **Step 3: Verify install**

  Run a quick dependency check — `next build` is too heavy for a smoke test at this stage, but `next lint` will confirm nothing broke.

  ```bash
  npx next lint
  ```

  Expected: passes. If `next lint` errors on the existing `app/page.tsx`, that's fine — it's being replaced in Task 19. The check here is that no dependency install broke TypeScript resolution.

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json public
  git commit -m "chore(phase-1): remove starter SVGs and install runtime deps

  - Install zustand, react-hook-form, @hookform/resolvers, zod, sonner
  - Delete create-next-app placeholder SVGs from public/"
  ```

---

## Task 2: Install shadcn primitives

**Files:**
- Create: `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/select.tsx`, `components/ui/separator.tsx`, `components/ui/form.tsx`, `components/ui/sonner.tsx`

- [ ] **Step 1: Add the Phase 1 shadcn primitives**

  The project already has `components/ui/button.tsx`. Add the rest of the Phase 1 primitives in one batch command. The project uses the `radix-nova` style (confirmed in `components.json`).

  ```bash
  npx shadcn@latest add input textarea label card badge select separator form sonner
  ```

  When the CLI asks about overwriting existing files, decline (there shouldn't be any conflicts). When it asks about installing `radix-ui` or `sonner`, accept.

- [ ] **Step 2: Verify primitives land in the right spot**

  Confirm each file exists:

  ```bash
  ls components/ui/
  ```

  Expected: `badge.tsx`, `button.tsx`, `card.tsx`, `form.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `separator.tsx`, `sonner.tsx`, `textarea.tsx`.

- [ ] **Step 3: Smoke-test the TypeScript compile**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes. No primitives should have import errors.

- [ ] **Step 4: Commit**

  ```bash
  git add components/ui package.json package-lock.json components.json
  git commit -m "chore(phase-1): add shadcn primitives (input, textarea, label, card, badge, select, separator, form, sonner)"
  ```

---

## Task 3: Configure Inter font, root metadata, and Sonner Toaster

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Rewrite `app/layout.tsx`**

  Replace the Geist font with Inter (variable weights), update metadata for DirectMS, and mount the `<Toaster />` from sonner so toasts work globally.

  ```tsx
  import type { Metadata } from "next";
  import { Inter, Geist_Mono } from "next/font/google";
  import { Toaster } from "@/components/ui/sonner";
  import "./globals.css";

  const inter = Inter({
    variable: "--font-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
  });

  const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
  });

  export const metadata: Metadata = {
    title: {
      default: "DirectMS — Wholesale Catalog",
      template: "%s · DirectMS",
    },
    description:
      "Wholesale ordering for disposable pod and vape products. Browse the catalog, pick your flavor, and send your order in minutes.",
    metadataBase: new URL("https://directms.local"),
  };

  export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <html
        lang="en"
        className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-background text-foreground">
          {children}
          <Toaster position="bottom-center" richColors closeButton />
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 2: Verify TypeScript still compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes. `Geist` import removed from `next/font/google`, `Inter` import added, `Toaster` mounted.

- [ ] **Step 3: Commit**

  ```bash
  git add app/layout.tsx
  git commit -m "feat(phase-1): switch root layout to Inter + mount Sonner Toaster"
  ```

---

## Task 4: Apply the warm-orange palette to globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Rewrite `app/globals.css` with the Phase 1 palette**

  Overwrite the `:root` and `.dark` blocks with the warm-orange OKLCH values from the design foundation. Keep the rest of the file (Tailwind imports, `@theme inline` block, `@layer base`) intact.

  ```css
  @import "tailwindcss";
  @import "tw-animate-css";
  @import "shadcn/tailwind.css";

  @custom-variant dark (&:is(.dark *));

  @theme inline {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --font-sans: var(--font-sans);
    --font-mono: var(--font-geist-mono);
    --font-heading: var(--font-sans);
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
  }

  :root {
    --background: oklch(0.99 0.005 75);
    --foreground: oklch(0.16 0.015 55);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.16 0.015 55);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.16 0.015 55);
    --primary: oklch(0.70 0.19 45);
    --primary-foreground: oklch(0.99 0 0);
    --secondary: oklch(0.96 0.01 75);
    --secondary-foreground: oklch(0.25 0.02 55);
    --muted: oklch(0.96 0.01 75);
    --muted-foreground: oklch(0.50 0.015 55);
    --accent: oklch(0.93 0.04 60);
    --accent-foreground: oklch(0.25 0.03 50);
    --destructive: oklch(0.58 0.22 27);
    --border: oklch(0.90 0.01 70);
    --input: oklch(0.90 0.01 70);
    --ring: oklch(0.70 0.19 45);
    --chart-1: oklch(0.70 0.19 45);
    --chart-2: oklch(0.65 0.15 60);
    --chart-3: oklch(0.55 0.12 50);
    --chart-4: oklch(0.45 0.08 55);
    --chart-5: oklch(0.35 0.05 60);
    --radius: 0.75rem;
    --sidebar: oklch(0.97 0.008 75);
    --sidebar-foreground: oklch(0.16 0.015 55);
    --sidebar-primary: oklch(0.70 0.19 45);
    --sidebar-primary-foreground: oklch(0.99 0 0);
    --sidebar-accent: oklch(0.93 0.04 60);
    --sidebar-accent-foreground: oklch(0.25 0.03 50);
    --sidebar-border: oklch(0.90 0.01 70);
    --sidebar-ring: oklch(0.70 0.19 45);
  }

  .dark {
    --background: oklch(0.17 0.015 55);
    --foreground: oklch(0.97 0.005 75);
    --card: oklch(0.22 0.02 55);
    --card-foreground: oklch(0.97 0.005 75);
    --popover: oklch(0.22 0.02 55);
    --popover-foreground: oklch(0.97 0.005 75);
    --primary: oklch(0.75 0.19 50);
    --primary-foreground: oklch(0.17 0.015 55);
    --secondary: oklch(0.27 0.02 55);
    --secondary-foreground: oklch(0.97 0.005 75);
    --muted: oklch(0.27 0.02 55);
    --muted-foreground: oklch(0.70 0.015 60);
    --accent: oklch(0.30 0.04 50);
    --accent-foreground: oklch(0.95 0.01 75);
    --destructive: oklch(0.70 0.19 22);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.75 0.19 50);
    --chart-1: oklch(0.75 0.19 50);
    --chart-2: oklch(0.65 0.15 60);
    --chart-3: oklch(0.55 0.12 50);
    --chart-4: oklch(0.45 0.08 55);
    --chart-5: oklch(0.35 0.05 60);
    --sidebar: oklch(0.22 0.02 55);
    --sidebar-foreground: oklch(0.97 0.005 75);
    --sidebar-primary: oklch(0.75 0.19 50);
    --sidebar-primary-foreground: oklch(0.17 0.015 55);
    --sidebar-accent: oklch(0.30 0.04 50);
    --sidebar-accent-foreground: oklch(0.95 0.01 75);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.75 0.19 50);
  }

  @layer base {
    * {
      @apply border-border outline-ring/50;
    }
    body {
      @apply bg-background text-foreground;
    }
    html {
      @apply font-sans;
    }
  }
  ```

- [ ] **Step 2: Verify the CSS compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes (TypeScript won't error on CSS, but this confirms no other regressions).

- [ ] **Step 3: Commit**

  ```bash
  git add app/globals.css
  git commit -m "style(phase-1): apply warm-orange palette to globals.css"
  ```

---

## Task 5: Copy product images from `.original_project` into `public/products/`

**Files:**
- Create: `public/products/mega-v2-10-packs.jpg`, `public/products/adalya-5-pieces-20000-puffs.jpg`, `public/products/fume-extra.webp`, `public/products/lava-plus.webp`, `public/products/stig.png`, `public/products/geek-bars-pulse-x.jpg`, `public/products/geek-x-mega.png`, `public/products/myle-mini-box-1500-puffs.webp`, `public/products/mini-myle.jpg`

- [ ] **Step 1: Make the destination directory**

  ```bash
  mkdir -p public/products
  ```

- [ ] **Step 2: Copy each image under its slugged name**

  The `.original_project/images/` files are numbered `1.jpg` through `9.jpg` (with a mix of `.jpg`, `.webp`, and `.png` extensions). Copy each one to its slug-named destination so the seed data in Task 6 can reference them directly.

  ```bash
  cp .original_project/images/1.jpg public/products/mega-v2-10-packs.jpg
  cp .original_project/images/2.jpg public/products/adalya-5-pieces-20000-puffs.jpg
  cp .original_project/images/3.webp public/products/fume-extra.webp
  cp .original_project/images/4.webp public/products/lava-plus.webp
  cp .original_project/images/5.png public/products/stig.png
  cp .original_project/images/6.jpg public/products/geek-bars-pulse-x.jpg
  cp .original_project/images/7.png public/products/geek-x-mega.png
  cp .original_project/images/8.webp public/products/myle-mini-box-1500-puffs.webp
  cp .original_project/images/9.jpg public/products/mini-myle.jpg
  ```

- [ ] **Step 3: Verify all nine files are present**

  ```bash
  ls public/products/
  ```

  Expected: the 9 slug-named image files. Any missing file is a blocker — fix before proceeding.

- [ ] **Step 4: Commit**

  ```bash
  git add public/products
  git commit -m "feat(phase-1): copy product images to public/products with slug filenames"
  ```

---

## Task 6: Create the product seed data

**Files:**
- Create: `lib/products.seed.ts`

- [ ] **Step 1: Write the seed file**

  This defines the `Product` type and the typed 9-product array. Prices are placeholders in the $25/$30/$35 range — per the spec §5.3, real prices come from the Phase 2 seed migration. Flavor lists are copied verbatim from `.original_project/index.html` lines 205–393 so the catalog matches the original.

  ```ts
  export type Product = {
    id: string;
    slug: string;
    name: string;
    subtitle: string;
    price: number;
    flavors: string[];
    imagePath: string;
  };

  export const products: Product[] = [
    {
      id: "mega-v2-10-packs",
      slug: "mega-v2-10-packs",
      name: "Mega V2 — 10 Packs",
      subtitle: "25 flavor options",
      price: 35,
      flavors: [
        "red bull",
        "red apple",
        "frozen tangerine",
        "mega melons",
        "Pineapple ice",
        "Frozen blue razz",
        "Frozen peach",
        "Zero nicotine disposable pods",
        "Strawberry banana",
        "Cotton candy",
        "Strawberry and cream",
        "Frozen cranberry lemon",
        "Guava ice",
        "Frozen lychee ice",
        "Blue razz",
        "Mixed berry ice",
        "Grape",
        "Strawberry mint",
        "Clear ice",
        "Cherry cola",
        "Watermelon mint",
        "Frozen grape",
        "Smooth tobacco",
        "Cool mint",
        "clear 5 percent",
      ],
      imagePath: "/products/mega-v2-10-packs.jpg",
    },
    {
      id: "adalya-5-pieces-20000-puffs",
      slug: "adalya-5-pieces-20000-puffs",
      name: "Adalya — 5 Pieces / 20000 Puffs",
      subtitle: "16 flavor options",
      price: 35,
      flavors: [
        "blueberry",
        "Mi amor",
        "Grape mint",
        "Skyfall",
        "Mint point",
        "Love 66",
        "Lady killer",
        "Orange lemonade",
        "Peach ice",
        "Menthol",
        "Passionfruit guava kiwi",
        "Punk man",
        "Blue min",
        "Angel lips",
        "delons",
        "English lord",
      ],
      imagePath: "/products/adalya-5-pieces-20000-puffs.jpg",
    },
    {
      id: "fume-extra",
      slug: "fume-extra",
      name: "Fume Extra",
      subtitle: "16 flavor options",
      price: 25,
      flavors: [
        "blueberry cc",
        "Strawberry",
        "Bubblegum",
        "Paradise",
        "Desert breeze",
        "Hawaii juice",
        "Mango",
        "Banana ice",
        "clear",
        "Melon ice",
        "Gummy bears",
        "Strawberry banana",
        "Fresh lychee",
        "Double apple",
        "Unicorn",
        "mint ice",
      ],
      imagePath: "/products/fume-extra.webp",
    },
    {
      id: "lava-plus",
      slug: "lava-plus",
      name: "Lava Plus",
      subtitle: "22 flavor options",
      price: 30,
      flavors: [
        "clear ice",
        "Strawberry watermelon bubblegum",
        "Berry mist",
        "Jolly rancher ice",
        "Watermelon mint",
        "Pineapple, coconut rum",
        "Bloom",
        "Fruit blast",
        "Black ice",
        "Havana tobacco",
        "Mango ice",
        "Strawberry lemonade",
        "Guava ice banana milkshake",
        "Peach mango watermelon",
        "Strawberry quake",
        "Banana milkshake",
        "Sour patch",
        "Dragon flume",
        "Sour watermelon candy",
        "Mojito",
        "Fruit ice",
        "cool mint",
        "peach ice",
      ],
      imagePath: "/products/lava-plus.webp",
    },
    {
      id: "stig",
      slug: "stig",
      name: "Stig",
      subtitle: "1 flavor option",
      price: 25,
      flavors: ["green apple"],
      imagePath: "/products/stig.png",
    },
    {
      id: "geek-bars-pulse-x",
      slug: "geek-bars-pulse-x",
      name: "Geek Bars Pulse X",
      subtitle: "14 flavor options",
      price: 30,
      flavors: [
        "Miami MINT",
        "Mexican mango",
        "Strawberry b pop",
        "Lime berry orange",
        "Clear diamond",
        "Clear ice",
        "Banana taffy freeze",
        "Watermelon ice",
        "Sour apple ice",
        "Virginia tobacco",
        "Blue razz ice",
        "White peach raspberry",
        "Banana taffy",
        "Sour mango pineapple",
      ],
      imagePath: "/products/geek-bars-pulse-x.jpg",
    },
    {
      id: "geek-x-mega",
      slug: "geek-x-mega",
      name: "Geek X Mega",
      subtitle: "12 flavor options",
      price: 30,
      flavors: [
        "clear",
        "Strawberry mango ice",
        "Strawberry kiwi ice",
        "Strawberry ice",
        "Cinnamon",
        "Cool mint",
        "Blue razz ice",
        "Cherry lemon breeze",
        "Tobacco",
        "Blackberry b pop",
        "Raspberry jam",
        "Miami mint",
        "Watermelon ice",
      ],
      imagePath: "/products/geek-x-mega.png",
    },
    {
      id: "myle-mini-box-1500-puffs",
      slug: "myle-mini-box-1500-puffs",
      name: "Myle Mini Box — 1500 Puffs",
      subtitle: "10 flavor options",
      price: 25,
      flavors: [
        "Cubano",
        "Strawberry watermelon",
        "Ice blueberry",
        "Red apple",
        "Prime pear",
        "Iced apple",
        "Sweet to",
        "Grape ice",
        "Peach ice",
        "Ice watermelon",
      ],
      imagePath: "/products/myle-mini-box-1500-puffs.webp",
    },
    {
      id: "mini-myle",
      slug: "mini-myle",
      name: "Mini Myle",
      subtitle: "7 flavor options",
      price: 25,
      flavors: [
        "ice Leche",
        "Raspberry watermelon",
        "Tobacco gold",
        "Ice blueberry",
        "Pink lemonade",
        "Peach ice",
        "Lemon mint",
      ],
      imagePath: "/products/mini-myle.jpg",
    },
  ];
  ```

- [ ] **Step 2: Verify the file compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes. If you see "Cannot find name" errors, re-check the export.

- [ ] **Step 3: Commit**

  ```bash
  git add lib/products.seed.ts
  git commit -m "feat(phase-1): add 9-product seed data with placeholder prices"
  ```

---

## Task 7: Create the formatCurrency helper

**Files:**
- Create: `lib/format.ts`

- [ ] **Step 1: Write the helper**

  Single-purpose module that formats numbers as USD. Keeping it in its own file means Phase 2 can add currency handling for line totals without re-exporting.

  ```ts
  export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add lib/format.ts
  git commit -m "feat(phase-1): add formatCurrency helper"
  ```

---

## Task 8: Create Zod schemas for the Server Action payloads

**Files:**
- Create: `lib/schemas/order.ts`, `lib/schemas/inquiry.ts`

These schemas are **identical** to the ones Phase 2 will use — the client-side forms and the real Server Actions will both reuse them unchanged. Getting the shapes right now saves work later.

- [ ] **Step 1: Write the order schema**

  ```ts
  // lib/schemas/order.ts
  import { z } from "zod";

  export const orderItemSchema = z.object({
    productId: z.string().min(1),
    flavor: z.string().min(1, "Choose a flavor"),
    quantity: z.number().int().min(1).max(999),
  });

  export const orderSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    email: z.string().trim().email("Enter a valid email"),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be under 1000 characters")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    items: z.array(orderItemSchema).min(1, "Your cart is empty"),
  });

  export type OrderInput = z.infer<typeof orderSchema>;
  export type OrderItemInput = z.infer<typeof orderItemSchema>;
  ```

- [ ] **Step 2: Write the inquiry schema**

  ```ts
  // lib/schemas/inquiry.ts
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
  ```

- [ ] **Step 3: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/schemas
  git commit -m "feat(phase-1): add Zod schemas for order and inquiry payloads"
  ```

---

## Task 9: Create the cart store (zustand + persist)

**Files:**
- Create: `components/cart/cart-store.ts`

- [ ] **Step 1: Write the store**

  The store holds only state + actions. Derived values (`count`, `subtotal`) are computed in selector hooks so zustand can re-render only the consumers that care. The persist middleware serializes to `localStorage` under the key `directms-cart`.

  **SSR note:** The store is empty on first server render and hydrates to the actual cart on the client. Anything that reads `items`, `count`, or `subtotal` must guard against hydration mismatch — see Task 13 (`cart-badge.tsx`) and Task 20 (`cart-list.tsx`) for the `useEffect + mounted` pattern.

  ```ts
  import { create } from "zustand";
  import { persist, createJSONStorage } from "zustand/middleware";

  export type CartItem = {
    productId: string;
    productName: string;
    flavor: string;
    quantity: number;
    unitPrice: number;
  };

  type CartState = {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (productId: string, flavor: string) => void;
    updateQuantity: (
      productId: string,
      flavor: string,
      quantity: number
    ) => void;
    clear: () => void;
  };

  export const useCartStore = create<CartState>()(
    persist(
      (set) => ({
        items: [],
        addItem: (item) =>
          set((state) => {
            const existing = state.items.find(
              (i) => i.productId === item.productId && i.flavor === item.flavor
            );
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.productId === item.productId && i.flavor === item.flavor
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i
                ),
              };
            }
            return { items: [...state.items, item] };
          }),
        removeItem: (productId, flavor) =>
          set((state) => ({
            items: state.items.filter(
              (i) => !(i.productId === productId && i.flavor === flavor)
            ),
          })),
        updateQuantity: (productId, flavor, quantity) =>
          set((state) => ({
            items:
              quantity <= 0
                ? state.items.filter(
                    (i) =>
                      !(i.productId === productId && i.flavor === flavor)
                  )
                : state.items.map((i) =>
                    i.productId === productId && i.flavor === flavor
                      ? { ...i, quantity }
                      : i
                  ),
          })),
        clear: () => set({ items: [] }),
      }),
      {
        name: "directms-cart",
        storage: createJSONStorage(() => localStorage),
      }
    )
  );

  // Selector hooks — use these in components instead of calling
  // useCartStore((s) => s.items.reduce(...)) inline, so zustand can
  // memoize properly.
  export const useCartItems = () => useCartStore((s) => s.items);

  export const useCartCount = () =>
    useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  export const useCartSubtotal = () =>
    useCartStore((s) =>
      s.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    );
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/cart/cart-store.ts
  git commit -m "feat(phase-1): add zustand cart store with persist middleware"
  ```

---

## Task 10: Stub the `placeOrder` Server Action

**Files:**
- Create: `app/actions/place-order.ts`

- [ ] **Step 1: Write the stub**

  The signature and Zod validation are **identical** to what Phase 2 will ship. The only difference is that Phase 1 skips the DB write + email send and redirects to `/order-success` with a random `DM-XXXXXX` order number. Phase 2 will replace the body below `// Phase 1 stub` with the real write.

  ```ts
  "use server";

  import { redirect } from "next/navigation";
  import { orderSchema, type OrderInput } from "@/lib/schemas/order";

  export type PlaceOrderState = {
    ok: boolean;
    error?: string;
    fieldErrors?: Partial<Record<keyof OrderInput, string[]>>;
  };

  function generateOrderNumber(): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `DM-${random}`;
  }

  export async function placeOrderAction(
    _prevState: PlaceOrderState,
    formData: FormData
  ): Promise<PlaceOrderState> {
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

    const result = orderSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        error: "Please fix the highlighted fields",
        fieldErrors: result.error.flatten().fieldErrors as PlaceOrderState["fieldErrors"],
      };
    }

    // Phase 1 stub — no DB write, no email. Just redirect with a fake order number.
    const orderNumber = generateOrderNumber();
    redirect(`/order-success?order=${orderNumber}`);
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes. Note that `redirect()` has return type `never`, so TS allows the function to satisfy `Promise<PlaceOrderState>` even though no explicit return follows the call.

- [ ] **Step 3: Commit**

  ```bash
  git add app/actions/place-order.ts
  git commit -m "feat(phase-1): stub placeOrder Server Action with real Zod validation"
  ```

---

## Task 11: Stub the `sendInquiry` Server Action

**Files:**
- Create: `app/actions/send-inquiry.ts`

- [ ] **Step 1: Write the stub**

  Same pattern as Task 10 but returns a success state instead of redirecting — the inquiry form shows an inline success message.

  ```ts
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
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add app/actions/send-inquiry.ts
  git commit -m "feat(phase-1): stub sendInquiry Server Action with real Zod validation"
  ```

---

## Task 12: Build the site footer

**Files:**
- Create: `components/site/footer.tsx`

- [ ] **Step 1: Write the footer**

  Simple Server Component — no client interactivity needed.

  ```tsx
  import { Separator } from "@/components/ui/separator";

  export function SiteFooter() {
    return (
      <footer className="mt-24 border-t border-border/60 bg-secondary/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
              D
            </span>
            <span className="text-sm font-medium text-foreground">
              DirectMS
            </span>
          </div>
          <Separator className="sm:hidden" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DirectMS. Wholesale orders only.
          </p>
        </div>
      </footer>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/site/footer.tsx
  git commit -m "feat(phase-1): add site footer"
  ```

---

## Task 13: Build the cart badge client island

**Files:**
- Create: `components/cart/cart-badge.tsx`

- [ ] **Step 1: Write the badge**

  This is the only part of the header that needs `"use client"` — everything else in the header is static. The `mounted` flag prevents hydration mismatch: on the server the count is 0, on the first client render it's also 0, and only after `useEffect` runs does the real `useCartCount()` value take over.

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { useCartCount } from "./cart-store";

  export function CartBadge() {
    const [mounted, setMounted] = useState(false);
    const count = useCartCount();

    useEffect(() => {
      setMounted(true);
    }, []);

    const displayed = mounted ? count : 0;

    return (
      <span
        className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground tabular-nums"
        aria-label={`${displayed} item${displayed === 1 ? "" : "s"} in cart`}
      >
        {displayed}
      </span>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/cart/cart-badge.tsx
  git commit -m "feat(phase-1): add cart-badge client island for header"
  ```

---

## Task 14: Build the site header

**Files:**
- Create: `components/site/header.tsx`

- [ ] **Step 1: Write the header**

  Server Component that mounts `<CartBadge />` as a client island. Nav links jump to the catalog, the inquiry anchor on the home page, and the dedicated cart page.

  ```tsx
  import Link from "next/link";
  import { ShoppingBag } from "lucide-react";
  import { CartBadge } from "@/components/cart/cart-badge";

  export function SiteHeader() {
    return (
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              D
            </span>
            <span>DirectMS</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground sm:flex">
            <Link
              href="/#products"
              className="transition-colors hover:text-foreground"
            >
              Catalog
            </Link>
            <Link
              href="/#inquiry"
              className="transition-colors hover:text-foreground"
            >
              Inquiry
            </Link>
          </nav>

          <Link
            href="/cart"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ShoppingBag className="size-4" />
            Cart
            <CartBadge />
          </Link>
        </div>
      </header>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/site/header.tsx
  git commit -m "feat(phase-1): add sticky site header with cart badge"
  ```

---

## Task 15: Build the hero section

**Files:**
- Create: `components/site/hero.tsx`

- [ ] **Step 1: Write the hero**

  Client Component (uses Motion). Staggered fade + 12px translate on mount — matches the spec's §5.7 "hero text stagger-in on first paint" requirement. Content adapted from `.original_project/index.html` lines 32–66.

  ```tsx
  "use client";

  import Link from "next/link";
  import { motion } from "motion/react";
  import { ArrowRight, Sparkles } from "lucide-react";

  const container = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const },
    },
  };

  export function Hero() {
    return (
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-secondary/50 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] opacity-50"
        />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 md:grid-cols-[1.2fr_0.8fr] md:gap-16 md:pt-24 md:pb-28">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-6"
          >
            <motion.span
              variants={item}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
            >
              <Sparkles className="size-3.5 text-primary" />
              DirectMS wholesale
            </motion.span>
            <motion.h1
              variants={item}
              className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl"
            >
              Fast ordering.
              <br />
              Big flavor selection.
            </motion.h1>
            <motion.p
              variants={item}
              className="max-w-lg text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Shop the lineup, choose your flavor, and send your order in
              minutes. If you don&apos;t see what you need, drop an inquiry and
              we&apos;ll follow up.
            </motion.p>
            <motion.div
              variants={item}
              className="flex flex-wrap items-center gap-3"
            >
              <Link
                href="#products"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Shop now
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="#inquiry"
                className="inline-flex items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Ask about other items
              </Link>
            </motion.div>
            <motion.ul
              variants={item}
              className="flex flex-wrap gap-2 pt-2 text-xs font-medium text-muted-foreground"
            >
              <li className="rounded-full bg-secondary px-3 py-1">
                100+ flavor choices
              </li>
              <li className="rounded-full bg-secondary px-3 py-1">
                Quick inquiries
              </li>
              <li className="rounded-full bg-secondary px-3 py-1">
                Wholesale only
              </li>
            </motion.ul>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="relative h-full rounded-2xl border border-border/80 bg-card p-8 shadow-lg shadow-primary/5">
              <div className="text-xs font-medium uppercase tracking-wider text-primary">
                Popular picks
              </div>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums">9</span>
                <span className="text-sm text-muted-foreground">
                  main product lines
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums">100+</span>
                <span className="text-sm text-muted-foreground">
                  flavor choices
                </span>
              </div>
              <div className="mt-8 rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
                <strong className="block font-semibold">
                  Need something else?
                </strong>
                <span className="text-muted-foreground">
                  Use the inquiry form and ask for items not listed on the site.
                </span>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/site/hero.tsx
  git commit -m "feat(phase-1): add hero section with Motion stagger-in"
  ```

---

## Task 16: Build the product card

**Files:**
- Create: `components/products/product-card.tsx`

- [ ] **Step 1: Write the card**

  Client Component with flavor picker, quantity input, add-to-cart button, and a sonner toast on success. Uses `motion.article` for the hover lift.

  ```tsx
  "use client";

  import { useState } from "react";
  import Image from "next/image";
  import { motion } from "motion/react";
  import { toast } from "sonner";
  import { Plus } from "lucide-react";

  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  import { useCartStore } from "@/components/cart/cart-store";
  import { formatCurrency } from "@/lib/format";
  import type { Product } from "@/lib/products.seed";

  export function ProductCard({ product }: { product: Product }) {
    const addItem = useCartStore((s) => s.addItem);
    const [flavor, setFlavor] = useState<string>(product.flavors[0] ?? "");
    const [quantity, setQuantity] = useState<number>(1);

    function handleAdd(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!flavor) return;
      addItem({
        productId: product.id,
        productName: product.name,
        flavor,
        quantity,
        unitPrice: product.price,
      });
      toast.success("Added to cart", {
        description: `${product.name} · ${flavor} · qty ${quantity}`,
      });
      setQuantity(1);
    }

    return (
      <motion.article
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <div className="relative aspect-square overflow-hidden bg-secondary">
          <Image
            src={product.imagePath}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <Badge
            variant="secondary"
            className="absolute left-4 top-4 bg-card/90 text-foreground shadow-sm backdrop-blur"
          >
            {product.flavors.length} flavors
          </Badge>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-tight tracking-tight">
                {product.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {product.subtitle}
              </p>
            </div>
            <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(product.price)}
            </span>
          </div>

          <form onSubmit={handleAdd} className="mt-auto flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`flavor-${product.id}`} className="text-xs">
                Flavor
              </Label>
              <Select value={flavor} onValueChange={setFlavor}>
                <SelectTrigger
                  id={`flavor-${product.id}`}
                  className="w-full"
                  aria-label="Choose flavor"
                >
                  <SelectValue placeholder="Choose flavor" />
                </SelectTrigger>
                <SelectContent>
                  {product.flavors.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex w-20 flex-col gap-1.5">
                <Label htmlFor={`qty-${product.id}`} className="text-xs">
                  Qty
                </Label>
                <Input
                  id={`qty-${product.id}`}
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
              <Button type="submit" className="flex-1" disabled={!flavor}>
                <Plus data-icon="inline-start" />
                Add to cart
              </Button>
            </div>
          </form>
        </div>
      </motion.article>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes. If you see an error about `<Select>` needing a wrapping `SelectGroup`, re-check the shadcn version — `SelectItem` can live directly inside `SelectContent` in current shadcn.

- [ ] **Step 3: Commit**

  ```bash
  git add components/products/product-card.tsx
  git commit -m "feat(phase-1): add product card with flavor picker and add-to-cart"
  ```

---

## Task 17: Build the product grid

**Files:**
- Create: `components/products/product-grid.tsx`

- [ ] **Step 1: Write the grid**

  Server Component — takes products as a prop and maps to `ProductCard` instances. No client code in this file.

  ```tsx
  import { ProductCard } from "./product-card";
  import type { Product } from "@/lib/products.seed";

  export function ProductGrid({ products }: { products: Product[] }) {
    return (
      <section
        id="products"
        className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16"
      >
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Shop products
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Browse the catalog
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/products/product-grid.tsx
  git commit -m "feat(phase-1): add product grid server component"
  ```

---

## Task 18: Build the inquiry form

**Files:**
- Create: `components/inquiry/inquiry-form.tsx`

- [ ] **Step 1: Write the inquiry form**

  Client Component using `react-hook-form` + `zodResolver` for client-side validation, bridged to `useActionState` so the Phase 1 stub (and Phase 2 real action) can return field-level errors and a success timestamp. On success the form resets and shows a sonner toast.

  ```tsx
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
          description: "We&apos;ll follow up as soon as possible.",
        });
        form.reset();
      } else if (!state.ok && state.error) {
        toast.error(state.error);
      }
    }, [state, form]);

    function onSubmit(values: InquiryInput) {
      const formData = new FormData();
      formData.set("payload", JSON.stringify(values));
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
                    <Input placeholder="Jane Doe" {...field} />
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
                    <Input placeholder="Optional" {...field} />
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
                    <Input type="email" placeholder="you@example.com" {...field} />
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
                    <Input type="tel" placeholder="Optional" {...field} />
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

          <Button type="submit" size="lg" disabled={pending} className="w-full">
            <Send data-icon="inline-start" />
            {pending ? "Sending..." : "Send inquiry"}
          </Button>
        </form>
      </Form>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/inquiry/inquiry-form.tsx
  git commit -m "feat(phase-1): add inquiry form wired to stubbed Server Action"
  ```

---

## Task 19: Wire up the home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

  Overwrite the create-next-app starter with the real DirectMS home page: header + hero + product grid + inquiry section + footer.

  ```tsx
  import { SiteHeader } from "@/components/site/header";
  import { SiteFooter } from "@/components/site/footer";
  import { Hero } from "@/components/site/hero";
  import { ProductGrid } from "@/components/products/product-grid";
  import { InquiryForm } from "@/components/inquiry/inquiry-form";
  import { products } from "@/lib/products.seed";

  export default function HomePage() {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">
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

- [ ] **Step 2: Run the dev server and walk through the home page**

  ```bash
  npm run dev
  ```

  Open `http://localhost:3000` in a browser. Verify:
  - Header renders with logo, nav, cart badge showing `0`.
  - Hero animates in on load (stagger).
  - Product grid shows all 9 products with images, prices, flavor dropdowns.
  - Clicking "Add to cart" on a product shows a sonner toast and the cart badge increments.
  - Refreshing the page keeps the cart count (persist middleware).
  - Inquiry form renders at the bottom; submitting with empty fields shows field-level errors.
  - Footer renders.

  Stop the dev server with Ctrl+C when done.

- [ ] **Step 3: Verify the build still compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds. `/cart` and `/order-success` will 404 in the build output for now — that's fine, those are added in later tasks.

- [ ] **Step 4: Commit**

  ```bash
  git add app/page.tsx
  git commit -m "feat(phase-1): replace starter home page with hero + catalog + inquiry"
  ```

---

## Task 20: Build cart-item and cart-list components

**Files:**
- Create: `components/cart/cart-item.tsx`, `components/cart/cart-list.tsx`

- [ ] **Step 1: Write `cart-item.tsx`**

  Client Component with Motion layout animation. The `layout` prop on `motion.li` gives smooth reflow when other items are added or removed.

  ```tsx
  "use client";

  import { motion } from "motion/react";
  import { Minus, Plus, Trash2 } from "lucide-react";

  import { Button } from "@/components/ui/button";
  import { useCartStore, type CartItem as CartItemType } from "./cart-store";
  import { formatCurrency } from "@/lib/format";

  export function CartItem({ item }: { item: CartItemType }) {
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const removeItem = useCartStore((s) => s.removeItem);

    const lineTotal = item.unitPrice * item.quantity;

    return (
      <motion.li
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {item.productName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Flavor: <span className="text-foreground">{item.flavor}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatCurrency(item.unitPrice)} each
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Decrease quantity"
              onClick={() =>
                updateQuantity(item.productId, item.flavor, item.quantity - 1)
              }
            >
              <Minus />
            </Button>
            <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Increase quantity"
              onClick={() =>
                updateQuantity(item.productId, item.flavor, item.quantity + 1)
              }
            >
              <Plus />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="min-w-[5ch] text-right text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(lineTotal)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove from cart"
              onClick={() => removeItem(item.productId, item.flavor)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </motion.li>
    );
  }
  ```

- [ ] **Step 2: Write `cart-list.tsx`**

  Client Component that wraps the list in `AnimatePresence` and handles the empty state + hydration guard.

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { AnimatePresence } from "motion/react";
  import { ShoppingBag } from "lucide-react";

  import { CartItem } from "./cart-item";
  import { useCartItems, useCartSubtotal } from "./cart-store";
  import { formatCurrency } from "@/lib/format";

  export function CartList() {
    const [mounted, setMounted] = useState(false);
    const items = useCartItems();
    const subtotal = useCartSubtotal();

    useEffect(() => setMounted(true), []);

    if (!mounted) {
      return (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading your cart…
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <ShoppingBag className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Your cart is empty
          </p>
          <p className="text-xs text-muted-foreground">
            Browse the catalog and add a few items to get started.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <CartItem
                key={`${item.productId}-${item.flavor}`}
                item={item}
              />
            ))}
          </AnimatePresence>
        </ul>
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-5 py-4">
          <span className="text-sm font-medium text-muted-foreground">
            Subtotal
          </span>
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {formatCurrency(subtotal)}
          </span>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 4: Commit**

  ```bash
  git add components/cart/cart-item.tsx components/cart/cart-list.tsx
  git commit -m "feat(phase-1): add cart-item and cart-list with layout animation"
  ```

---

## Task 21: Build the checkout form

**Files:**
- Create: `components/cart/checkout-form.tsx`

- [ ] **Step 1: Write the checkout form**

  Client Component that reads cart items from the zustand store, builds the `orderSchema`-shaped payload, and submits it to `placeOrderAction`. On validation error from the Server Action, shows the message inline. On success, the action redirects — the client never sees the result.

  ```tsx
  "use client";

  import { useActionState, startTransition } from "react";
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
  import { useCartItems } from "./cart-store";
  import {
    placeOrderAction,
    type PlaceOrderState,
  } from "@/app/actions/place-order";
  import { orderSchema, type OrderInput } from "@/lib/schemas/order";

  const initialState: PlaceOrderState = { ok: false };

  // Form-only subset — items come from the cart store, not from RHF.
  type CheckoutFormValues = Omit<OrderInput, "items">;

  const checkoutFormSchema = orderSchema.omit({ items: true });

  export function CheckoutForm() {
    const [state, formAction, pending] = useActionState(
      placeOrderAction,
      initialState
    );
    const items = useCartItems();

    const form = useForm<CheckoutFormValues>({
      resolver: zodResolver(checkoutFormSchema),
      defaultValues: {
        firstName: "",
        lastName: "",
        email: "",
        notes: "",
      },
    });

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
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane" {...field} />
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
                    <Input placeholder="Doe" {...field} />
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
            <Send data-icon="inline-start" />
            {pending ? "Submitting..." : "Submit order"}
          </Button>
        </form>
      </Form>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npx tsc --noEmit
  ```

  Expected: passes.

- [ ] **Step 3: Commit**

  ```bash
  git add components/cart/checkout-form.tsx
  git commit -m "feat(phase-1): add checkout form bridging react-hook-form and Server Action"
  ```

---

## Task 22: Wire up the cart page

**Files:**
- Create: `app/cart/page.tsx`, `app/cart/cart-view.tsx`

- [ ] **Step 1: Write `cart-view.tsx`** (client island)

  The cart page shell is a Server Component, but the cart list and checkout form are client-side — they read from the zustand store. This intermediate component bundles them together so the page.tsx can stay server-only.

  ```tsx
  "use client";

  import { CartList } from "@/components/cart/cart-list";
  import { CheckoutForm } from "@/components/cart/checkout-form";

  export function CartView() {
    return (
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Your cart
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Review your order
            </h1>
          </div>
          <CartList />
        </div>
        <div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="mb-5 flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Checkout
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                Send your order
              </h2>
            </div>
            <CheckoutForm />
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Write `app/cart/page.tsx`** (server shell)

  ```tsx
  import type { Metadata } from "next";
  import { SiteHeader } from "@/components/site/header";
  import { SiteFooter } from "@/components/site/footer";
  import { CartView } from "./cart-view";

  export const metadata: Metadata = {
    title: "Cart",
    description: "Review your DirectMS order and submit for fulfillment.",
  };

  export default function CartPage() {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <CartView />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }
  ```

- [ ] **Step 3: Run the dev server and walk the checkout flow**

  ```bash
  npm run dev
  ```

  In the browser:
  - Start from `/` and add 2–3 items with different flavors.
  - Navigate to `/cart`.
  - Verify cart items display with qty controls, line totals, and subtotal.
  - Try +/− and remove — confirm Motion layout animation is smooth.
  - Fill in the checkout form with invalid email → RHF shows field-level error.
  - Fill in valid data and submit → should redirect to `/order-success?order=DM-XXXXXX`. Since the page doesn't exist yet it will 404 — expected. Task 23 fixes that.

  Stop the dev server.

- [ ] **Step 4: Commit**

  ```bash
  git add app/cart
  git commit -m "feat(phase-1): add /cart route with cart list and checkout form"
  ```

---

## Task 23: Build the order-success page

**Files:**
- Create: `app/order-success/page.tsx`, `components/cart/clear-on-mount.tsx`

- [ ] **Step 1: Write the clear-on-mount client island**

  The order-success page is a Server Component, but clearing the cart has to happen client-side (the store lives in localStorage). This tiny island mounts once and calls `clear()`.

  ```tsx
  "use client";

  import { useEffect } from "react";
  import { useCartStore } from "./cart-store";

  export function ClearOnMount() {
    const clear = useCartStore((s) => s.clear);
    useEffect(() => {
      clear();
    }, [clear]);
    return null;
  }
  ```

- [ ] **Step 2: Write `app/order-success/page.tsx`**

  Server Component. Reads the `?order=` query param via async `searchParams` (Next.js 16 requirement) and renders a confirmation screen. Mounts `<ClearOnMount />` to empty the cart.

  ```tsx
  import type { Metadata } from "next";
  import Link from "next/link";
  import { CheckCircle2, ArrowRight } from "lucide-react";

  import { SiteHeader } from "@/components/site/header";
  import { SiteFooter } from "@/components/site/footer";
  import { ClearOnMount } from "@/components/cart/clear-on-mount";
  import { Button } from "@/components/ui/button";

  export const metadata: Metadata = {
    title: "Order received",
    description: "Your DirectMS order has been received.",
  };

  export default async function OrderSuccessPage({
    searchParams,
  }: {
    searchParams: Promise<{ order?: string }>;
  }) {
    const { order } = await searchParams;
    const orderNumber = order && /^DM-[A-Z0-9]{3,}$/.test(order) ? order : null;

    return (
      <>
        <SiteHeader />
        <main className="flex-1">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 py-24 text-center">
            <ClearOnMount />
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-8 text-primary" />
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Order received
              </h1>
              <p className="max-w-md text-pretty text-base text-muted-foreground">
                Thanks — we&apos;ve got your order and will be in touch shortly
                to confirm fulfillment.
              </p>
            </div>
            {orderNumber ? (
              <div className="rounded-xl border border-border bg-card px-6 py-4 text-sm">
                <span className="text-muted-foreground">Order number</span>
                <br />
                <span className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                  {orderNumber}
                </span>
              </div>
            ) : null}
            <Button asChild size="lg">
              <Link href="/">
                Back to catalog
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }
  ```

- [ ] **Step 3: Run the dev server and verify the full happy path**

  ```bash
  npm run dev
  ```

  Walk through end-to-end:
  - `/` → add 2 items → `/cart` → fill checkout → submit → redirects to `/order-success?order=DM-XXXXXX`.
  - Verify the order number displays.
  - Verify the cart badge in the header now shows `0` (cleared on mount).
  - Verify navigating back to `/` and then `/cart` shows an empty cart.

  Stop the dev server.

- [ ] **Step 4: Verify the build succeeds**

  ```bash
  npm run build
  ```

  Expected: all three routes (`/`, `/cart`, `/order-success`) appear in the build output.

- [ ] **Step 5: Commit**

  ```bash
  git add app/order-success components/cart/clear-on-mount.tsx
  git commit -m "feat(phase-1): add order-success page with cart auto-clear"
  ```

---

## Task 24: Accessibility and design audit

**Files:**
- No code changes unless the audit surfaces issues

Phase 1 is about to hit its definition of done. Before claiming it complete, run the `web-design-guidelines` skill for a Vercel-hosted accessibility/UX audit. The spec (§5.2 and §8.4) explicitly requires this pass.

- [ ] **Step 1: Invoke the `web-design-guidelines` skill**

  Request a review of the Phase 1 surfaces. The skill fetches fresh guidelines from the Vercel repo and reports findings in `file:line` format.

  ```
  Invoke the web-design-guidelines skill with argument:
    components/site/header.tsx components/site/hero.tsx components/site/footer.tsx components/products/product-card.tsx components/products/product-grid.tsx components/cart/cart-list.tsx components/cart/cart-item.tsx components/cart/checkout-form.tsx components/inquiry/inquiry-form.tsx app/page.tsx app/cart/page.tsx app/cart/cart-view.tsx app/order-success/page.tsx
  ```

- [ ] **Step 2: Categorize findings**

  Group the skill's output into three buckets:
  - **Must fix before Phase 1 done:** accessibility blockers (keyboard trap, missing labels, contrast failures against WCAG AA), touch target size violations on primary actions.
  - **Nice to fix:** non-blocking polish (spacing, minor hover states, missing focus visible on secondary actions).
  - **Defer to Phase 2/3:** anything requiring backend work or large structural changes.

- [ ] **Step 3: Fix the must-fix items inline**

  For each must-fix finding, make the narrowest possible change. Examples of likely findings and the fix pattern:

  - **Missing `aria-label` on icon-only button:** add `aria-label="<description>"` to the `<Button>`.
  - **Color contrast below 4.5:1 for body text:** tweak the `--muted-foreground` value in `globals.css` toward the foreground end.
  - **Form input without visible label:** ensure `FormLabel` is rendered (not `sr-only`).
  - **Touch target under 44px:** bump the `size` variant on the button (e.g., `size-sm` → `size-default`).

  After each fix, re-run `npx tsc --noEmit` and visually verify in `npm run dev`.

- [ ] **Step 4: Log deferred findings in the spec**

  If any findings are deferred to Phase 2 or 3, append them to the relevant phase's open questions section in `docs/superpowers/specs/2026-04-11-directms-catalog-design.md` so they aren't lost.

- [ ] **Step 5: Commit**

  If the audit produced any fixes, commit them together with the finding summary in the body.

  ```bash
  git add -p  # review changes file-by-file
  git commit -m "fix(phase-1): address web-design-guidelines audit findings

  - [summary of each fix]"
  ```

  If the audit produced no must-fix items, skip the commit and note the pass in the next task.

---

## Task 25: Final Phase 1 verification and definition-of-done check

**Files:**
- Modify: `CLAUDE.md` (update the phase tracker table)

This task runs the `verification-before-completion` skill and walks the full definition-of-done checklist from §5.8 of the spec before marking Phase 1 complete.

- [ ] **Step 1: Invoke the `verification-before-completion` skill**

  Run the skill against the Phase 1 scope. Follow its checklist; do not skip steps.

- [ ] **Step 2: Walk the §5.8 definition of done**

  Explicitly verify each bullet in the spec:

  - [ ] `npm run dev` boots cleanly (no errors in terminal, no console errors in browser devtools)
  - [ ] Full walkthrough: catalog → pick flavor → add to cart → `/cart` → fill checkout → redirects to `/order-success`
  - [ ] Inquiry form submits and shows success toast
  - [ ] Cart survives a hard refresh on `/cart`
  - [ ] Removing items from `/cart` animates smoothly and updates the subtotal
  - [ ] Order-success page clears the cart and shows the order number
  - [ ] `npm run build` passes with all three routes listed
  - [ ] `npm run lint` passes with no errors

  ```bash
  npm run build && npm run lint
  ```

  Expected: both pass. Fix any errors before proceeding.

- [ ] **Step 3: Update the phase tracker in `CLAUDE.md`**

  Change the Phase 1 row from "Not started" to "Complete" in the delivery phases table.

  Find this block in `CLAUDE.md`:

  ```markdown
  | Phase | Status | Scope |
  |---|---|---|
  | **Phase 1** — Frontend only | Not started | Hardcoded products, stubbed Server Actions, full UI walkthrough |
  ```

  Replace with:

  ```markdown
  | Phase | Status | Scope |
  |---|---|---|
  | **Phase 1** — Frontend only | Complete | Hardcoded products, stubbed Server Actions, full UI walkthrough |
  ```

- [ ] **Step 4: Invoke `requesting-code-review` skill**

  Per `CLAUDE.md`, each phase ends with a code review pass. Request a review covering all Phase 1 commits.

- [ ] **Step 5: Final commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs(phase-1): mark Phase 1 complete in tracker"
  ```

  Phase 1 is done. Next phase is Phase 2 (Supabase + Resend) — generate its implementation plan from §6 of the spec via the `writing-plans` skill before starting implementation.

---

## Self-review (post-writing)

**Spec coverage check:**
- §5.1 Pre-work — covered by Tasks 1, 2, 3 (delete starter, install deps, install primitives, configure Inter, update metadata)
- §5.2 Design process — Task 4 applies the palette directly; Task 24 runs `web-design-guidelines` audit
- §5.3 Seed data — Task 6 creates `lib/products.seed.ts` with all 9 products; Task 5 copies images
- §5.4 Component tree — covered across Tasks 9, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23
- §5.5 Server Actions stubbed — Tasks 10, 11
- §5.6 Cart state schema — Task 9 (`CartItem` type and helpers)
- §5.7 Motion scope — Task 15 (hero stagger), Task 16 (card lift), Task 20 (cart layout animation), Task 3 (Sonner toast mount). View transitions deliberately deferred — noted in design foundation.
- §5.8 Definition of done — Task 25 explicitly walks every bullet

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N", no "add appropriate error handling" shortcuts. Every code block is concrete.

**Type consistency:**
- `Product` type defined in Task 6, referenced consistently as `Product` in Tasks 16, 17.
- `CartItem` type defined in Task 9, referenced as `CartItemType` (aliased import) in Task 20.
- `OrderInput` / `OrderItemInput` defined in Task 8, used in Task 10 (action) and Task 21 (checkout form).
- `InquiryInput` defined in Task 8, used in Tasks 11 and 18.
- `PlaceOrderState` / `SendInquiryState` defined in Tasks 10 and 11, consumed as `useActionState` initial state in Tasks 21 and 18.
- `useCartStore`, `useCartItems`, `useCartCount`, `useCartSubtotal` all defined in Task 9, consumed consistently thereafter.

**Dependency ordering check:**
- Tasks that create types come before tasks that consume them.
- `cart-store.ts` (Task 9) comes before `cart-badge.tsx` (Task 13), `product-card.tsx` (Task 16), `cart-item.tsx` (Task 20), `checkout-form.tsx` (Task 21), `clear-on-mount.tsx` (Task 23).
- `place-order.ts` (Task 10) comes before `checkout-form.tsx` (Task 21).
- `send-inquiry.ts` (Task 11) comes before `inquiry-form.tsx` (Task 18).
- `inquiry-form.tsx` (Task 18) comes before the home page (Task 19) which imports it.
- `cart-list.tsx` and `cart-item.tsx` (Task 20) come before `cart-view.tsx` (Task 22) which imports them.
- `header.tsx` (Task 14) and `footer.tsx` (Task 12) come before the pages (Tasks 19, 22, 23) that mount them.
- `clear-on-mount.tsx` is created in Task 23 alongside its only consumer (`order-success/page.tsx`) — colocated, so no dependency ordering issue.

Plan is internally consistent. Execute in order, one task per commit.
