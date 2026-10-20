import type { Outcome } from './judge'

// 점수 = 앞으로 날아간 거리(m). 파울·헛스윙·스트라이크는 0점

const HITS: readonly Outcome[] = ['homerun', 'triple', 'double', 'single']

export function isHit(outcome: Outcome): boolean {
  return HITS.includes(outcome)
}

/** 공 하나의 점수 */
export function pointsOf(r: { distance: number | null }): number {
  return r.distance ?? 0
}

export type Totals = {
  points: number
  homeruns: number
  /** 안타 이상 (안타·2루타·3루타·홈런) */
  hits: number
}

export function totalOf(records: readonly { outcome: Outcome; distance: number | null }[]): Totals {
  return {
    points: records.reduce((sum, r) => sum + pointsOf(r), 0),
    homeruns: records.filter((r) => r.outcome === 'homerun').length,
    hits: records.filter((r) => isHit(r.outcome)).length,
  }
}

/** 총점 → 홈런 수 → 안타 이상 개수 순으로 a가 b보다 좋은지. 모두 같으면 먼저 세운 기록(b)을 유지한다 */
export function isBetter(a: Totals, b: Totals | null): boolean {
  if (!b) return true
  if (a.points !== b.points) return a.points > b.points
  if (a.homeruns !== b.homeruns) return a.homeruns > b.homeruns
  return a.hits > b.hits
}
