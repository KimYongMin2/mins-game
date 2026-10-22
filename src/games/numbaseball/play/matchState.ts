// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 흐름: 내 숫자 정하기(30초) → '시작!' → 번갈아 부르기(한 번에 30초) → 결과 보여주기 → … → 끝
//
// 모드
// - bot: 나 vs 봇. 봇 숫자는 이 기기가 알고 있어 바로 판정한다
// - pvp: 나 vs 친구. 각 기기는 자기 숫자만 안다. 내가 부르면(guess) 친구 기기가 판정해 답(answer)을 보낸다
// - solo: 봇이 정한 숫자를 혼자 맞히기. 내 숫자는 정하지 않는다
//
// 공평하게: 먼저 부른 쪽이 맞혀도 나중 쪽에게 같은 횟수만큼 기회를 준다. 둘 다 맞히면 무승부.
// 그래서 끝났는지는 둘이 부른 횟수가 같을 때만 본다.
import { type Rng, createRng } from '../../../shared/random'
import { chooseBotGuess } from '../bot/guessBot'
import {
  BOT_THINK_MS,
  DONE_MS,
  type Difficulty,
  INTRO_MS,
  type Length,
  MAX_TRIES,
  RESULT_MS,
  SOLO_MAX_TRIES,
  TURN_MS,
} from '../constants'
import { type Digits, type Score, isSolved, isValidNumber, randomNumber, score } from '../rules/numbers'

export type Mode = 'bot' | 'pvp' | 'solo'
export type Side = 0 | 1
export type Pair<T> = readonly [T, T]

/** 부른 숫자 하나. 친구 대전에서 내가 부른 건 친구 답이 오기 전까지 score가 null */
export type Guess = { digits: Digits; score: Score | null }

export type SoundName = 'lock' | 'out' | 'hit' | 'solve' | 'win' | 'lose' | 'draw'

export type Phase =
  /** 내 숫자 정하기. until에 시간 초과(무작위) */
  | { kind: 'setup'; until: number }
  | { kind: 'intro'; until: number }
  /** 차례인 쪽이 부르는 중. botAt에 봇이 부른다 */
  | { kind: 'guessing'; until: number; botAt: number }
  /** 친구 대전: 내가 불렀고 친구 기기의 답을 기다림 */
  | { kind: 'waiting' }
  /** 방금 부른 결과를 보여주는 중 */
  | { kind: 'result'; until: number }
  /** solo는 맞히면 0, 못 맞히면 1이 이긴 걸로 */
  | { kind: 'done'; winner: Side | 'draw'; until: number }

export type MatchState = {
  now: number
  seed: number
  mode: Mode
  difficulty: Difficulty
  length: Length
  /** 내 숫자(0)와 상대 숫자(1). 친구 숫자는 경기가 끝나고 받기 전까지 null */
  secrets: Pair<Digits | null>
  /** 숫자를 정했는지 */
  locked: Pair<boolean>
  /** guesses[side] = side가 상대 숫자를 맞히려고 부른 것들 */
  guesses: Pair<Guess[]>
  turn: Side
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  /** 내 숫자 정하기 */
  | { type: 'setSecret'; digits: Digits }
  /** 내가 부름 */
  | { type: 'guess'; digits: Digits }
  /** 친구가 숫자를 정했음 */
  | { type: 'remoteLocked' }
  /** 친구가 n번째로 부른 숫자 (내 숫자로 판정한다) */
  | { type: 'remoteGuess'; n: number; digits: Digits }
  /** 내가 n번째로 부른 숫자에 대한 친구 기기의 판정 */
  | { type: 'remoteAnswer'; n: number; score: Score }
  /** 경기가 끝나고 친구가 알려준 친구 숫자 */
  | { type: 'remoteReveal'; digits: Digits }

const set = <T,>(pair: Pair<T>, side: Side, value: T): Pair<T> => (side === 0 ? [value, pair[1]] : [pair[0], value])

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
  length: Length
  /** 친구 대전: 방장이 정해서 보낸 선공 (나 = 0). 봇전은 seed로 정한다 */
  first?: Side
}): MatchState {
  const rng = createRng(opts.seed)
  const solo = opts.mode === 'solo'
  const first: Side = solo ? 0 : (opts.first ?? (rng.next() < 0.5 ? 0 : 1))
  const botSecret = opts.mode === 'pvp' ? null : randomNumber(rng, opts.length)
  const state: MatchState = {
    now: opts.now,
    seed: rng.seed(),
    mode: opts.mode,
    difficulty: opts.difficulty,
    length: opts.length,
    secrets: [null, botSecret],
    // 봇은 바로 정함, 혼자 하기는 내 숫자가 필요 없다
    locked: [solo, opts.mode !== 'pvp'],
    guesses: [[], []],
    turn: first,
    phase: { kind: 'setup', until: opts.now + TURN_MS },
    sounds: [],
    soundSeq: 0,
  }
  return solo ? intro(state) : state
}

