import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { AUTO_RELEASE_MS, DRAW_MS, RING_WIDTH, TARGET_RADIUS } from '../constants'
import { computeImpact, drawProgress, fatigue, flightMs, shouldAutoRelease, swayOffset, underdrawDrop } from './shot'
import { type Wind, WIND_TIERS, randomWind, windDrift, windLabel, windUnit } from './wind'

const strong = (direction: Wind['direction']): Wind => ({ direction, tier: 'strong', speed: 6 })
const rings = (m: number) => m / RING_WIDTH

describe('바람', () => {
  it('8방향 모두 단위 벡터, 대각선도 길이 1', () => {
    expect(windUnit(0)).toEqual({ x: 0, y: 1 })
    expect(windUnit(2)).toEqual({ x: 1, y: 0 })
    expect(windUnit(4)).toEqual({ x: 0, y: -1 })
    expect(windUnit(6)).toEqual({ x: -1, y: 0 })
    for (const d of [1, 3, 5, 7] as const) expect(Math.hypot(windUnit(d).x, windUnit(d).y)).toBeCloseTo(1)
  })

  it('무작위 바람: 8방향·3단계가 모두 나오고 세기는 단계 범위 안', () => {
    const rng = createRng(11)
    const dirs = new Set<number>()
    const tiers = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const w = randomWind(rng)
      dirs.add(w.direction)
      tiers.add(w.tier)
      expect(w.speed).toBeGreaterThanOrEqual(WIND_TIERS[w.tier].min)
      expect(w.speed).toBeLessThanOrEqual(WIND_TIERS[w.tier].max)
    }
    expect(dirs.size).toBe(8)
    expect(tiers.size).toBe(3)
  })

  it('강한 바람에 밀리는 양: 30m 2~3링 · 50m 5~7링 · 70m 과녁 끝 근처 · 100m 과녁 밖', () => {
    const drift = (d: 30 | 50 | 70 | 100) => rings(Math.abs(windDrift(strong(2), d).x))
    expect(drift(30)).toBeGreaterThanOrEqual(2)
    expect(drift(30)).toBeLessThanOrEqual(3)
    expect(drift(50)).toBeGreaterThanOrEqual(5)
    expect(drift(50)).toBeLessThanOrEqual(7)
    expect(drift(70)).toBeGreaterThanOrEqual(9)
    expect(Math.abs(windDrift(strong(2), 100).x)).toBeGreaterThan(TARGET_RADIUS)
  })

  it('바람 방향대로 밀린다 (← 바람이면 왼쪽, ↓ 바람이면 아래)', () => {
    expect(windDrift(strong(6), 50).x).toBeLessThan(0)
    expect(windDrift(strong(4), 50).y).toBeLessThan(0)
    const ne = windDrift(strong(1), 50)
    expect(ne.x).toBeGreaterThan(0)
    expect(ne.y).toBeGreaterThan(0)
  })

  it('약한 바람은 강한 바람보다 덜 밀린다', () => {
    const light: Wind = { direction: 2, tier: 'light', speed: 1 }
    expect(windDrift(light, 70).x).toBeLessThan(windDrift(strong(2), 70).x / 3)
  })

  it('표시 문구', () => {
    expect(windLabel({ direction: 1, tier: 'strong', speed: 5.2 })).toBe('강한 바람 ↗ 5.2m/s')
  })
})

describe('당기기와 흔들림', () => {
  it('0.8초에 완전히 당겨진다', () => {
    expect(drawProgress(0)).toBe(0)
    expect(drawProgress(DRAW_MS / 2)).toBeCloseTo(0.5)
    expect(drawProgress(DRAW_MS * 3)).toBe(1)
  })

  it('완전히 당긴 뒤 2초까지는 흔들림이 그대로, 그 뒤로 커진다', () => {
    expect(fatigue(DRAW_MS + 1999)).toBe(1)
    expect(fatigue(DRAW_MS + 4000)).toBeGreaterThan(1.3)
    expect(fatigue(DRAW_MS + 8000)).toBeGreaterThan(fatigue(DRAW_MS + 4000))
  })

  it('10초가 지나면 자동 발사', () => {
    expect(shouldAutoRelease(AUTO_RELEASE_MS - 1)).toBe(false)
    expect(shouldAutoRelease(AUTO_RELEASE_MS)).toBe(true)
  })

  it('흔들림은 거리가 멀수록 크다 (과녁 위에서)', () => {
    const maxSway = (d: 30 | 100) => {
      let m = 0
      for (let t = 0; t < 10000; t += 16) {
        const s = swayOffset(t, DRAW_MS, d, 1.2)
        m = Math.max(m, Math.hypot(s.x, s.y))
      }
      return m
    }
    expect(maxSway(100)).toBeGreaterThan(maxSway(30) * 3)
    // 30m에서는 지친 상태가 아니면 링 1개 남짓 흔들린다
    expect(rings(maxSway(30))).toBeLessThan(1.2)
  })

  it('덜 당기면 아래로 처지고, 완전히 당기면 처지지 않는다', () => {
    expect(underdrawDrop(1, 100)).toBe(0)
    expect(rings(underdrawDrop(0.5, 30))).toBeGreaterThan(3)
    expect(underdrawDrop(0.5, 100)).toBeGreaterThan(underdrawDrop(0.5, 30))
  })

  it('비행 시간은 거리에 비례', () => {
    expect(flightMs(70)).toBeCloseTo(1000)
    expect(flightMs(100)).toBeGreaterThan(flightMs(30))
  })
})

describe('computeImpact', () => {
  it('바람이 없고 흔들림 없이 완전히 당기면 조준한 곳에 꽂힌다', () => {
    const calm: Wind = { direction: 0, tier: 'light', speed: 0 }
    expect(computeImpact({ aim: { x: 0.1, y: -0.2 }, sway: { x: 0, y: 0 }, wind: calm, distance: 70, progress: 1 })).toEqual({
      x: 0.1,
      y: -0.2,
    })
  })

  it('바람만큼 반대로 조준하면 가운데에 꽂힌다', () => {
    const wind = strong(3)
    const drift = windDrift(wind, 100)
    const impact = computeImpact({ aim: { x: -drift.x, y: -drift.y }, sway: { x: 0, y: 0 }, wind, distance: 100, progress: 1 })
    expect(impact.x).toBeCloseTo(0)
    expect(impact.y).toBeCloseTo(0)
  })
})
