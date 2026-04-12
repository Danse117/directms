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
