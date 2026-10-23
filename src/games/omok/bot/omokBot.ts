// 오목 봇. 빈칸마다 '내가 두면 얼마나 좋은지(공격)'와 '상대가 두면 얼마나 위험한지(수비)'를 점수로 매겨 고른다.
// 점수: 그 칸을 지나는 다섯 칸짜리 구간마다, 상대 돌이 없으면 내 돌 개수에 따라 점수를 더한다.
// - 일반: 수비를 덜 보고 점수를 크게 흔든다. 상대 5를 가끔 못 막는다
// - 어려움: 수비를 거의 공격만큼 본다
import { type Rng, chance } from '../../../shared/random'
import { SIZE } from '../constants'
import type { Difficulty } from '../constants'
import { BLACK, type Board, CENTER, EMPTY, type Stone, WHITE, canPlace, makesFive, xyOf } from '../rules/renju'

/** 구간 안 내 돌 개수(둘 돌 포함)별 점수 */
const WINDOW_SCORE = [0, 1, 12, 120, 2500, 0]

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

const TUNING: Record<Difficulty, { defense: number; noise: number; blockFive: number }> = {
  normal: { defense: 0.55, noise: 0.9, blockFive: 0.8 },
  hard: { defense: 0.95, noise: 0.08, blockFive: 1 },
}

const other = (s: Stone): Stone => (s === BLACK ? WHITE : BLACK)

/** stone이 pos에 둔다고 칠 때 그 칸을 지나는 구간 점수 합 */
function lineScore(b: Board, pos: number, stone: Stone): number {
  const [x, y] = xyOf(pos)
  let total = 0
  for (const [dx, dy] of DIRS) {
    for (let s = -4; s <= 0; s++) {
      let mine = 1
      let ok = true
      for (let k = s; k < s + 5 && ok; k++) {
        if (k === 0) continue
        const cx = x + dx * k
        const cy = y + dy * k
        if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) ok = false
        else {
          const c = b[cy * SIZE + cx]
          if (c === stone) mine++
          else if (c !== EMPTY) ok = false
        }
      }
      if (ok) total += WINDOW_SCORE[mine]
    }
  }
  return total
}

/** 돌 근처(2칸 안) 빈칸. 판이 비었으면 가운데 */
function candidates(b: Board): number[] {
  if (!b.some((c) => c !== EMPTY)) return [CENTER]
  const out: number[] = []
  for (let pos = 0; pos < b.length; pos++) {
    if (b[pos] !== EMPTY) continue
    const [x, y] = xyOf(pos)
    let near = false
    for (let dy = -2; dy <= 2 && !near; dy++) {
      for (let dx = -2; dx <= 2 && !near; dx++) {
        const cx = x + dx
        const cy = y + dy
        if (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && b[cy * SIZE + cx] !== EMPTY) near = true
      }
    }
    if (near) out.push(pos)
  }
  return out
}

/** stone 차례에 둘 칸. 둘 데가 없으면 -1 */
export function chooseMove(rng: Rng, b: Board, stone: Stone, difficulty: Difficulty): number {
  const t = TUNING[difficulty]
  let moves = candidates(b).filter((p) => canPlace(b, p, stone))
  if (moves.length === 0) moves = b.flatMap((c, p) => (c === EMPTY && canPlace(b, p, stone) ? [p] : []))
  if (moves.length === 0) return -1

  // 바로 이기기 → 상대 5 막기
  const win = moves.find((p) => makesFive(b, p, stone))
  if (win !== undefined) return win
  const foe = other(stone)
  const block = moves.find((p) => makesFive(b, p, foe))
  if (block !== undefined && chance(rng, t.blockFive)) return block

  let best = moves[0]
  let bestScore = -Infinity
  for (const p of moves) {
    const [x, y] = xyOf(p)
    // 같은 점수면 가운데 쪽
    const center = -(Math.abs(x - 7) + Math.abs(y - 7)) * 0.01
    const score = (lineScore(b, p, stone) + lineScore(b, p, foe) * t.defense) * (1 + (rng.next() - 0.5) * t.noise) + center
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return best
}
