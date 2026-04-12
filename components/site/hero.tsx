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
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
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
              <ArrowRight className="size-4" aria-hidden="true" />
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
