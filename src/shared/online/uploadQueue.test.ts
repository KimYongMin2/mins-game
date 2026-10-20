import { afterEach, describe, expect, it, vi } from 'vitest'
import { newRecordId } from './uploadQueue'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newRecordId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('UUID v4 형식', () => {
    expect(newRecordId()).toMatch(UUID_V4)
  })

  it('randomUUID가 없는 http 주소에서도 UUID v4를 만든다', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    const ids = new Set(Array.from({ length: 200 }, () => newRecordId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })
})

describe('isAuthError', () => {
  it('토큰 만료·권한 거부는 로그인 문제로 본다', async () => {
    const { isAuthError } = await import('./supabase')
    expect(isAuthError({ code: 'PGRST301', message: 'JWT expired' })).toBe(true)
    expect(isAuthError({ message: 'invalid JWT: unable to parse or verify signature' })).toBe(true)
    expect(isAuthError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(true)
    expect(isAuthError({ status: 401 })).toBe(true)
  })

  it('중복·형식 오류는 로그인 문제가 아니다', async () => {
    const { isAuthError } = await import('./supabase')
    expect(isAuthError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isAuthError({ code: '23514', message: 'violates check constraint' })).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })
})
