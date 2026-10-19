import { describe, expect, it } from 'vitest'
import { EMPTY_SELECTION, completeSelection, isSelectionComplete } from './pitchSelection'
import { createRng } from '../../../shared/random'

describe('pitchSelection', () => {
  it('구종과 높이를 모두 골라야 완성', () => {
    expect(isSelectionComplete(EMPTY_SELECTION)).toBe(false)
    expect(isSelectionComplete({ key: 3, height: null })).toBe(false)
    expect(isSelectionComplete({ key: 3, height: 'low' })).toBe(true)
  })

  it('고른 그대로 투구가 된다', () => {
    expect(completeSelection({ key: 4, height: 'high' }, createRng(1))).toEqual({
      type: 'breaking',
      isBall: true,
      height: 'high',
    })
    expect(completeSelection({ key: 1, height: 'low' }, createRng(1))).toEqual({
      type: 'fastball',
      isBall: false,
      height: 'low',
    })
  })

  it('고르지 않은 항목은 무작위로 채우고, 고른 항목은 유지한다', () => {
    const rng = createRng(42)
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const call = completeSelection({ key: 2, height: null }, rng)
      expect(call.type).toBe('fastball')
      expect(call.isBall).toBe(true)
      seen.add(call.height)
    }
    expect(seen).toEqual(new Set(['high', 'low']))
  })

  it('아무것도 안 고르면 네 구종이 모두 나온다', () => {
    const rng = createRng(7)
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const c = completeSelection(EMPTY_SELECTION, rng)
      seen.add(`${c.type}-${c.isBall}`)
    }
    expect(seen.size).toBe(4)
  })
})
