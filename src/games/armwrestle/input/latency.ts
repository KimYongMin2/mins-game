import { readLocal, writeLocal } from '../../../shared/storage/local'

// 타이밍전 입력 지연 자동 보정.
// 폰 터치는 손가락이 닿은 뒤 브라우저가 알기까지 0.05~0.1초쯤 늦다(마우스는 0.01~0.02초). '완벽' 폭이 ±15ms라
// 폰에서는 정확히 눌러도 늘 늦게 잡혀 '보통'·'놓침'이 떴다. 누를 때마다 과녁 한가운데보다 얼마나 늦었는지 재서
// 평균만큼 판정 시각을 당긴다. 터치와 그 밖(마우스·펜·키보드)은 따로, 기기에 저장한다.

export type InputKind = 'touch' | 'other'

/** 처음 보정값 (ms). 재 보기 전 기본 */
const DEFAULT_MS: Record<InputKind, number> = { touch: 40, other: 0 }
/** 보정값 범위 */
const RANGE = { min: -30, max: 120 } as const
/** 이보다 많이 어긋난 건 다른 지나감을 노린 것으로 보고 안 배운다 */
const LEARN_WITHIN_MS = 150
/** 한 번 누를 때 어긋남을 얼마나 반영할지 (지수 평균) */
const LEARN_RATE = 0.2

const KEY = 'armwrestle:latency'

export const inputKindOf = (pointerType: string): InputKind => (pointerType === 'touch' ? 'touch' : 'other')

export function loadLatency(): Record<InputKind, number> {
  try {
    const saved = JSON.parse(readLocal(KEY) ?? 'null') as Partial<Record<InputKind, number>> | null
    return {
      touch: typeof saved?.touch === 'number' ? saved.touch : DEFAULT_MS.touch,
      other: typeof saved?.other === 'number' ? saved.other : DEFAULT_MS.other,
    }
  } catch {
    return { ...DEFAULT_MS }
  }
}

export function saveLatency(latency: Record<InputKind, number>): void {
  writeLocal(KEY, JSON.stringify(latency))
}

/** 보정한 뒤에도 남은 어긋남(ms, +면 늦음)을 반영한 새 보정값 */
export function learnLatency(current: number, residualMs: number): number {
  if (Math.abs(residualMs) > LEARN_WITHIN_MS) return current
  const next = current + residualMs * LEARN_RATE
  return Math.min(RANGE.max, Math.max(RANGE.min, next))
}
