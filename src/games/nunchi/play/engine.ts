// 눈치게임 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 판: 3·2·1 → 외치기(누른 순서대로 1, 2, 3…) → 탈락자 보여주기 → 남은 사람끼리 다음 판.
// 2명이 남으면 결승 가위바위보. 이기면 우승.
import { type Rng, createRng, pickOne } from '../../../shared/random'
import { BOT_STYLES, CALL_MS, COLLIDE_MS, COUNTDOWN_MS, DONE_MS, RESULT_MS, RPS_PICK_MS, RPS_REVEAL_MS } from '../constants'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'

export type Player = { id: string; name: string; kind: PlayerKind }

export type Hand = 'rock' | 'paper' | 'scissors'
export const HANDS: readonly Hand[] = ['rock', 'paper', 'scissors']

export type Press = { player: number; at: number }

/** 탈락 이유: 동시에 누름 / 마지막 한 명 / 시간 초과 / 결승에서 짐 / 나감 */
export type OutReason = 'collide' | 'last' | 'timeout' | 'final' | 'left'

export type Phase =
  | { kind: 'countdown'; until: number }
  | { kind: 'call'; start: number; until: number }
  /** losers가 비었으면(모두 탈락할 뻔) 그 판은 다시 */
  | { kind: 'result'; losers: { player: number; reason: OutReason }[]; replay: boolean; until: number }
  | { kind: 'rps'; until: number }
  | { kind: 'reveal'; hands: Partial<Record<number, Hand>>; winner: number | null; until: number }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  alive: boolean[]
  /** 판마다 탈락한 사람들 (같은 판이면 같은 등수) */
  out: number[][]
  round: number
  /** 이번 판에 누른 순서 */
  presses: Press[]
  /** 결승 가위바위보에서 고른 손 */
  picks: Partial<Record<number, Hand>>
  /** 봇이 누를(고를) 시각 */
  botAt: Partial<Record<number, number>>
  phase: Phase
}

export type EngineAction =
  | { type: 'tick'; now: number }
  | { type: 'press'; player: number }
  | { type: 'pick'; player: number; hand: Hand }
  /** 친구가 나감: 그 자리에서 탈락 */
  | { type: 'drop'; player: number }

const within = (rng: Rng, [min, max]: readonly [number, number]) => min + rng.next() * (max - min)

export const aliveIndexes = (s: { alive: boolean[] }) => s.alive.flatMap((a, i) => (a ? [i] : []))

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  return countdown({
    now: opts.now,
    seed: opts.seed,
    players: opts.players,
    alive: opts.players.map(() => true),
    out: [],
    round: 1,
    presses: [],
    picks: {},
    botAt: {},
    phase: { kind: 'countdown', until: 0 },
  })
}


function countdown(s: EngineState): EngineState {
  return { ...s, presses: [], phase: { kind: 'countdown', until: s.now + COUNTDOWN_MS } }
}

function startCall(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const botAt: Partial<Record<number, number>> = {}
  let botNo = 0
  s.players.forEach((p, i) => {
    if (p.kind !== 'bot' || !s.alive[i]) return
    botAt[i] = s.now + within(rng, BOT_STYLES[botNo++ % BOT_STYLES.length])
  })
  return { ...s, seed: rng.seed(), botAt, presses: [], phase: { kind: 'call', start: s.now, until: s.now + CALL_MS } }
}

/** 동시에 누른 사람들: 다른 누군가와 COLLIDE_MS 안에 누름 */
export function collidedOf(presses: readonly Press[]): Set<number> {
  const hit = new Set<number>()
  presses.forEach((a, i) =>
    presses.forEach((b, j) => {
      if (i !== j && Math.abs(a.at - b.at) <= COLLIDE_MS) hit.add(a.player)
    }),
  )
  return hit
}

/** 이번 판에 아직 안 누른 살아 있는 사람 */
export function waitingOf(s: EngineState): number[] {
  return aliveIndexes(s).filter((i) => !s.presses.some((p) => p.player === i))
}

/**
 * 판이 끝났으면 탈락자 정리. 아직이면 null
 * - 겹치면 그 자리에서 판이 끝나고 겹친 사람만 탈락, 남은 사람끼리 1부터 다시 (처음엔 판 끝까지 갔는데 바꿈)
 * - 안 겹치면 마지막 한 명 / 시간 초과면 안 누른 사람 모두 탈락
 */
function judgeCall(s: EngineState): EngineState | null {
  if (s.phase.kind !== 'call') return null
  const waiting = waitingOf(s)
  const lastPress = s.presses.at(-1)?.at ?? -Infinity
  // 마지막으로 누른 뒤 COLLIDE_MS가 지나야 '동시'인지 확정된다 (셋이 겹치는 것도 다 잡게)
  const settled = s.now - lastPress > COLLIDE_MS
  const collided = collidedOf(s.presses)
  const timeout = s.now >= s.phase.until
  let losers: { player: number; reason: OutReason }[]
  if (collided.size > 0 && (settled || timeout)) {
    losers = [...collided].map((player) => ({ player, reason: 'collide' }))
  } else if (timeout || (waiting.length <= 1 && settled)) {
    losers = waiting.map((player) => ({ player, reason: timeout && waiting.length > 1 ? 'timeout' : 'last' }))
  } else return null
  const replay = losers.length >= aliveIndexes(s).length
  return { ...s, botAt: {}, phase: { kind: 'result', losers: replay ? [] : losers, replay, until: s.now + RESULT_MS } }
}

