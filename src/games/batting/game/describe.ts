import type { Difficulty } from '../constants'
import { timingWindows } from '../rules/judge'

/** 타이밍 설명: 딱 맞음 / 빨랐어요 / 늦었어요 */
export function timingText(offsetMs: number, difficulty: Difficulty): string {
  const ms = Math.round(offsetMs)
  if (Math.abs(ms) <= timingWindows(difficulty).perfect) return `딱 맞았어요 ${ms > 0 ? '+' : ''}${ms}ms`
  return ms < 0 ? `빨랐어요 ${ms}ms` : `늦었어요 +${ms}ms`
}
