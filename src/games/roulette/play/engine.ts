// 러시안룰렛 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 총알 한 발이 1~6번째 당김 중 하나에 들어 있다. 차례인 사람이 아무나(나 포함) 골라 방아쇠를 당긴다.
// - 빈 칸: 지목당한 사람 차례 (나를 쐈으면 내가 한 번 더)
// - 맞음: 그 사람 탈락, 총알을 다시 넣고 쏜 사람이 계속. 나를 쏴서 죽으면 다음 자리 사람 차례
// 마지막 한 명이 우승.
import { type Rng, createRng } from '../../../shared/random'
import { chooseTarget } from '../bot/rouletteBot'
import { BANG_SHOW_MS, BLANK_SHOW_MS, BOT_AIM_MS, BOT_PULL_MS, CHAMBERS, DONE_MS, INTRO_MS, SUSPENSE_MS, TURN_MS } from '../constants'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'

export type Player = { id: string; name: string; kind: PlayerKind }

export type Fire = { shooter: number; target: number; bang: boolean }

export type Phase =
  | { kind: 'intro'; until: number }
  | { kind: 'aim'; until: number }
  | { kind: 'fire'; fire: Fire; until: number }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  alive: boolean[]
  /** 탈락한 순서 */
  out: number[]
  kills: number[]
  turn: number
  /** 지금 겨누고 있는 사람 (차례인 사람이 골라 둔 것) */
  aimAt: number | null
  /** 총알이 든 칸 (1~6번째 당김) */
  chamber: number
  /** 이번 총으로 당긴 횟수 */
  pulls: number
  /** 봇 차례: 고를 시각·당길 시각 */
  bot: { aimAt: number; pullAt: number; target: number } | null
  phase: Phase
}

export type EngineAction =
  | { type: 'tick'; now: number }
  /** 차례인 사람이 쏠 사람을 고름 (바꿀 수 있음) */
  | { type: 'aim'; player: number; target: number }
  /** 차례인 사람이 방아쇠를 당김 (target을 주면 그 사람, 아니면 골라 둔 사람) */
  | { type: 'pull'; player: number; target?: number }
  /** 친구가 나감: 그 자리에서 탈락 */
  | { type: 'drop'; player: number }

export const aliveIndexes = (s: { alive: boolean[] }) => s.alive.flatMap((a, i) => (a ? [i] : []))

const within = (rng: Rng, [min, max]: readonly [number, number]) => min + rng.next() * (max - min)

/** 자리 순서로 from 다음 살아 있는 사람 */
export function nextAlive(alive: readonly boolean[], from: number): number {
  for (let k = 1; k <= alive.length; k++) {
    const i = (from + k) % alive.length
    if (alive[i]) return i
  }
  return from
}

function reload(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const chamber = 1 + Math.floor(rng.next() * CHAMBERS)
  return { ...s, seed: rng.seed(), chamber, pulls: 0 }
}

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  const rng = createRng(opts.seed)
  const turn = Math.floor(rng.next() * opts.players.length)
  return reload({
    now: opts.now,
    seed: rng.seed(),
    players: opts.players,
    alive: opts.players.map(() => true),
    out: [],
    kills: opts.players.map(() => 0),
    turn,
    aimAt: null,
    chamber: 1,
    pulls: 0,
    bot: null,
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
  })
}

/** turn 사람 차례 시작 (봇이면 언제 고르고 당길지 정해 둔다) */
function startTurn(s: EngineState, turn: number): EngineState {
  let next: EngineState = { ...s, turn, aimAt: null, bot: null, phase: { kind: 'aim', until: s.now + TURN_MS } }
  if (s.players[turn].kind === 'bot') {
    const rng = createRng(s.seed)
    const target = chooseTarget(rng, turn, aliveIndexes(s), s.pulls)
    const aimAt = s.now + within(rng, BOT_AIM_MS)
    next = { ...next, seed: rng.seed(), bot: { aimAt, pullAt: aimAt + within(rng, BOT_PULL_MS), target } }
  }
  return next
}

