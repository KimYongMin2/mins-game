import type { Pitch, PitchHeight, PitchType } from '../play/pitch'
import type { PitchOutcome, PlateResult } from '../rules/game'

const OUTCOME_TEXT: Record<PitchOutcome, string> = {
  ball: '볼',
  calledStrike: '스트라이크',
  swingingStrike: '헛스윙',
  foul: '파울',
  out: '범타 아웃',
  single: '안타!',
  double: '2루타!',
  homerun: '홈런!!',
}

const PLATE_TEXT: Partial<Record<PlateResult, string>> = {
  strikeout: '삼진 아웃!',
  walk: '볼넷',
}

const TYPE_TEXT: Record<PitchType, string> = { fastball: '직구', breaking: '변화구' }
const HEIGHT_TEXT: Record<PitchHeight, string> = { high: '높은', low: '낮은' }

export function outcomeText(outcome: PitchOutcome, plateResult: PlateResult | null): string {
  return (plateResult && PLATE_TEXT[plateResult]) ?? OUTCOME_TEXT[outcome]
}

export function pitchText(pitch: Pitch): string {
  return `${HEIGHT_TEXT[pitch.height]} ${TYPE_TEXT[pitch.type]}(${pitch.isBall ? '볼' : '스트라이크'})`
}

export function timingText(diffMs: number): string {
  const ms = Math.round(diffMs)
  if (ms === 0) return '정확히 맞춤'
  return `${Math.abs(ms)}ms ${ms < 0 ? '빠름' : '늦음'}`
}
