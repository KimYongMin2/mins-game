import {
  type Difficulty,
  FENCE_DISTANCE,
  HARD_WINDOW_SCALE,
  type Hand,
  MAX_DISTANCE,
  MIN_DISTANCE,
  TIMING_MS,
} from '../constants'

// 타격 판정: 맞은 위치(터치한 곳 vs 공이 들어온 칸) × 타이밍 → 비거리 → 결과.
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

/** 비거리별 결과 (멀리 간 것부터) */
export const DISTANCE_TIERS: readonly { min: number; outcome: Outcome }[] = [
  { min: FENCE_DISTANCE, outcome: 'homerun' },
  { min: 95, outcome: 'triple' },
  { min: 70, outcome: 'double' },
  { min: 30, outcome: 'single' },
  { min: 0, outcome: 'out' },
]

export function outcomeByDistance(distance: number): Outcome {
  return DISTANCE_TIERS.find((t) => distance >= t.min)!.outcome
}

/** 빗맞으면 힘이 이만큼만 실린다 (완벽한 타이밍이어도 3루타 정도까지) */
const OFF_POWER = 0.65
/** 정타라도 공 가운데에서 1칸 벗어날 때마다 힘이 이만큼 줄어든다 */
const SWEET_FALLOFF = 0.2
/** 힘 → 비거리 곡선. 1보다 작으면 조금만 맞아도 꽤 날아간다 */
const DISTANCE_CURVE = 0.8

export type Windows = { perfect: number; fair: number; foul: number }

export function timingWindows(difficulty: Difficulty): Windows {
  const scale = difficulty === 'hard' ? HARD_WINDOW_SCALE : 1
  return { perfect: TIMING_MS.perfect * scale, fair: TIMING_MS.fair * scale, foul: TIMING_MS.foul * scale }
}

export type SwingResult = {
  outcome: Outcome
  contact: Contact
  /** 터치 시각 − 도착 시각. 음수면 빨랐다 */
  offsetMs: number
  /** 앞으로 날아간 거리(m). 파울·헛스윙이면 null */
  distance: number | null
}

export function judgeSwing(opts: {
  difficulty: Difficulty
  hand: Hand
  touch: ZonePoint
  ball: Cell
  swingAt: number
  arriveAt: number
}): SwingResult {
  const ball = cellMiddle(opts.ball)
  const contact = contactAt(opts.hand, opts.touch, ball)
  const offsetMs = opts.swingAt - opts.arriveAt
  const windows = timingWindows(opts.difficulty)
  const diff = Math.abs(offsetMs)
  if (contact === 'miss' || diff > windows.foul) return { outcome: 'whiff', contact, offsetMs, distance: null }
  if (contact === 'graze' || diff > windows.fair) return { outcome: 'foul', contact, offsetMs, distance: null }

  const timing = 1 - diff / windows.fair
  const miss = Math.hypot(ball.col - opts.touch.col, ball.row - opts.touch.row)
  const position = contact === 'sweet' ? Math.max(0, 1 - SWEET_FALLOFF * miss) : OFF_POWER
  const power = timing * position
  const distance = Math.round(MIN_DISTANCE + (MAX_DISTANCE - MIN_DISTANCE) * power ** DISTANCE_CURVE)
  return { outcome: outcomeByDistance(distance), contact, offsetMs, distance }
}
