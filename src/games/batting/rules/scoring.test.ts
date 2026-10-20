import { describe, expect, it } from 'vitest'
import { isBetter, totalOf } from './scoring'

describe('totalOf', () => {
  it('결과별 점수를 더하고 홈런·안타 수를 센다', () => {
    expect(totalOf(['homerun', 'triple', 'double', 'single', 'out', 'foul', 'whiff', 'looking'])).toEqual({
      points: 22,
      homeruns: 1,
      hits: 4,
    })
  })

  it('10구 모두 홈런이면 100점', () => {
    expect(totalOf(Array(10).fill('homerun')).points).toBe(100)
  })
})

describe('isBetter', () => {
  it('총점 → 홈런 수 → 안타 수', () => {
    expect(isBetter({ points: 20, homeruns: 0, hits: 5 }, { points: 18, homeruns: 1, hits: 2 })).toBe(true)
    expect(isBetter({ points: 20, homeruns: 2, hits: 2 }, { points: 20, homeruns: 1, hits: 5 })).toBe(true)
    expect(isBetter({ points: 20, homeruns: 1, hits: 6 }, { points: 20, homeruns: 1, hits: 5 })).toBe(true)
  })

  it('모두 같으면 먼저 세운 기록 유지', () => {
    const t = { points: 20, homeruns: 1, hits: 5 }
    expect(isBetter(t, { ...t })).toBe(false)
    expect(isBetter(t, null)).toBe(true)
  })
})
