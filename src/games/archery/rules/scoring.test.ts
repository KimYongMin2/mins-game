import { describe, expect, it } from 'vitest'
import { RING_WIDTH, TARGET_RADIUS, TOTAL_ARROWS, X_RADIUS } from '../constants'
import { distanceOfArrow, isFirstAtDistance, scoreImpact, totalOf } from './scoring'

describe('scoreImpact', () => {
  it('정중앙은 X 10점', () => {
    expect(scoreImpact({ x: 0, y: 0 })).toEqual({ points: 10, x: true })
    expect(scoreImpact({ x: X_RADIUS, y: 0 })).toEqual({ points: 10, x: true })
  })

  it('X 바깥이지만 10점 링 안이면 10점 (X 아님)', () => {
    expect(scoreImpact({ x: X_RADIUS * 1.5, y: 0 })).toEqual({ points: 10, x: false })
  })

  it.each([
    [0.5, 10],
    [1.5, 9],
    [4.2, 6],
    [9.5, 1],
  ])('중심에서 링 %f개 거리 → %i점', (rings, points) => {
    expect(scoreImpact({ x: 0, y: rings * RING_WIDTH }).points).toBe(points)
  })

  it('링 경계에 걸치면 안쪽 점수', () => {
    expect(scoreImpact({ x: RING_WIDTH, y: 0 }).points).toBe(10)
    expect(scoreImpact({ x: RING_WIDTH * 3, y: 0 }).points).toBe(8)
    expect(scoreImpact({ x: TARGET_RADIUS, y: 0 }).points).toBe(1)
  })

  it('과녁 밖은 0점', () => {
    expect(scoreImpact({ x: TARGET_RADIUS + 0.001, y: 0 })).toEqual({ points: 0, x: false })
    expect(scoreImpact({ x: 0.5, y: 0.5 }).points).toBe(0)
  })

  it('대각선도 거리로 판정', () => {
    const d = (RING_WIDTH * 2.5) / Math.SQRT2
    expect(scoreImpact({ x: d, y: -d }).points).toBe(8)
  })
})

describe('거리 순서', () => {
  it('30m 3발 → 50m 3발 → 70m 3발 → 100m 1발', () => {
    expect(TOTAL_ARROWS).toBe(10)
    expect(Array.from({ length: 10 }, (_, i) => distanceOfArrow(i))).toEqual([
      30, 30, 30, 50, 50, 50, 70, 70, 70, 100,
    ])
    expect(() => distanceOfArrow(10)).toThrow()
  })

  it('거리가 바뀌는 첫 발', () => {
    expect([0, 1, 3, 6, 9].map(isFirstAtDistance)).toEqual([true, false, true, true, true])
  })
})

describe('totalOf', () => {
  it('합계와 X 개수', () => {
    expect(
      totalOf([
        { points: 10, x: true },
        { points: 10, x: false },
        { points: 7, x: false },
        { points: 0, x: false },
      ]),
    ).toEqual({ points: 27, xCount: 1 })
  })
})
