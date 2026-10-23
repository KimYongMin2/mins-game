// 오목 판과 렌주룰 판정.
// - 흑: 정확히 다섯 개면 승리. 쌍삼(열린 3 두 개)·쌍사(4 두 개)·장목(6개 이상)은 둘 수 없다(금수).
//   4-3은 된다. 다섯을 만드는 수는 금수 모양이 같이 생겨도 둘 수 있다.
// - 백: 금수 없음. 다섯 개 이상이면 승리
import { SIZE } from '../constants'

export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2
export type Stone = typeof BLACK | typeof WHITE
export type Cell = typeof EMPTY | Stone
/** 칸 번호 = y * SIZE + x */
export type Board = readonly Cell[]

export const emptyBoard = (): Board => Array<Cell>(SIZE * SIZE).fill(EMPTY)
export const CENTER = (SIZE * SIZE - 1) / 2

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

export const xyOf = (pos: number) => [pos % SIZE, Math.floor(pos / SIZE)] as const
const inside = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE
/** 판 밖이면 -1 */
const at = (b: Board, x: number, y: number) => (inside(x, y) ? b[y * SIZE + x] : -1)

export function place(b: Board, pos: number, stone: Stone): Board {
  const next = b.slice()
  next[pos] = stone
  return next
}

/** pos를 지나는 dir 방향으로 이어진 같은 돌 (pos 포함) */
function run(b: Board, pos: number, dx: number, dy: number, c: Cell): number[] {
  const [x, y] = xyOf(pos)
  const cells = [pos]
  for (let k = 1; at(b, x + dx * k, y + dy * k) === c; k++) cells.push((y + dy * k) * SIZE + x + dx * k)
  for (let k = 1; at(b, x - dx * k, y - dy * k) === c; k++) cells.unshift((y - dy * k) * SIZE + x - dx * k)
  return cells
}

const isFive = (len: number, stone: Stone) => (stone === BLACK ? len === 5 : len >= 5)

/** 방금 pos에 둔 돌로 이긴 줄. 없으면 null */
export function winLine(b: Board, pos: number): number[] | null {
  const stone = b[pos]
  if (stone === EMPTY) return null
  for (const [dx, dy] of DIRS) {
    const cells = run(b, pos, dx, dy, stone)
    if (isFive(cells.length, stone)) return cells
  }
  return null
}

/** pos에 stone을 두면 바로 이기는지 */
export const makesFive = (b: Board, pos: number, stone: Stone) => b[pos] === EMPTY && winLine(place(b, pos, stone), pos) !== null

/** dir 방향 줄에서 pos로부터 4칸 안의 빈칸 */
function lineEmpties(b: Board, pos: number, dx: number, dy: number): number[] {
  const [x, y] = xyOf(pos)
  const out: number[] = []
  for (let k = -4; k <= 4; k++) {
    if (k !== 0 && at(b, x + dx * k, y + dy * k) === EMPTY) out.push((y + dy * k) * SIZE + x + dx * k)
  }
  return out
}

/** 흑 돌이 놓인 pos를 지나는 dir 방향의 4 개수 (한 줄에 쌍사가 생기면 2) */
function fours(b: Board, pos: number, dx: number, dy: number): number {
  const wins = lineEmpties(b, pos, dx, dy).filter((q) => run(place(b, q, BLACK), pos, dx, dy, BLACK).length === 5)
  if (wins.length < 2) return wins.length
  // 열린 4(.●●●●.)는 이길 자리가 둘이어도 4 하나
  const stones = run(b, pos, dx, dy, BLACK)
  const [x0, y0] = xyOf(stones[0])
  const [x1, y1] = xyOf(stones[stones.length - 1])
  const ends = [(y0 - dy) * SIZE + x0 - dx, (y1 + dy) * SIZE + x1 + dx]
  const open = stones.length === 4 && wins.length === 2 && wins.every((q) => ends.includes(q))
  return open ? 1 : 2
}

/** 흑 4가 열린 4인지: 이어진 4개 양쪽 끝이 비어 있고 어느 쪽을 둬도 정확히 다섯 */
function openFour(b: Board, pos: number, dx: number, dy: number): boolean {
  const stones = run(b, pos, dx, dy, BLACK)
  if (stones.length !== 4) return false
  const [x0, y0] = xyOf(stones[0])
  const [x1, y1] = xyOf(stones[3])
  const ends = [
    [x0 - dx, y0 - dy],
    [x1 + dx, y1 + dy],
  ]
  return ends.every(([x, y]) => at(b, x, y) === EMPTY && run(place(b, y * SIZE + x, BLACK), pos, dx, dy, BLACK).length === 5)
}

/** 흑 돌이 놓인 pos를 지나는 dir 방향에 열린 3이 있는지: 한 수 더 두면 열린 4가 되고, 그 수가 금수가 아니어야 한다 */
function openThree(b: Board, pos: number, dx: number, dy: number, depth: number): boolean {
  return lineEmpties(b, pos, dx, dy).some((q) => {
    const next = place(b, q, BLACK)
    // q가 그 4에 들어가야 한다 (이미 4인 줄 옆 아무 데나 두는 건 3이 아님)
    const joined = run(next, pos, dx, dy, BLACK).includes(q)
    return joined && openFour(next, pos, dx, dy) && (depth >= 2 || !forbiddenAfter(b, q, depth + 1))
  })
}

/** b에 흑이 q에 두면 금수인지 (b에는 아직 q가 비어 있음) */
function forbiddenAfter(b: Board, q: number, depth: number): boolean {
  if (b[q] !== EMPTY) return false
  const next = place(b, q, BLACK)
  const lens = DIRS.map(([dx, dy]) => run(next, q, dx, dy, BLACK).length)
  if (lens.includes(5)) return false
  if (lens.some((n) => n >= 6)) return true
  let four = 0
  let three = 0
  for (const [dx, dy] of DIRS) {
    four += fours(next, q, dx, dy)
    if (four >= 2) return true
  }
  for (const [dx, dy] of DIRS) {
    if (openThree(next, q, dx, dy, depth)) three++
    if (three >= 2) return true
  }
  return false
}

/** 흑이 pos에 두면 금수인지 (쌍삼·쌍사·장목) */
export const isForbidden = (b: Board, pos: number): boolean => forbiddenAfter(b, pos, 0)

/** stone이 pos에 둘 수 있는지 */
export const canPlace = (b: Board, pos: number, stone: Stone) =>
  pos >= 0 && pos < b.length && b[pos] === EMPTY && !(stone === BLACK && isForbidden(b, pos))

/** 금수 종류 (화면 안내용) */
export function forbiddenKind(b: Board, pos: number): '장목' | '쌍사' | '쌍삼' | null {
  if (!isForbidden(b, pos)) return null
  const next = place(b, pos, BLACK)
  if (DIRS.some(([dx, dy]) => run(next, pos, dx, dy, BLACK).length >= 6)) return '장목'
  return DIRS.reduce((n, [dx, dy]) => n + fours(next, pos, dx, dy), 0) >= 2 ? '쌍사' : '쌍삼'
}

export const isFull = (b: Board) => !b.includes(EMPTY)

/** 판 위 그림으로 판 만들기 (테스트용): '●' 흑, '○' 백, 그 밖 빈칸. 첫 줄이 맨 위 */
export function boardOf(rows: string[], ox = 0, oy = 0): Board {
  const b = emptyBoard().slice()
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '●' || ch === 'X') b[(oy + y) * SIZE + ox + x] = BLACK
      if (ch === '○' || ch === 'O') b[(oy + y) * SIZE + ox + x] = WHITE
    }),
  )
  return b
}