const intro = (state: MatchState): MatchState => ({ ...state, phase: { kind: 'intro', until: state.now + INTRO_MS } })

function guessing(state: MatchState, rng: Rng): MatchState {
  const botAt = state.now + BOT_THINK_MS.min + rng.next() * (BOT_THINK_MS.max - BOT_THINK_MS.min)
  return { ...state, seed: rng.seed(), phase: { kind: 'guessing', until: state.now + TURN_MS, botAt } }
}

/** 상대 쪽 조작 주체 */
const opponent = (state: MatchState) => (state.mode === 'pvp' ? 'remote' : 'bot')

function lock(state: MatchState, side: Side, digits: Digits | null): MatchState {
  if (state.phase.kind !== 'setup' || state.locked[side]) return state
  const next: MatchState = {
    ...state,
    secrets: digits ? set(state.secrets, side, digits) : state.secrets,
    locked: set(state.locked, side, true),
  }
  const sounded = side === 0 ? withSounds(next, 'lock') : next
  return sounded.locked[0] && sounded.locked[1] ? intro(sounded) : sounded
}

/** side가 부른 숫자를 기록. 판정을 알면 결과 보여주기로, 모르면(친구 대전의 내 차례) 답을 기다린다 */
function addGuess(state: MatchState, side: Side, digits: Digits, s: Score | null): MatchState {
  const guesses = set(state.guesses, side, [...state.guesses[side], { digits, score: s }])
  const next = { ...state, guesses }
  return s ? showResult(next, s) : { ...next, phase: { kind: 'waiting' } }
}

function showResult(state: MatchState, s: Score): MatchState {
  const sound: SoundName = isSolved(s, state.length) ? 'solve' : s.strike + s.ball === 0 ? 'out' : 'hit'
  return withSounds({ ...state, phase: { kind: 'result', until: state.now + RESULT_MS } }, sound)
}

const solvedBy = (state: MatchState, side: Side) => state.guesses[side].some((g) => g.score && isSolved(g.score, state.length))

/** 결과를 다 보여준 뒤: 끝났는지 보고, 아니면 다음 차례 */
function afterResult(state: MatchState): MatchState {
  const rng = createRng(state.seed)
  if (state.mode === 'solo') {
    if (solvedBy(state, 0)) return finish(state, 0)
    if (state.guesses[0].length >= SOLO_MAX_TRIES) return finish(state, 1)
    return guessing(state, rng)
  }
  const [a, b] = state.guesses.map((g) => g.length)
  if (a === b) {
    const [s0, s1] = [solvedBy(state, 0), solvedBy(state, 1)]
    if (s0 || s1) return finish(state, s0 && s1 ? 'draw' : s0 ? 0 : 1)
    if (a >= MAX_TRIES) return finish(state, 'draw')
  }
  return guessing({ ...state, turn: (1 - state.turn) as Side }, rng)
}

function finish(state: MatchState, winner: Side | 'draw'): MatchState {
  const sound: SoundName = winner === 'draw' ? 'draw' : winner === 0 ? 'win' : 'lose'
  return withSounds({ ...state, phase: { kind: 'done', winner, until: state.now + DONE_MS } }, sound)
}

