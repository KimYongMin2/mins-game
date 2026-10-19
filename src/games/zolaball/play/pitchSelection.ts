import type { PitchCall, PitchHeight, PitchType } from './pitch'
import { type Rng, pickOne } from './random'

/** 투수가 고르는 시간. 넘기면 고르지 않은 항목을 무작위로 채워 던진다. */
export const PITCH_CHOICE_MS = 5000

/** 1~4번 구종 키 */
export type PitchKey = 1 | 2 | 3 | 4

export const PITCH_KEYS: readonly PitchKey[] = [1, 2, 3, 4]

export const PITCH_KEY_INFO: Record<PitchKey, { type: PitchType; isBall: boolean; label: string }> = {
  1: { type: 'fastball', isBall: false, label: '직구 스트라이크' },
  2: { type: 'fastball', isBall: true, label: '직구 볼' },
  3: { type: 'breaking', isBall: false, label: '변화구 스트라이크' },
  4: { type: 'breaking', isBall: true, label: '변화구 볼' },
}

export type PitchSelection = {
  key: PitchKey | null
  height: PitchHeight | null
}

export const EMPTY_SELECTION: PitchSelection = { key: null, height: null }

export function isSelectionComplete(sel: PitchSelection): boolean {
  return sel.key !== null && sel.height !== null
}

/** 고르지 않은 항목은 무작위로 채워 투구를 확정한다. */
export function completeSelection(sel: PitchSelection, rng: Rng): PitchCall {
  const key = sel.key ?? pickOne(rng, PITCH_KEYS)
  const height = sel.height ?? pickOne(rng, ['high', 'low'] as const)
  const { type, isBall } = PITCH_KEY_INFO[key]
  return { type, isBall, height }
}
