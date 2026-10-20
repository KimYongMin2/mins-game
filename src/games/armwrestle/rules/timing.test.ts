import { describe, expect, it } from 'vitest'
import { PASS_MS } from '../constants'
import { gradeAt, markerAt, pushOf } from './timing'

describe('타이밍 게이지', () => {
  it('막대는 왼쪽 끝 → 오른쪽 끝 → 왼쪽 끝으로 왔다 갔다', () => {
    expect(markerAt(0)).toEqual({ pass: 0, x: -1 })
    expect(markerAt(PASS_MS / 2).x).toBeCloseTo(0)
    expect(markerAt(PASS_MS)).toEqual({ pass: 1, x: 1 })
    expect(markerAt(PASS_MS * 1.5).x).toBeCloseTo(0)
  })

  it('가운데일수록 높은 판정', () => {
    const mid = PASS_MS / 2
    expect(gradeAt(mid).grade).toBe('perfect')
    expect(gradeAt(mid + PASS_MS * 0.06).grade).toBe('great') // 가운데에서 0.12
    expect(gradeAt(mid + PASS_MS * 0.15).grade).toBe('good') // 0.3
    expect(gradeAt(mid + PASS_MS * 0.3).grade).toBe('miss') // 0.6
    expect(pushOf('perfect')).toBeGreaterThan(pushOf('great'))
    expect(pushOf('miss')).toBe(0)
  })
})
