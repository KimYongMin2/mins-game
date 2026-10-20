// 윷놀이 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 차례: 던질 수 있는 만큼 던지고(윷·모·잡기면 한 번 더) → 쌓인 결과를 하나씩 골라 말을 옮긴다 → 다 쓰면 다음 사람.
import { createRng } from '../../../shared/random'
import { chooseBotMove } from '../bot/yutBot'
import { BOT_THINK_MS, DECIDE_MS, DONE_MS, INTRO_MS, THROW_SHOW_MS } from '../constants'
import { nodeOf } from '../rules/board'
import { type From, type Piece, type Pieces, allOut, applyMove, movesFor } from '../rules/moves'
import { type Throw, isBonus, throwYut } from '../rules/throw'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'

export type Player = { id: string; name: string; kind: PlayerKind }

export type Phase =
  | { kind: 'intro'; until: number }
  /** until = 이때까지 안 고르면 저절로 */
  | { kind: 'turn'; until: number }
  | { kind: 'done'; winner: number; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  pieces: Piece[][]
  turn: number
  /** 쌓인 결과 (아직 안 쓴 것) */
  pending: Throw[]
  /** 지금 던질 수 있는 횟수. 남아 있으면 먼저 던져야 한다 */
  throwsLeft: number
  /** 던진 결과를 보여주는 동안은 다음 행동을 막는다 */
  lockUntil: number
  /** 마지막 던지기·움직임 (화면 연출용). seq가 바뀌면 새것 */
  lastThrow: { player: number; result: Throw; seq: number } | null
  lastMove: { player: number; from: From; to: number | 'out'; captured: number; seq: number } | null
  /** 방에서 나간 친구 (차례에서 뺀다) */
  left: boolean[]
  botAt: number | null
  seq: number
  phase: Phase
}

export type EngineAction =
  | { type: 'tick'; now: number }
  | { type: 'throw'; player: number }
  | { type: 'move'; player: number; throwIdx: number; from: From }
  /** 친구가 나감: 차례에서 빼고 말은 판에서 치운다 */
  | { type: 'drop'; player: number }

export function createEngine(opts: { now: number; seed: number; players: Player[]; pieceCount: number }): EngineState {
  const rng = createRng(opts.seed)
  const first = Math.floor(rng.next() * opts.players.length)
  return {
    now: opts.now,
    seed: rng.seed(),
    players: opts.players,
    pieces: opts.players.map(() => Array.from({ length: opts.pieceCount }, () => 'home' as const)),
    turn: first,
    pending: [],
    throwsLeft: 1,
    lockUntil: 0,
    lastThrow: null,
    lastMove: null,
    left: opts.players.map(() => false),
    botAt: null,
    seq: 0,
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
  }
}

/** 지금 이 사람이 던질 수 있는지 */
export function canThrow(s: EngineState, player: number): boolean {
  return s.phase.kind === 'turn' && s.turn === player && s.throwsLeft > 0 && s.now >= s.lockUntil
}

/** 지금 이 사람이 말을 옮길 수 있는지 (던질 게 남아 있으면 먼저 던져야 함) */
export function canMove(s: EngineState, player: number): boolean {
  return s.phase.kind === 'turn' && s.turn === player && s.throwsLeft === 0 && s.now >= s.lockUntil
}

function decide(s: EngineState): EngineState {
  return { ...s, botAt: null, phase: { kind: 'turn', until: s.now + DECIDE_MS } }
}

/** 쓸 수 없는 결과는 버리고, 다 썼으면 다음 사람 */
function tidy(s: EngineState): EngineState {
  if (s.phase.kind !== 'turn' || s.throwsLeft > 0) return s
  let pending = s.pending
  // 빽도는 판 위에 말이 없고, 다른 결과로 말을 올릴 수도 없을 때만 버린다
  if (movesFor(s.pieces, s.turn, pending).length === 0) pending = []
  if (pending.length > 0) return { ...s, pending }
  return nextTurn({ ...s, pending })
}

function nextTurn(s: EngineState): EngineState {
  const n = s.players.length
  let turn = s.turn
  for (let k = 1; k <= n; k++) {
    const t = (s.turn + k) % n
    if (!s.left[t]) {
      turn = t
      break
    }
  }
  return decide({ ...s, turn, pending: [], throwsLeft: 1 })
}

function doThrow(s: EngineState, player: number): EngineState {
  if (!canThrow(s, player)) return s
  const rng = createRng(s.seed)
  const result = throwYut(rng)
  const seq = s.seq + 1
  const next: EngineState = {
    ...s,
    seed: rng.seed(),
    seq,
    pending: [...s.pending, result],
    throwsLeft: s.throwsLeft - 1 + (isBonus(result) ? 1 : 0),
    lockUntil: s.now + THROW_SHOW_MS,
    lastThrow: { player, result, seq },
  }
  return tidy(decide(next))
}

function doMove(s: EngineState, player: number, throwIdx: number, from: From): EngineState {
  if (!canMove(s, player)) return s
  const move = movesFor(s.pieces, player, s.pending).find((m) => m.throwIdx === throwIdx && m.from === from)
  if (!move) return s
  const t = s.pending[throwIdx]
  const { pieces, captured, bonus } = applyMove(s.pieces, player, t, from, move.to)
  const seq = s.seq + 1
  const next: EngineState = {
    ...s,
    seq,
    pieces,
    pending: s.pending.filter((_, i) => i !== throwIdx),
    throwsLeft: bonus ? 1 : 0,
    lastMove: { player, from, to: move.to === 'out' ? 'out' : nodeOf(move.to), captured, seq },
  }
  if (allOut(pieces[player])) return { ...next, pending: [], phase: { kind: 'done', winner: player, until: s.now + DONE_MS } }
  return tidy(decide(next))
}

/** 봇·시간 초과: 던질 게 있으면 던지고, 아니면 봇처럼 고른다 */
function auto(s: EngineState): EngineState {
  if (s.throwsLeft > 0) return doThrow(s, s.turn)
  const rng = createRng(s.seed)
  const m = chooseBotMove(rng, s.pieces as Pieces, s.turn, s.pending)
  const next = { ...s, seed: rng.seed() }
  return m ? doMove(next, s.turn, m.throwIdx, m.from) : tidy(next)
}

function drop(s: EngineState, player: number): EngineState {
  if (s.left[player] || s.phase.kind === 'done') return s
  const left = s.left.map((l, i) => l || i === player)
  const pieces = s.pieces.map((row, i) => (i === player ? row.map(() => 'home' as const) : row))
  const stay = left.flatMap((l, i) => (l ? [] : [i]))
  if (stay.length === 1) return { ...s, left, pieces, phase: { kind: 'done', winner: stay[0], until: s.now + DONE_MS } }
  const next = { ...s, left, pieces }
  return s.turn === player ? nextTurn(next) : next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'intro':
      return now >= phase.until ? decide(s) : s
    case 'turn': {
      if (now < s.lockUntil) return s
      if (s.players[s.turn].kind === 'bot') {
        if (s.botAt === null) return { ...s, botAt: now + BOT_THINK_MS }
        return now >= s.botAt ? auto({ ...s, botAt: null }) : s
      }
      // 시간 초과는 사람·친구 모두 심판이 대신 한다
      return now >= phase.until ? auto(s) : s
    }
    case 'done':
      return s
  }
}

export function engineReducer(s: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'tick':
      return tick({ ...s, now: action.now })
    case 'throw':
      return doThrow(s, action.player)
    case 'move':
      return doMove(s, action.player, action.throwIdx, action.from)
    case 'drop':
      return drop(s, action.player)
  }
}