function afterResult(s: EngineState): EngineState {
  if (s.phase.kind !== 'result') return s
  const losers = s.phase.losers.map((l) => l.player)
  const next: EngineState = losers.length
    ? { ...s, alive: s.alive.map((a, i) => a && !losers.includes(i)), out: [...s.out, losers] }
    : s
  const left = aliveIndexes(next).length
  if (left <= 1) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  if (left === 2) return startRps({ ...next, round: next.round + 1 })
  return countdown({ ...next, round: next.round + 1 })
}

function startRps(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const botAt: Partial<Record<number, number>> = {}
  for (const i of aliveIndexes(s)) if (s.players[i].kind === 'bot') botAt[i] = s.now + within(rng, [400, RPS_PICK_MS - 300])
  return { ...s, seed: rng.seed(), picks: {}, botAt, presses: [], phase: { kind: 'rps', until: s.now + RPS_PICK_MS } }
}

const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }

function revealRps(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const [a, b] = aliveIndexes(s)
  // 안 고르면 무작위
  const hands: Partial<Record<number, Hand>> = { [a]: s.picks[a] ?? pickOne(rng, HANDS), [b]: s.picks[b] ?? pickOne(rng, HANDS) }
  const ha = hands[a]!
  const hb = hands[b]!
  const winner = ha === hb ? null : BEATS[ha] === hb ? a : b
  return { ...s, seed: rng.seed(), botAt: {}, phase: { kind: 'reveal', hands, winner, until: s.now + RPS_REVEAL_MS } }
}

function afterReveal(s: EngineState): EngineState {
  if (s.phase.kind !== 'reveal') return s
  const { winner } = s.phase
  if (winner === null) return startRps(s)
  const loser = aliveIndexes(s).find((i) => i !== winner)!
  return { ...s, alive: s.alive.map((a, i) => a && i !== loser), out: [...s.out, [loser]], phase: { kind: 'done', until: s.now + DONE_MS } }
}

function bots(s: EngineState): EngineState {
  let next = s
  for (const [key, at] of Object.entries(s.botAt)) {
    const i = Number(key)
    if (at === undefined || s.now < at) continue
    const rest = { ...next.botAt }
    delete rest[i]
    next = { ...next, botAt: rest }
    if (s.phase.kind === 'call') next = press(next, i)
    if (s.phase.kind === 'rps') {
      const rng = createRng(next.seed)
      const hand = pickOne(rng, HANDS)
      next = pick({ ...next, seed: rng.seed() }, i, hand)
    }
  }
  return next
}

function press(s: EngineState, player: number): EngineState {
  if (s.phase.kind !== 'call' || !s.alive[player] || s.presses.some((p) => p.player === player)) return s
  return { ...s, presses: [...s.presses, { player, at: s.now }] }
}

function pick(s: EngineState, player: number, hand: Hand): EngineState {
  if (s.phase.kind !== 'rps' || !s.alive[player]) return s
  return { ...s, picks: { ...s.picks, [player]: hand } }
}

function drop(s: EngineState, player: number): EngineState {
  if (!s.alive[player] || s.phase.kind === 'done') return s
  const next: EngineState = { ...s, alive: s.alive.map((a, i) => a && i !== player), out: [...s.out, [player]] }
  const left = aliveIndexes(next).length
  if (left <= 1) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  // 결승이었거나 둘만 남았으면 남은 둘로 가위바위보, 아니면 이번 판 다시
  if (left === 2) return startRps(next)
  return s.phase.kind === 'call' ? countdown(next) : next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'countdown':
      return now >= phase.until ? startCall(s) : s
    case 'call': {
      const b = bots(s)
      return judgeCall(b) ?? b
    }
    case 'result':
      return now >= phase.until ? afterResult(s) : s
    case 'rps': {
      const b = bots(s)
      return now >= phase.until ? revealRps(b) : b
    }
    case 'reveal':
      return now >= phase.until ? afterReveal(s) : s
    case 'done':
      return s
  }
}

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'press':
      return press(state, action.player)
    case 'pick':
      return pick(state, action.player, action.hand)
    case 'drop':
      return drop(state, action.player)
  }
}

/** 사람별 등수 (1 = 우승). 끝나기 전이면 남은 사람은 모두 1 */
export function ranksOf(s: EngineState): number[] {
  const ranks = s.players.map(() => 1)
  let next = aliveIndexes(s).length + 1
  for (const group of [...s.out].reverse()) {
    for (const i of group) ranks[i] = next
    next += group.length
  }
  return ranks
}
