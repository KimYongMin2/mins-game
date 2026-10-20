import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { chooseBotCard } from './memoryBot'

const all = (n: number) => Array.from({ length: n }, () => true)

describe('chooseBotCard', () => {
  it('기억 속에 짝이 있으면 그 쌍을 연다', () => {
    const memory = [null, 3, null, 5, 3, null]
    const first = chooseBotCard(createRng(1), { memory, available: all(6), first: null })
    expect([1, 4]).toContain(first)
  })

  it('둘째 장은 첫 장과 같은 그림을 기억하면 그것', () => {
    const memory = [null, 7, null, null]
    expect(chooseBotCard(createRng(1), { memory, available: [true, true, true, false], first: { index: 3, face: 7 } })).toBe(1)
  })

  it('모르면 기억에 없는 카드를 연다 (아는 카드·이미 연 카드·가져간 카드는 피함)', () => {
    const memory = [2, null, 4, null, null]
    for (let s = 0; s < 50; s++) {
      const pick = chooseBotCard(createRng(s), { memory, available: [true, true, true, false, true], first: { index: 4, face: 9 } })
      expect(pick).toBe(1)
    }
  })

  it('가져간 카드는 기억해도 고르지 않는다', () => {
    const memory = [1, 1, null]
    const pick = chooseBotCard(createRng(1), { memory, available: [false, false, true], first: null })
    expect(pick).toBe(2)
  })
})
