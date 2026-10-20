import type { Rng } from '../../../shared/random'
import { type Pos, advance, distanceLeft, nodeOf } from '../rules/board'
import { type Move, type Pieces, applyMove, movesFor } from '../rules/moves'
import type { Throw } from '../rules/throw'

// 윷놀이 봇: 할 수 있는 움직임마다 점수를 매겨 가장 좋은 것. 같은 점수면 무작위.
// 나가기 > 잡기 > 업기 > 앞으로 많이(지름길 포함), 상대 말 바로 앞(1~5칸)에 서는 건 피한다.
// (도 칸 말에 빽도를 쓰면 출발점 = 끝으로 가서 크게 앞서는 것도 '앞으로 많이'로 잡힌다)

const onBoard = (p: unknown): p is Pos => typeof p === 'object' && p !== null

/** 상대 말이 한 번에 올 수 있는 칸들 */
function threatened(pieces: Pieces, player: number): Set<number> {
  const nodes = new Set<number>()
  pieces.forEach((row, other) => {
    if (other === player) return
    for (const p of row) {
      if (!onBoard(p)) continue
      for (let steps = 1; steps <= 5; steps++) {
        const to = advance(p, steps)
        if (to !== 'out') nodes.add(nodeOf(to))
      }
    }
  })
  return nodes
}

function score(pieces: Pieces, player: number, pending: readonly Throw[], m: Move): number {
  const t = pending[m.throwIdx]
  const mine = pieces[player]
  const group = m.from === 'home' ? 1 : mine.filter((p) => onBoard(p) && nodeOf(p) === m.from).length
  const before = m.from === 'home' ? 21 : distanceLeft(mine.find((p) => onBoard(p) && nodeOf(p) === m.from) as Pos)
  if (m.to === 'out') return 1000 + group * 50
  const { pieces: after, captured, bonus } = applyMove(pieces, player, t, m.from, m.to)
  let s = (before - distanceLeft(m.to)) * 3 * group
  s += captured * 120 + (bonus ? 40 : 0)
  const node = nodeOf(m.to)
  const stacked = after[player].filter((p) => onBoard(p) && nodeOf(p) === node).length
  if (stacked > group) s += 15
  if (threatened(after, player).has(node)) s -= 25 * stacked
  return s
}

export function chooseBotMove(rng: Rng, pieces: Pieces, player: number, pending: readonly Throw[]): Move | null {
  const moves = movesFor(pieces, player, pending)
  if (moves.length === 0) return null
  let best: Move[] = []
  let bestScore = -Infinity
  for (const m of moves) {
    const s = score(pieces, player, pending, m)
    if (s > bestScore) {
      bestScore = s
      best = [m]
    } else if (s === bestScore) best.push(m)
  }
  return best[Math.floor(rng.next() * best.length)]
}
