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
