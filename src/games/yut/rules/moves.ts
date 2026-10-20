import { type Pos, advance, back, enter, nodeOf } from './board'
import { STEPS, type Throw, isBonus } from './throw'

// 말 움직이기: 어떤 결과로 어떤 말을 옮길 수 있는지, 옮기면 판이 어떻게 되는지.
// 심판과 화면(갈 수 있는 칸 표시)이 같이 쓴다.

/** 말 하나: 아직 안 나감 / 판 위 / 다 돌고 나감 */
export type Piece = Pos | 'home' | 'out'

/** 사람별 말들 */
export type Pieces = readonly (readonly Piece[])[]

/** 움직일 말: 판 위 칸 번호(그 칸의 내 말 전부 = 업힌 말) 또는 새 말 */
export type From = number | 'home'

export type Move = {
  /** 쓸 결과 (pending의 몇 번째) */
  throwIdx: number
  from: From
  /** 도착 (나가면 'out') */
  to: Pos | 'out'
}

const onBoard = (p: Piece): p is Pos => p !== 'home' && p !== 'out'

/** 내 말이 있는 칸들 (업힌 말은 한 번만) */
export function groupsOf(mine: readonly Piece[]): number[] {
  return [...new Set(mine.filter(onBoard).map(nodeOf))]
}

/** 한 결과로 갈 수 있는 곳 */
function destOf(mine: readonly Piece[], from: From, t: Throw): Pos | 'out' | null {
  if (from === 'home') {
    if (t === 'backdo' || !mine.includes('home')) return null
    return enter(STEPS[t])
  }
  const p = mine.find((x) => onBoard(x) && nodeOf(x) === from) as Pos | undefined
  if (!p) return null
  return t === 'backdo' ? back(p) : advance(p, STEPS[t])
}

/** 지금 쓸 수 있는 움직임 전부. 같은 결과가 여러 개면 첫 번째만 */
export function movesFor(pieces: Pieces, player: number, pending: readonly Throw[]): Move[] {
  const mine = pieces[player]
  const froms: From[] = [...groupsOf(mine), ...(mine.includes('home') ? (['home'] as const) : [])]
  const moves: Move[] = []
  pending.forEach((t, throwIdx) => {
    if (pending.indexOf(t) !== throwIdx) return
    for (const from of froms) {
      const to = destOf(mine, from, t)
      if (to !== null) moves.push({ throwIdx, from, to })
    }
  })
  return moves
}

export type MoveResult = {
  pieces: Piece[][]
  /** 잡은 상대 말 수 */
  captured: number
  /** 한 번 더 던지는지 (도·개·걸·빽도로 잡았을 때) */
  bonus: boolean
}

/** 움직임을 판에 적용. 업기(같은 칸 내 말과 합침)·잡기(상대 말 처음으로) */
export function applyMove(pieces: Pieces, player: number, t: Throw, from: From, to: Pos | 'out'): MoveResult {
  const next = pieces.map((row) => [...row])
  const mine = next[player]
  // 옮길 말: 새 말 하나, 또는 그 칸에 업혀 있는 내 말 전부
  const moving = from === 'home' ? [mine.indexOf('home')] : mine.flatMap((p, i) => (onBoard(p) && nodeOf(p) === from ? [i] : []))
  for (const i of moving) mine[i] = to
  let captured = 0
  if (to !== 'out') {
    const node = nodeOf(to)
    // 같은 칸에 있던 내 말은 업혀서 같은 자리로 (다음부터 같이 움직임)
    mine.forEach((p, i) => {
      if (onBoard(p) && nodeOf(p) === node) mine[i] = to
    })
    next.forEach((row, other) => {
      if (other === player) return
      row.forEach((p, i) => {
        if (onBoard(p) && nodeOf(p) === node) {
          row[i] = 'home'
          captured++
        }
      })
    })
  }
  // 윷·모는 원래 한 번 더라서 그걸로 잡아도 추가 없음
  return { pieces: next, captured, bonus: captured > 0 && !isBonus(t) }
}

/** 다 나갔는지 */
export const allOut = (mine: readonly Piece[]): boolean => mine.every((p) => p === 'out')
