// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 흐름: 카드 고르기(흑·백, 10초) → 카드 공개 → 흑부터 번갈아 두기(한 수 30초) → 끝
//
// 모드
// - bot: 나 vs 봇. 카드는 내가 고르고 봇은 남은 카드
// - pvp: 나 vs 친구. 방장이 누가 카드를 고를지와 어느 카드가 흑인지 정해 보낸다.
//   자기 차례인 기기가 둔 자리를 보내고(시간 초과도 그 기기가 처리), 받은 쪽이 그대로 둔다
//
// 자리는 먼저 눌러 고르고(select, 미리 보기) '착수하기'로 둔다(place).
// 시간이 넘으면 골라 둔 자리에, 없으면 봇처럼 알아서 둔다.
import { type Rng, createRng } from '../../../shared/random'
import { chooseMove } from '../bot/omokBot'
import { BOT_THINK_MS, DONE_MS, type Difficulty, PICK_MS, REVEAL_MS, TURN_MS } from '../constants'
import { BLACK, type Board, type Stone, WHITE, canPlace, emptyBoard, isFull, place, winLine } from '../rules/renju'

export type Mode = 'bot' | 'pvp'
export type Side = 0 | 1
/** 카드 두 장 중 몇 번째 */
export type Card = 0 | 1

export type SoundName = 'flip' | 'place' | 'win' | 'lose' | 'draw'

export type Phase =
  /** picker가 카드를 고르는 중. 시간이 넘으면 무작위 */
  | { kind: 'pick'; until: number }
  /** 고른 카드를 뒤집어 보여주는 중 */
  | { kind: 'reveal'; until: number }
  /** turn인 쪽이 두는 중. botAt에 봇이 둔다 */
  | { kind: 'playing'; until: number; botAt: number }
  /** line = 이긴 다섯 줄 (무승부면 빈 배열) */
  | { kind: 'done'; winner: Side | 'draw'; line: number[]; until: number }

export type MatchState = {
  now: number
  seed: number
  mode: Mode
  difficulty: Difficulty
  /** 카드를 고르는 쪽 (나 = 0) */
  picker: Side
  /** 흑 카드가 몇 번째 카드인지 */
  blackCard: Card
  /** picker가 고른 카드 */
  picked: Card | null
  /** 흑인 쪽. 카드를 고르기 전엔 null */
  black: Side | null
  board: Board
  /** 둔 자리 순서. n번째 수는 n이 짝수면 흑, 홀수면 백 */
  moves: number[]
  turn: Side
  /** 내가 골라 둔 자리 (미리 보기) */
  selected: number | null
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  /** 내가 카드를 고름 */
  | { type: 'pick'; card: Card }
  /** 자리 고르기(미리 보기). null이면 풀기 */
  | { type: 'select'; pos: number | null }
  /** 착수 */
  | { type: 'place'; pos: number }
  /** 친구가 고른 카드 */
  | { type: 'remotePick'; card: Card }
  /** 친구가 n번째 수로 둔 자리 */
  | { type: 'remoteMove'; n: number; pos: number }

function withSounds(state: MatchState, ...names: SoundName[]): MatchState {
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-8), soundSeq: seq }
}

export function createMatch(opts: {
  now: number
  seed: number
  mode: Mode
  difficulty: Difficulty
  /** 친구 대전: 방장이 정해서 보낸 카드 고를 쪽(나 = 0)과 흑 카드. 봇전은 내가 고르고 흑 카드는 seed로 */
  picker?: Side
  blackCard?: Card
}): MatchState {
  const rng = createRng(opts.seed)
  const blackCard: Card = opts.blackCard ?? (rng.next() < 0.5 ? 0 : 1)
  return {
    now: opts.now,
    seed: rng.seed(),
    mode: opts.mode,
    difficulty: opts.difficulty,
    picker: opts.picker ?? 0,
    blackCard,
    picked: null,
    black: null,
    board: emptyBoard(),
    moves: [],
    turn: 0,
    selected: null,
    phase: { kind: 'pick', until: opts.now + PICK_MS },
    sounds: [],
    soundSeq: 0,
  }
}

/** side의 돌 색 */
export const stoneOf = (state: MatchState, side: Side): Stone => (state.black === side ? BLACK : WHITE)
/** n번째 수를 둔 쪽 */
export const moverOf = (state: MatchState, n: number): Side => (n % 2 === 0 ? state.black! : ((1 - state.black!) as Side))

