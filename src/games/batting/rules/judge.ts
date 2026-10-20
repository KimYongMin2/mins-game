import { type Difficulty, HARD_WINDOW_SCALE, type Hand, TIMING_WINDOWS_MS } from '../constants'

// 타격 판정: 맞은 위치(터치한 칸 vs 공이 들어온 칸) × 타이밍.
// 칸은 포수 시점 키패드 번호 1~9 (1 2 3 / 4 5 6 / 7 8 9).

export type Cell = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const CELLS: readonly Cell[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** 칸의 열(0=왼쪽)과 행(0=위) */
export function cellPosition(cell: Cell): { col: number; row: number } {
  return { col: (cell - 1) % 3, row: Math.floor((cell - 1) / 3) }
}

export function cellAt(col: number, row: number): Cell {
  return (row * 3 + col + 1) as Cell
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
export function contactOf(hand: Hand, touched: Cell, ball: Cell): Contact {
  const t = cellPosition(touched)
  const b = cellPosition(ball)
  const awaySign = hand === 'right' ? 1 : -1
  /** +면 배트 끝 너머, -면 손잡이 쪽 */
  const along = (b.col - t.col) * awaySign
  const vertical = Math.abs(b.row - t.row)

  if (along > 0) return 'miss'
  if (along === 0 && vertical === 0) return 'sweet'
  if ((along === -1 && vertical === 0) || (along === 0 && vertical === 1)) return 'off'
  if ((along === -2 && vertical === 0) || (along === -1 && vertical === 1)) return 'graze'
  return 'miss'
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
  touched: Cell
  ball: Cell
  swingAt: number
  arriveAt: number
}): SwingResult {
  const contact = contactOf(opts.hand, opts.touched, opts.ball)
  const offsetMs = opts.swingAt - opts.arriveAt
  if (contact === 'miss') return { outcome: 'whiff', contact, offsetMs }
  const diff = Math.abs(offsetMs)
  const tier = timingWindows(opts.difficulty).findIndex((ms) => diff <= ms)
  const outcome = tier === -1 ? 'whiff' : BY_CONTACT[contact][tier]
  return { outcome, contact, offsetMs }
}