/** 시작 안내·결과 보여주기가 남아 있으면 바로 끝낸다 (친구가 부른 게 조금 일찍 도착했을 때) */
function settle(state: MatchState): MatchState {
  if (state.phase.kind === 'intro') return guessing(state, createRng(state.seed))
  if (state.phase.kind === 'result') return afterResult(state)
  return state
}

/** 내 차례에 부르기 (사람이 누름 / 시간 초과 무작위) */
function myGuess(state: MatchState, digits: Digits): MatchState {
  if (state.phase.kind !== 'guessing' || state.turn !== 0 || !isValidNumber(digits, state.length)) return state
  const secret = state.secrets[1]
  return addGuess(state, 0, digits, state.mode === 'pvp' || !secret ? null : score(secret, digits))
}

function tick(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'setup': {
      if (now < phase.until || state.locked[0]) return state
      const rng = createRng(state.seed)
      return lock({ ...state, seed: rng.seed() }, 0, randomNumber(rng, state.length))
    }
    case 'intro':
      return now >= phase.until ? guessing(state, createRng(state.seed)) : state
    case 'result':
      return now >= phase.until ? afterResult(state) : state
    case 'guessing': {
      const rng = createRng(state.seed)
      if (state.turn === 1 && opponent(state) === 'bot' && now >= phase.botAt) {
        const clues = state.guesses[1].map((g) => ({ digits: g.digits, score: g.score! }))
        const digits = chooseBotGuess(rng, state.length, clues, state.difficulty)
        return addGuess({ ...state, seed: rng.seed() }, 1, digits, score(state.secrets[0]!, digits))
      }
      // 시간 초과는 차례인 사람 기기만 처리한다 (친구 차례면 친구 기기가 보낸다)
      if (state.turn === 0 && now >= phase.until) return myGuess({ ...state, seed: rng.seed() }, randomNumber(rng, state.length))
      return state
    }
    case 'waiting':
    case 'done':
      return state
  }
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'setSecret':
      return isValidNumber(action.digits, state.length) ? lock(state, 0, action.digits) : state
    case 'guess':
      return myGuess(state, action.digits)
    case 'remoteLocked':
      return state.mode === 'pvp' ? lock(state, 1, null) : state
    case 'remoteGuess': {
      if (state.mode !== 'pvp' || action.n !== state.guesses[1].length) return state
      const s = settle(state)
      if (s.phase.kind !== 'guessing' || s.turn !== 1 || !isValidNumber(action.digits, s.length)) return state
      return addGuess(s, 1, action.digits, score(s.secrets[0]!, action.digits))
    }
    case 'remoteAnswer': {
      const g = state.guesses[0][action.n]
      if (state.phase.kind !== 'waiting' || !g || g.score) return state
      const mine = state.guesses[0].map((x, i) => (i === action.n ? { ...x, score: action.score } : x))
      return showResult({ ...state, guesses: [mine, state.guesses[1]] }, action.score)
    }
    case 'remoteReveal':
      return state.mode === 'pvp' && !state.secrets[1] ? { ...state, secrets: [state.secrets[0], action.digits] } : state
  }
}

export type MatchSummary = {
  mode: Mode
  difficulty: Difficulty
  length: Length
  /** 내 입장에서. solo는 맞히면 win, 못 맞히면 lose */
  outcome: 'win' | 'lose' | 'draw'
  /** 내가 부른 횟수 */
  tries: number
  /** 상대가 부른 횟수 (solo는 0) */
  foeTries: number
}

export function summarizeMatch(state: MatchState): MatchSummary {
  if (state.phase.kind !== 'done') throw new Error('경기가 아직 안 끝났어요')
  const { winner } = state.phase
  return {
    mode: state.mode,
    difficulty: state.difficulty,
    length: state.length,
    outcome: winner === 'draw' ? 'draw' : winner === 0 ? 'win' : 'lose',
    tries: state.guesses[0].length,
    foeTries: state.guesses[1].length,
  }
}