function aim(s: EngineState, player: number, target: number): EngineState {
  if (s.phase.kind !== 'aim' || player !== s.turn || !s.alive[target]) return s
  return { ...s, aimAt: target }
}

function pull(s: EngineState, player: number, target: number | null = s.aimAt): EngineState {
  if (s.phase.kind !== 'aim' || player !== s.turn || target === null || !s.alive[target]) return s
  const pulls = s.pulls + 1
  const bang = pulls >= s.chamber
  const fire: Fire = { shooter: player, target, bang }
  return { ...s, aimAt: target, pulls, bot: null, phase: { kind: 'fire', fire, until: s.now + SUSPENSE_MS + (bang ? BANG_SHOW_MS : BLANK_SHOW_MS) } }
}

function afterFire(s: EngineState): EngineState {
  if (s.phase.kind !== 'fire') return s
  const { shooter, target, bang } = s.phase.fire
  if (!bang) return startTurn(s, s.alive[target] ? target : nextAlive(s.alive, target))
  const next: EngineState = {
    ...s,
    alive: s.alive.map((a, i) => a && i !== target),
    out: [...s.out, target],
    kills: s.kills.map((k, i) => (i === shooter && shooter !== target ? k + 1 : k)),
  }
  if (aliveIndexes(next).length <= 1) return { ...next, aimAt: null, phase: { kind: 'done', until: s.now + DONE_MS } }
  // 남을 맞혔으면 쏜 사람이 계속, 자기를 쐈으면 다음 자리 (쏜 사람이 그새 나갔어도 다음 자리)
  const turn = next.alive[shooter] ? shooter : nextAlive(next.alive, shooter)
  return startTurn(reload(next), turn)
}

function timeout(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const alive = aliveIndexes(s)
  const target = s.aimAt ?? alive[Math.floor(rng.next() * alive.length)]
  return pull({ ...s, seed: rng.seed() }, s.turn, target)
}

function bots(s: EngineState): EngineState {
  const b = s.bot
  if (!b) return s
  let next = s
  if (s.now >= b.aimAt && s.aimAt !== b.target) next = aim(next, s.turn, b.target)
  if (s.now >= b.pullAt) next = pull(next, s.turn, b.target)
  return next
}

function drop(s: EngineState, player: number): EngineState {
  if (!s.alive[player] || s.phase.kind === 'done') return s
  const next: EngineState = { ...s, alive: s.alive.map((a, i) => a && i !== player), out: [...s.out, player] }
  if (aliveIndexes(next).length <= 1) return { ...next, aimAt: null, phase: { kind: 'done', until: s.now + DONE_MS } }
  if (s.phase.kind === 'aim') {
    if (s.turn === player) return startTurn(next, nextAlive(next.alive, player))
    if (s.aimAt === player) return { ...next, aimAt: null }
  }
  return next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'intro':
      return now >= phase.until ? startTurn(s, s.turn) : s
    case 'aim': {
      const b = bots(s)
      if (b.phase.kind !== 'aim') return b
      return now >= phase.until ? timeout(b) : b
    }
    case 'fire':
      return now >= phase.until ? afterFire(s) : s
    case 'done':
      return s
  }
}

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'aim':
      return aim(state, action.player, action.target)
    case 'pull':
      return pull(state, action.player, action.target ?? state.aimAt)
    case 'drop':
      return drop(state, action.player)
  }
}

/** 사람별 등수 (1 = 우승). 늦게 탈락할수록 앞. 끝나기 전이면 남은 사람은 모두 1 */
export function ranksOf(s: EngineState): number[] {
  const ranks = s.players.map(() => 1)
  const left = aliveIndexes(s).length
  ;[...s.out].reverse().forEach((i, k) => (ranks[i] = left + 1 + k))
  return ranks
}
