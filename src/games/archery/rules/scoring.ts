import { type Distance, RING_WIDTH, ROUNDS, TARGET_RADIUS, TOTAL_ARROWS, X_RADIUS } from '../constants'

export type Point = { x: number; y: number }

/** 화살 한 발의 점수 */
export type ArrowScore = {
  /** 1~8점 링은 정수, 9·10점 링은 소수점 한 자리(9.0~9.9, 10.0~10.9), 과녁 밖은 0 */
  points: number
  /** 링 번호 1~10 (0은 과녁 밖) */
  ring: number
  /** 가운데 X (10점 링 안쪽 절반, 10.5점 이상) */
  x: boolean
}

export const MISS: ArrowScore = { points: 0, ring: 0, x: false }

/** 소수점 점수를 주는 링 */
const DECIMAL_FROM_RING = 9

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * 과녁 중심에서의 위치로 점수를 매긴다. 링 경계에 걸치면 안쪽(높은 점수)으로 친다.
 * 9·10점 링은 링 안에서 중심에 가까울수록 0.1점씩 더 준다 (동점을 줄이기 위해).
 */
export function scoreImpact(p: Point): ArrowScore {
  const r = Math.hypot(p.x, p.y)
  if (r > TARGET_RADIUS) return MISS
  const ring = Math.max(1, Math.min(10, 10 - Math.floor((r - 1e-9) / RING_WIDTH)))
  const x = r <= X_RADIUS
  if (ring < DECIMAL_FROM_RING) return { points: ring, ring, x }
  // 이 링의 바깥 경계에서 얼마나 안쪽인지 (0~1)
  const outer = (11 - ring) * RING_WIDTH
  const depth = (outer - r) / RING_WIDTH
  const tenths = Math.min(9, Math.max(0, Math.floor(depth * 10 + 1e-9)))
  return { points: round1(ring + tenths / 10), ring, x }
}

/** 화살 한 발 표기: 9·10점 링은 소수점, 과녁 밖은 M */
export function formatArrow(score: ArrowScore): string {
  if (score.ring === 0) return 'M'
  return score.ring >= DECIMAL_FROM_RING ? score.points.toFixed(1) : String(score.points)
}

/** 총점 표기 (항상 소수점 한 자리) */
export function formatPoints(points: number): string {
  return points.toFixed(1)
}

/** i번째 화살(0부터)을 쏘는 거리 */
export function distanceOfArrow(i: number): Distance {
  let n = i
  for (const round of ROUNDS) {
    if (n < round.arrows) return round.distance
    n -= round.arrows
  }
  throw new Error(`화살은 ${TOTAL_ARROWS}발뿐입니다: ${i}`)
}

/** 이 화살이 새 거리의 첫 발인지 (거리 안내용) */
export function isFirstAtDistance(i: number): boolean {
  return i === 0 || distanceOfArrow(i) !== distanceOfArrow(i - 1)
}

export function totalOf(scores: readonly ArrowScore[]) {
  return {
    points: round1(scores.reduce((sum, s) => sum + s.points, 0)),
    xCount: scores.filter((s) => s.x).length,
    /** 10점 링(X 포함) 개수 — 동점일 때 비교 */
    tenCount: scores.filter((s) => s.ring === 10).length,
  }
}
