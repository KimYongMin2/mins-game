import { createRng } from '../../../shared/random'
import { PASS_MS } from '../constants'

// 타이밍전 게이지. 막대가 왼쪽 끝(−1) ↔ 오른쪽 끝(+1)을 왔다 갔다 하고, 노란 구간(과녁) 한가운데에서 누르면 가장 세다.
// 과녁 위치는 막대가 한 번 지나갈 때마다 바뀐다 (처음엔 늘 가운데라 외워서 칠 수 있었음).

export type Grade = 'perfect' | 'great' | 'good' | 'miss'

/** 과녁 한가운데에서 떨어진 정도(게이지 끝까지 = 1) 이내면 그 판정. 위에서부터 */
export const GRADES: readonly { grade: Exclude<Grade, 'miss'>; within: number; push: number }[] = [
  { grade: 'perfect', within: 0.08, push: 0.16 },
  { grade: 'great', within: 0.2, push: 0.1 },
  { grade: 'good', within: 0.4, push: 0.05 },
]

export const GRADE_LABEL: Record<Grade, string> = { perfect: '완벽!', great: '좋음', good: '보통', miss: '놓침' }

export function pushOf(grade: Grade): number {
  return GRADES.find((g) => g.grade === grade)?.push ?? 0
}

/** 당기기를 시작한 뒤 elapsed ms에서 몇 번째 지나감인지, 막대 위치(−1~1) */
export function markerAt(elapsed: number): { pass: number; x: number } {
  const t = Math.max(0, elapsed)
  const pass = Math.floor(t / PASS_MS)
  const u = (t % PASS_MS) / PASS_MS
  return { pass, x: pass % 2 === 0 ? -1 + 2 * u : 1 - 2 * u }
}

/** 과녁 한가운데가 놓일 수 있는 범위 (−0.6 ~ 0.6) */
export const ZONE_RANGE = 0.6

/** zoneSeed로 정해지는 pass번째 지나감의 과녁 위치. 같은 시드·번호면 늘 같다 */
export function zoneCenter(zoneSeed: number, pass: number): number {
  const rng = createRng((zoneSeed + Math.imul(pass + 1, 0x9e3779b9)) >>> 0)
  return (rng.next() * 2 - 1) * ZONE_RANGE
}

export function gradeAt(elapsed: number, zoneSeed: number): { pass: number; grade: Grade } {
  const { pass, x } = markerAt(elapsed)
  const off = Math.abs(x - zoneCenter(zoneSeed, pass))
  return { pass, grade: GRADES.find((g) => off <= g.within)?.grade ?? 'miss' }
}

/** pass번째 지나감에서 막대가 x에 오는 시각 (당기기 시작부터 ms) */
export function elapsedAt(pass: number, x: number): number {
  const u = pass % 2 === 0 ? (x + 1) / 2 : (1 - x) / 2
  return (pass + u) * PASS_MS
}
