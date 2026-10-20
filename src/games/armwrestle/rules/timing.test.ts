import { describe, expect, it } from 'vitest'
import { PASS_MS } from '../constants'
import { ZONE_RANGE, elapsedAt, gradeAt, markerAt, pushOf, zoneCenter } from './timing'

describe('타이밍 게이지', () => {
  it('막대는 왼쪽 끝 → 오른쪽 끝 → 왼쪽 끝으로 왔다 갔다', () => {
    expect(markerAt(0)).toEqual({ pass: 0, x: -1 })
    expect(markerAt(PASS_MS / 2).x).toBeCloseTo(0)
    expect(markerAt(PASS_MS)).toEqual({ pass: 1, x: 1 })
    expect(markerAt(PASS_MS * 1.5).x).toBeCloseTo(0)
  })

  it('과녁 한가운데일수록 높은 판정', () => {
    const seed = 7
    const c = zoneCenter(seed, 0)
    const hit = elapsedAt(0, c)
    // 첫 지나감은 왼쪽 → 오른쪽: 0.1ms 늦으면 막대가 0.1 / (PASS_MS / 2)만큼 더 감
    const later = (d: number) => hit + (d * PASS_MS) / 2
    expect(gradeAt(hit, c).grade).toBe('perfect')
    expect(gradeAt(later(0.07), c).grade).toBe('great')
    expect(gradeAt(later(0.15), c).grade).toBe('good')
    expect(gradeAt(later(0.3), c).grade).toBe('miss')
    expect(gradeAt(later(-0.6), c).grade).toBe('miss')
    expect(pushOf('perfect')).toBeGreaterThan(pushOf('great'))
    expect(pushOf('miss')).toBe(0)
  })

  it('과녁은 누를 때마다 다른 곳에, 범위 안에서', () => {
    const centers = Array.from({ length: 30 }, (_, n) => zoneCenter(123, n))
    for (const c of centers) expect(Math.abs(c)).toBeLessThanOrEqual(ZONE_RANGE)
    expect(new Set(centers.map((c) => c.toFixed(2))).size).toBeGreaterThan(20)
    expect(zoneCenter(123, 5)).toBe(centers[5])
    // 왼쪽 끝 근처와 오른쪽 끝 근처 모두 나온다
    expect(Math.min(...centers)).toBeLessThan(-0.3)
    expect(Math.max(...centers)).toBeGreaterThan(0.3)
  })

  it('elapsedAt은 막대가 그 자리에 오는 시각', () => {
    for (const pass of [0, 1, 4]) for (const x of [-0.5, 0, 0.3]) expect(markerAt(elapsedAt(pass, x)).x).toBeCloseTo(x)
  })
})
