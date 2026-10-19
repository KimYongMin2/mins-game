import { describe, expect, it } from 'vitest'
import { RING_WIDTH, TARGET_RADIUS, TOTAL_ARROWS, X_RADIUS } from '../constants'
import { distanceOfArrow, formatArrow, formatPoints, isFirstAtDistance, scoreImpact, totalOf } from './scoring'

describe('scoreImpact', () => {
  const at = (rings: number) => scoreImpact({ x: 0, y: rings * RING_WIDTH })

  it('정중앙은 X 10.9점', () => {
    expect(scoreImpact({ x: 0, y: 0 })).toEqual({ points: 10.9, ring: 10, x: true })
  })

  it('X는 10점 링의 안쪽 절반 (10.5점 이상)', () => {
    expect(scoreImpact({ x: X_RADIUS, y: 0 })).toMatchObject({ ring: 10, x: true, points: 10.5 })
    expect(at(0.6)).toMatchObject({ ring: 10, x: false, points: 10.4 })
  })

  it.each([
    [0.05, 10.9],
    [0.35, 10.6],
    [0.95, 10.0],
    [1.05, 9.9],
    [1.5, 9.5],
    [1.95, 9.0],
  ])('9·10점 링은 소수점: 중심에서 링 %f개 → %f점', (rings, points) => {
    expect(at(rings).points).toBe(points)
  })

  it.each([
    [2.5, 8],
    [4.2, 6],
    [9.5, 1],
  ])('8점 이하는 정수: 링 %f개 → %i점', (rings, points) => {
    expect(at(rings)).toMatchObject({ points, ring: points })
  })

  it('링 경계에 걸치면 안쪽 점수 (그 링의 가장 낮은 소수점)', () => {
    expect(scoreImpact({ x: RING_WIDTH, y: 0 })).toMatchObject({ ring: 10, points: 10.0 })
    expect(scoreImpact({ x: RING_WIDTH * 2, y: 0 })).toMatchObject({ ring: 9, points: 9.0 })
    expect(scoreImpact({ x: RING_WIDTH * 3, y: 0 }).points).toBe(8)
    expect(scoreImpact({ x: TARGET_RADIUS, y: 0 }).points).toBe(1)
  })

  it('과녁 밖은 0점', () => {
    expect(scoreImpact({ x: TARGET_RADIUS + 0.001, y: 0 })).toEqual({ points: 0, ring: 0, x: false })
  })

  it('대각선도 거리로 판정', () => {
    const d = (RING_WIDTH * 2.5) / Math.SQRT2
    expect(scoreImpact({ x: d, y: -d }).points).toBe(8)
  })
})

describe('표기', () => {
  it('9·10점은 소수점, 나머지는 정수, 빗나가면 M', () => {
    expect(formatArrow({ points: 10.7, ring: 10, x: true })).toBe('10.7')
    expect(formatArrow({ points: 9, ring: 9, x: false })).toBe('9.0')
    expect(formatArrow({ points: 7, ring: 7, x: false })).toBe('7')
    expect(formatArrow({ points: 0, ring: 0, x: false })).toBe('M')
    expect(formatPoints(87)).toBe('87.0')
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
  it('합계(소수점 한 자리), X 개수, 10점 개수', () => {
    expect(
      totalOf([
        { points: 10.7, ring: 10, x: true },
        { points: 10.2, ring: 10, x: false },
        { points: 9.3, ring: 9, x: false },
        { points: 7, ring: 7, x: false },
        { points: 0, ring: 0, x: false },
      ]),
    ).toEqual({ points: 37.2, xCount: 1, tenCount: 2 })
  })

  it('소수 덧셈 오차 없이 한 자리로', () => {
    const tenths = Array.from({ length: 10 }, () => ({ points: 9.1, ring: 9, x: false }))
    expect(totalOf(tenths).points).toBe(91)
  })
})
