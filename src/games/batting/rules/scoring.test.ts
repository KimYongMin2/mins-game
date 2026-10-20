import { describe, expect, it } from 'vitest'
import { isBetter, totalOf } from './scoring'

describe('totalOf', () => {
  it('점수는 비거리 합, 파울·헛스윙·스트라이크는 0점', () => {
    expect(
      totalOf([
        { outcome: 'homerun', distance: 128 },
        { outcome: 'double', distance: 80 },
        { outcome: 'out', distance: 20 },
        { outcome: 'foul', distance: null },
        { outcome: 'whiff', distance: null },
        { outcome: 'looking', distance: null },
      ]),
    ).toEqual({ points: 228, homeruns: 1, hits: 2 })
  })
})

describe('isBetter', () => {
  it('총점 → 홈런 수 → 안타 수', () => {
    expect(isBetter({ points: 300, homeruns: 0, hits: 5 }, { points: 280, homeruns: 1, hits: 2 })).toBe(true)
    expect(isBetter({ points: 300, homeruns: 2, hits: 2 }, { points: 300, homeruns: 1, hits: 5 })).toBe(true)
    expect(isBetter({ points: 300, homeruns: 1, hits: 6 }, { points: 300, homeruns: 1, hits: 5 })).toBe(true)
  })

  it('모두 같으면 먼저 세운 기록 유지', () => {
    const t = { points: 300, homeruns: 1, hits: 5 }
    expect(isBetter(t, { ...t })).toBe(false)
    expect(isBetter(t, null)).toBe(true)
  })
})
