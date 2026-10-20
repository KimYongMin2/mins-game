import { PASS_MS } from '../constants'

// 타이밍전 게이지. 막대가 왼쪽 끝(−1) ↔ 오른쪽 끝(+1)을 왔다 갔다 하고, 가운데(0)에서 누르면 가장 세다.

export type Grade = 'perfect' | 'great' | 'good' | 'miss'

/** 가운데에서 떨어진 정도(끝 = 1) 이내면 그 판정. 위에서부터 */
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

export function gradeAt(elapsed: number): { pass: number; grade: Grade } {
  const { pass, x } = markerAt(elapsed)
  const off = Math.abs(x)
  return { pass, grade: GRADES.find((g) => off <= g.within)?.grade ?? 'miss' }
}