function pick(state: MatchState, card: Card): MatchState {
  if (state.phase.kind !== 'pick') return state
  const black: Side = card === state.blackCard ? state.picker : ((1 - state.picker) as Side)
  return withSounds({ ...state, picked: card, black, turn: black, phase: { kind: 'reveal', until: state.now + REVEAL_MS } }, 'flip')
}

function playing(state: MatchState, rng: Rng): MatchState {
  const botAt = state.now + BOT_THINK_MS.min + rng.next() * (BOT_THINK_MS.max - BOT_THINK_MS.min)
  return { ...state, seed: rng.seed(), phase: { kind: 'playing', until: state.now + TURN_MS, botAt } }
}

/** side가 pos에 둔다. 규칙에 안 맞으면 그대로 */
function move(state: MatchState, side: Side, pos: number): MatchState {
  if (state.phase.kind !== 'playing' || state.turn !== side) return state
  const stone = stoneOf(state, side)
  if (!canPlace(state.board, pos, stone)) return state
  const board = place(state.board, pos, stone)
  // 골라 둔 자리가 막혔거나 금수가 됐으면 푼다
  const sel = state.selected
  const selected = sel !== null && canPlace(board, sel, stoneOf(state, 0)) ? sel : null
  const next = withSounds({ ...state, board, moves: [...state.moves, pos], selected }, 'place')
  const line = winLine(board, pos)
  if (line) return finish(next, side, line)
  if (isFull(board)) return finish(next, 'draw', [])
  return playing({ ...next, turn: (1 - side) as Side }, createRng(state.seed))
}

function finish(state: MatchState, winner: Side | 'draw', line: number[]): MatchState {
  const sound: SoundName = winner === 'draw' ? 'draw' : winner === 0 ? 'win' : 'lose'
  return withSounds({ ...state, selected: null, phase: { kind: 'done', winner, line, until: state.now + DONE_MS } }, sound)
}

function tick(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'pick': {
      // 봇전은 봇이 고를 일이 없다. 친구 대전에서 친구가 고를 차례면 친구 기기가 처리
      if (now < phase.until || state.picker !== 0) return state
      const rng = createRng(state.seed)
      return pick({ ...state, seed: rng.seed() }, rng.next() < 0.5 ? 0 : 1)
    }
    case 'reveal':
      return now >= phase.until ? playing(state, createRng(state.seed)) : state
    case 'playing': {
      const rng = createRng(state.seed)
      if (state.turn === 1 && state.mode === 'bot' && now >= phase.botAt) {
        const pos = chooseMove(rng, state.board, stoneOf(state, 1), state.difficulty)
        return move({ ...state, seed: rng.seed() }, 1, pos)
      }
      // 시간 초과는 차례인 사람 기기만 처리한다: 골라 둔 자리, 없으면 알아서
      if (state.turn === 0 && now >= phase.until) {
        const pos = state.selected ?? chooseMove(rng, state.board, stoneOf(state, 0), 'normal')
        return move({ ...state, seed: rng.seed() }, 0, pos)
      }
      return state
    }
    case 'done':
      return state
  }
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'pick':
      return state.picker === 0 ? pick(state, action.card) : state
    case 'select': {
      if (state.phase.kind === 'done' || state.black === null) return state
      if (action.pos !== null && !canPlace(state.board, action.pos, stoneOf(state, 0))) return state
      return { ...state, selected: action.pos }
    }
    case 'place':
      return move(state, 0, action.pos)
    case 'remotePick':
      return state.mode === 'pvp' && state.picker === 1 ? pick(state, action.card) : state
    case 'remoteMove': {
      if (state.mode !== 'pvp' || action.n !== state.moves.length) return state
      // 카드 공개가 아직 안 끝났으면(통신 지연) 바로 끝내고 받는다
      const s = state.phase.kind === 'reveal' ? playing(state, createRng(state.seed)) : state
      return move(s, 1, action.pos)
    }
  }
}

export type MatchSummary = {
  mode: Mode
  difficulty: Difficulty
  /** 내 입장에서 */
  outcome: 'win' | 'lose' | 'draw'
  /** 내 돌 색 */
  stone: 'black' | 'white'
  /** 판 전체 수 */
  moves: number
}

export function summarizeMatch(state: MatchState): MatchSummary {
  if (state.phase.kind !== 'done') throw new Error('경기가 아직 안 끝났어요')
  const { winner } = state.phase
  return {
    mode: state.mode,
    difficulty: state.difficulty,
    outcome: winner === 'draw' ? 'draw' : winner === 0 ? 'win' : 'lose',
    stone: state.black === 0 ? 'black' : 'white',
    moves: state.moves.length,
  }
}
