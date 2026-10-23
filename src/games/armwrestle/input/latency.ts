import { readLocal, writeLocal } from '../../../shared/storage/local'

// 타이밍전 입력 지연 보정값.
// 폰 터치는 손가락이 닿은 뒤 브라우저가 알기까지 0.05~0.1초쯤 늦다(마우스는 0.01~0.02초). '완벽' 폭이 ±15ms라
// 폰에서는 정확히 눌러도 늘 늦게 잡혀 '보통'·'놓침'이 떴다. 시작 화면의 '타이밍 맞추기'에서 직접 재서 저장하고,
// 판정할 때 누른 시각을 그만큼 당긴다. 터치와 그 밖(마우스·펜·키보드)은 따로, 기기에 저장한다.
// (처음엔 경기 중에 누를 때마다 저절로 맞춰 갔는데, 감도 맞추듯 직접 재는 쪽으로 바꿈)

export type InputKind = 'touch' | 'other'
export const INPUT_LABEL: Record<InputKind, string> = { touch: '터치', other: '마우스·키보드' }

/** 재 보기 전 기본 보정값 (ms) */
const DEFAULT_MS: Record<InputKind, number> = { touch: 40, other: 0 }
/** 보정값 범위 (ms) */
export const LATENCY_RANGE = { min: -50, max: 200 } as const

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
