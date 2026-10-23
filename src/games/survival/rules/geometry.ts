// 맵과 총알 계산. 맵은 가운데가 (0,0)인 원, 라운드마다 반지름이 줄어든다 (처음엔 네모였는데 원으로 바꿈).
// 이름은 네모 때 그대로 half(= 반지름).
// 총알은 쏜 사람 자리에서 고른 방향으로 일자로 나가 처음 맞은 한 명에서 멈춘다. 아무도 없으면 맵 끝까지.
import type { Rng } from '../../../shared/random'
import { ARENA_HALF, PIECE_R } from '../constants'

export type Vec = { x: number; y: number }

/** n라운드(1부터) 맵 반지름 */
export const halfOf = (round: number) => ARENA_HALF[Math.min(round, ARENA_HALF.length) - 1]

/** 말이 맵 밖으로 나가지 않게 (말 반지름만큼 안쪽) */
export function clampToArena(p: Vec, half: number): Vec {
  const m = half - PIECE_R
  const d = Math.hypot(p.x, p.y)
  return d <= m ? p : { x: (p.x / d) * m, y: (p.y / d) * m }
}

/** 맵 안 아무 곳 (넓이 고르게) */
export function randomInArena(rng: Rng, half: number): Vec {
  const r = Math.sqrt(rng.next()) * (half - PIECE_R)
  const a = rng.next() * Math.PI * 2
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

/** 쏜 자리에서 그 방향으로 맵 끝에 닿는 곳 */
export function edgeOf(from: Vec, angle: number, half: number): Vec {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  // |from + t·d| = half 의 앞쪽 해
  const b = from.x * dx + from.y * dy
  const c = from.x * from.x + from.y * from.y - half * half
  const t = Math.max(0, -b + Math.sqrt(Math.max(0, b * b - c)))
  return { x: from.x + dx * t, y: from.y + dy * t }
}

/**
 * 총알: 처음 맞는 사람과 총알이 멈춘 곳.
 * 말(반지름 PIECE_R)에 닿는 첫 지점까지 거리로 가장 가까운 사람. 쏜 사람 뒤쪽은 안 맞는다
 */
export function shoot(from: Vec, angle: number, targets: readonly { player: number; pos: Vec }[], half: number): { hit: number | null; end: Vec } {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let best: { player: number; t: number } | null = null
  for (const { player, pos } of targets) {
    const vx = pos.x - from.x
    const vy = pos.y - from.y
    const along = vx * dx + vy * dy
    if (along <= 0) continue
    const side2 = vx * vx + vy * vy - along * along
    if (side2 > PIECE_R * PIECE_R) continue
    const t = Math.max(0, along - Math.sqrt(PIECE_R * PIECE_R - side2))
    if (!best || t < best.t) best = { player, t }
  }
  if (!best) return { hit: null, end: edgeOf(from, angle, half) }
  return { hit: best.player, end: { x: from.x + dx * best.t, y: from.y + dy * best.t } }
}
