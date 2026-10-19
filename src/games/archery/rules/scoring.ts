import { type Distance, RING_WIDTH, ROUNDS, TARGET_RADIUS, TOTAL_ARROWS, X_RADIUS } from '../constants'

export type Point = { x: number; y: number }

/** 화살 한 발의 점수. points 0은 과녁 밖 */
export type ArrowScore = { points: number; x: boolean }

/** 과녁 중심에서의 위치로 점수를 매긴다. 링 경계에 걸치면 안쪽(높은 점수)으로 친다. */
export function scoreImpact(p: Point): ArrowScore {
  const r = Math.hypot(p.x, p.y)
  if (r > TARGET_RADIUS) return { points: 0, x: false }
  const ring = Math.min(10, 10 - Math.floor((r - 1e-9) / RING_WIDTH))
  return { points: Math.max(1, ring), x: r <= X_RADIUS }
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
    points: scores.reduce((sum, s) => sum + s.points, 0),
    xCount: scores.filter((s) => s.x).length,
  }
}
