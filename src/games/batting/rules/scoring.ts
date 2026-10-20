import type { Outcome } from './judge'

/** 결과별 점수. 최대 10구 × 10점 = 100점 */
export const OUTCOME_POINTS: Record<Outcome, number> = {
  homerun: 10,
  triple: 6,
  double: 4,
  single: 2,
  out: 0,
  foul: 0,
  whiff: 0,
  looking: 0,
}

const HITS: readonly Outcome[] = ['homerun', 'triple', 'double', 'single']

export function isHit(outcome: Outcome): boolean {
  return HITS.includes(outcome)
}

export type Totals = {
  points: number
  homeruns: number
  /** 안타 이상 (안타·2루타·3루타·홈런) */
  hits: number
}

export function totalOf(outcomes: readonly Outcome[]): Totals {
  return {
    points: outcomes.reduce((sum, o) => sum + OUTCOME_POINTS[o], 0),
    homeruns: outcomes.filter((o) => o === 'homerun').length,
    hits: outcomes.filter(isHit).length,
  }
}

/** 총점 → 홈런 수 → 안타 이상 개수 순으로 a가 b보다 좋은지. 모두 같으면 먼저 세운 기록(b)을 유지한다 */
export function isBetter(a: Totals, b: Totals | null): boolean {
  if (!b) return true
  if (a.points !== b.points) return a.points > b.points
  if (a.homeruns !== b.homeruns) return a.homeruns > b.homeruns
  return a.hits > b.hits
}
