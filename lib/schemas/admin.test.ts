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
