import { type Difficulty, HARD_WINDOW_SCALE, type Hand, TIMING_WINDOWS_MS } from '../constants'

// 타격 판정: 맞은 위치(터치한 곳 vs 공이 들어온 칸) × 타이밍.
// 칸은 포수 시점 키패드 번호 1~9 (1 2 3 / 4 5 6 / 7 8 9).
// 터치는 칸 경계와 상관없이 아무 곳이나 되고, 칸 단위 거리로 판정한다.

export type Cell = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const CELLS: readonly Cell[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** 칸의 열(0=왼쪽)과 행(0=위) */
export function cellPosition(cell: Cell): { col: number; row: number } {
  return { col: (cell - 1) % 3, row: Math.floor((cell - 1) / 3) }
}

export function cellAt(col: number, row: number): Cell {
  return (row * 3 + col + 1) as Cell
}

/** 존 안의 위치(칸 단위 연속 좌표). col은 왼쪽 0 ~ 오른쪽 3, row는 위 0 ~ 아래 3 */
export type ZonePoint = { col: number; row: number }

export function cellMiddle(cell: Cell): ZonePoint {
  const { col, row } = cellPosition(cell)
  return { col: col + 0.5, row: row + 0.5 }
}

export function nearestCell(p: ZonePoint): Cell {
  const clamp = (v: number) => Math.min(2, Math.max(0, Math.floor(v)))
  return cellAt(clamp(p.col), clamp(p.row))
}

/** 가장 가까운 정수. 딱 절반(칸 경계)이면 0 쪽(더 좋은 판정)으로 */
function roundLenient(v: number): number {
  return Math.sign(v) * Math.max(0, Math.ceil(Math.abs(v) - 0.5))
}

/** 배트의 어디에 맞았나 */
export type Contact = 'sweet' | 'off' | 'graze' | 'miss'

export const CONTACT_LABEL: Record<Contact, string> = {
  sweet: '정타',
  off: '빗맞음',
  graze: '스침',
  miss: '헛스윙',
}

/**
 * 배트는 타자 쪽에 손잡이, 터치한 칸에 스윗스팟이 있고 그 너머로는 짧다.
 * 우타는 왼쪽에 서서 오른쪽으로 휘두르니, 공이 터치보다 왼쪽이면 손잡이 쪽, 오른쪽이면 배트 끝 너머.
 */
export function contactAt(hand: Hand, touch: ZonePoint, ball: ZonePoint): Contact {
  const awaySign = hand === 'right' ? 1 : -1
  /** +면 배트 끝 너머, -면 손잡이 쪽 (칸 수) */
  const along = roundLenient((ball.col - touch.col) * awaySign)
  const vertical = Math.abs(roundLenient(ball.row - touch.row))

  if (along > 0) return 'miss'
  if (along === 0 && vertical === 0) return 'sweet'
  if ((along === -1 && vertical === 0) || (along === 0 && vertical === 1)) return 'off'
  if ((along === -2 && vertical === 0) || (along === -1 && vertical === 1)) return 'graze'
  return 'miss'
}

/** 칸 가운데끼리 비교 */
export function contactOf(hand: Hand, touched: Cell, ball: Cell): Contact {
  return contactAt(hand, cellMiddle(touched), cellMiddle(ball))
}

/** 타석 결과. looking = 치지 않음(스트라이크) */
export type Outcome = 'homerun' | 'triple' | 'double' | 'single' | 'out' | 'foul' | 'whiff' | 'looking'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  homerun: '홈런',
  triple: '3루타',
  double: '2루타',
  single: '안타',
  out: '범타 아웃',
  foul: '파울',
  whiff: '헛스윙',
  looking: '스트라이크',
}

/** 타이밍 구간 순서(홈런 구간 … 파울 구간)별 결과 */
const BY_CONTACT: Record<Exclude<Contact, 'miss'>, readonly Outcome[]> = {
  sweet: ['homerun', 'triple', 'double', 'single', 'out', 'foul'],
  off: ['single', 'single', 'single', 'out', 'out', 'foul'],
  graze: ['foul', 'foul', 'foul', 'foul', 'foul', 'foul'],
}

export function timingWindows(difficulty: Difficulty): number[] {
  const scale = difficulty === 'hard' ? HARD_WINDOW_SCALE : 1
  return TIMING_WINDOWS_MS.map((ms) => ms * scale)
}

export type SwingResult = {
  outcome: Outcome
  contact: Contact
  /** 터치 시각 − 도착 시각. 음수면 빨랐다 */
  offsetMs: number
}

export function judgeSwing(opts: {
  difficulty: Difficulty
  hand: Hand
  touch: ZonePoint
  ball: Cell
  swingAt: number
  arriveAt: number
}): SwingResult {
  const contact = contactAt(opts.hand, opts.touch, cellMiddle(opts.ball))
  const offsetMs = opts.swingAt - opts.arriveAt
  if (contact === 'miss') return { outcome: 'whiff', contact, offsetMs }
  const diff = Math.abs(offsetMs)
  const tier = timingWindows(opts.difficulty).findIndex((ms) => diff <= ms)
  const outcome = tier === -1 ? 'whiff' : BY_CONTACT[contact][tier]
  return { outcome, contact, offsetMs }
}
