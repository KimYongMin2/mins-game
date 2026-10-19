import {
  ARROW_SPEED,
  AUTO_RELEASE_MS,
  DRAW_MS,
  type Distance,
  FATIGUE_GRACE_MS,
  SWAY_ANGLE,
  UNDERDRAW_DROP_AT_30M,
} from '../constants'
import type { Point } from '../rules/scoring'
import { type Wind, windDrift } from './wind'

// 당기기·흔들림·발사 계산. 모두 시간(ms)을 받는 순수 함수라 테스트로 재현할 수 있다.

/** 당긴 정도 0~1 */
export function drawProgress(holdMs: number): number {
  return Math.min(Math.max(holdMs / DRAW_MS, 0), 1)
}

/** 흔들림 배율. 완전히 당긴 뒤 버틸수록 커진다 (팔 힘이 빠짐) */
export function fatigue(holdMs: number): number {
  const tired = holdMs - DRAW_MS - FATIGUE_GRACE_MS
  if (tired <= 0) return 1
  return 1 + 0.5 * (tired / 1000) ** 1.5
}

export function shouldAutoRelease(holdMs: number): boolean {
  return holdMs >= AUTO_RELEASE_MS
}

/**
 * 조준점 흔들림(m). 서로 다른 주기의 사인파를 겹쳐 사람 손처럼 불규칙하게 움직인다.
 * phase는 화살마다 달라서 매번 다른 모양으로 흔들린다.
 */
export function swayOffset(t: number, holdMs: number, distance: Distance, phase: number): Point {
  const amp = SWAY_ANGLE * distance * fatigue(holdMs)
  const s = t / 1000
  const x = Math.sin(s * 1.7 + phase) * 0.6 + Math.sin(s * 3.1 + phase * 2.3) * 0.3 + Math.sin(s * 5.3 + phase * 0.7) * 0.1
  const y = Math.sin(s * 1.3 + phase * 1.9) * 0.6 + Math.sin(s * 2.7 + phase * 0.4) * 0.3 + Math.sin(s * 4.9 + phase * 3.1) * 0.1
  return { x: x * amp, y: y * amp }
}

/** 덜 당기고 쏘면 아래로 처지는 양(m, 양수) */
export function underdrawDrop(progress: number, distance: Distance): number {
  const missing = 1 - Math.min(Math.max(progress, 0), 1)
  return missing ** 1.2 * UNDERDRAW_DROP_AT_30M * (distance / 30)
}

export function flightMs(distance: Distance): number {
  return (distance / ARROW_SPEED) * 1000
}

/** 놓는 순간의 조준점 + 흔들림 + 바람 + 처짐 = 화살이 꽂히는 자리 */
export function computeImpact(input: {
  aim: Point
  sway: Point
  wind: Wind
  distance: Distance
  progress: number
}): Point {
  const drift = windDrift(input.wind, input.distance)
  return {
    x: input.aim.x + input.sway.x + drift.x,
    y: input.aim.y + input.sway.y + drift.y - underdrawDrop(input.progress, input.distance),
  }
}
