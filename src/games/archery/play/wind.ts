import { type Rng, pickOne } from '../../../shared/random'
import { type Distance, WIND_DRIFT_PER_MPS } from '../constants'
import type { Point } from '../rules/scoring'

/** 8방향. 0 = 위(↑)부터 시계 방향으로 45°씩 */
export type WindDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type WindTier = 'light' | 'medium' | 'strong'

export type Wind = {
  direction: WindDirection
  tier: WindTier
  /** m/s */
  speed: number
}

export const WIND_TIERS: Record<WindTier, { label: string; min: number; max: number }> = {
  light: { label: '약한 바람', min: 0.5, max: 2 },
  medium: { label: '중간 바람', min: 2, max: 4 },
  strong: { label: '강한 바람', min: 4, max: 6 },
}

export const WIND_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const

const DIRECTIONS: readonly WindDirection[] = [0, 1, 2, 3, 4, 5, 6, 7]
const TIERS: readonly WindTier[] = ['light', 'medium', 'strong']

/** 방향 8가지 × 세기 3단계 중 무작위 */
export function randomWind(rng: Rng): Wind {
  const tier = pickOne(rng, TIERS)
  const { min, max } = WIND_TIERS[tier]
  return {
    direction: pickOne(rng, DIRECTIONS),
    tier,
    speed: Math.round((min + rng.next() * (max - min)) * 10) / 10,
  }
}

/** 바람이 부는 쪽의 단위 벡터 (대각선도 길이 1) */
export function windUnit(direction: WindDirection): Point {
  const angle = (direction * Math.PI) / 4
  const round = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v)
  return { x: round(Math.sin(angle)), y: round(Math.cos(angle)) }
}

/** 바람 때문에 과녁에서 밀리는 양(m) */
export function windDrift(wind: Wind, distance: Distance): Point {
  const unit = windUnit(wind.direction)
  const amount = wind.speed * WIND_DRIFT_PER_MPS[distance]
  return { x: unit.x * amount, y: unit.y * amount }
}

export function windLabel(wind: Wind): string {
  return `${WIND_TIERS[wind.tier].label} ${WIND_ARROWS[wind.direction]} ${wind.speed.toFixed(1)}m/s`
}
