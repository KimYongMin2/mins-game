// 폭탄 돌리기 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 판: 3·2·1 → 폭탄 돌리기(언제 터질지 모름) → 펑! 들고 있던 사람 탈락 → 남은 사람끼리 다음 판. 한 명 남으면 끝.
// 폭탄은 바로 옆(왼쪽·오른쪽) 살아 있는 사람에게만 던질 수 있다 (처음엔 아무에게나였는데 바꿈).
import { type Rng, createRng, pickOne } from '../../../shared/random'
import { BOOM_MS, BOT_HOLD_MS, COUNTDOWN_MS, DONE_MS, FLIGHT_MS, FUSE_MS, MIN_HOLD_MS } from '../constants'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'

export type Player = { id: string; name: string; kind: PlayerKind }

export type Phase =
  | { kind: 'countdown'; until: number }
  | { kind: 'play'; start: number; explodeAt: number }
  | { kind: 'boom'; victim: number; until: number }
  | { kind: 'done'; until: number }

export type Flight = { from: number; to: number; landAt: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  alive: boolean[]
  /** 탈락한 순서 */
  out: number[]
  round: number
  /** 폭탄을 든 사람 (날아가는 중이면 던진 사람) */
  holder: number
  /** 지금 든 사람이 폭탄을 받은 시각 (MIN_HOLD_MS가 지나야 던질 수 있음) */
  heldSince: number
  flight: Flight | null
  phase: Phase
  /** 봇이 폭탄을 넘길 시각 (봇이 들고 있을 때만) */
  botAt: number | null
  /** 사람별로 넘긴 횟수 */
  passes: number[]
}

export type EngineAction =
  | { type: 'tick'; now: number }
  /** from이 to에게 폭탄을 던짐 (사람 번호) */
  | { type: 'pass'; from: number; to: number }
  /** 친구가 나감: 그 자리에서 탈락 */
  | { type: 'drop'; player: number }

const within = (rng: Rng, [min, max]: readonly [number, number]) => min + rng.next() * (max - min)

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  return countdown({
    now: opts.now,
    seed: opts.seed,
    players: opts.players,
    alive: opts.players.map(() => true),
    out: [],
    round: 1,
    holder: 0,
    heldSince: 0,
    flight: null,
    phase: { kind: 'countdown', until: 0 },
    botAt: null,
    passes: opts.players.map(() => 0),
  })
}

function countdown(state: EngineState): EngineState {
  return { ...state, flight: null, botAt: null, phase: { kind: 'countdown', until: state.now + COUNTDOWN_MS } }
}

const aliveIndexes = (state: EngineState) => state.alive.flatMap((a, i) => (a ? [i] : []))

function startPlay(state: EngineState): EngineState {
  const rng = createRng(state.seed)
  const holder = pickOne(rng, aliveIndexes(state))
  const explodeAt = state.now + within(rng, FUSE_MS)
  return { ...state, seed: rng.seed(), holder, heldSince: state.now, phase: { kind: 'play', start: state.now, explodeAt } }
}

/** 그 사람을 탈락시킨다. 한 명만 남으면 끝 */
function eliminate(state: EngineState, victim: number): EngineState {
  return { ...state, alive: state.alive.map((a, i) => a && i !== victim), out: [...state.out, victim] }
}

function explode(state: EngineState): EngineState {
  const victim = state.flight ? state.flight.to : state.holder
  return { ...eliminate(state, victim), flight: null, botAt: null, phase: { kind: 'boom', victim, until: state.now + BOOM_MS } }
}

function afterBoom(state: EngineState): EngineState {
  if (aliveIndexes(state).length <= 1) return { ...state, phase: { kind: 'done', until: state.now + DONE_MS } }
  return countdown({ ...state, round: state.round + 1 })
}

function land(state: EngineState): EngineState {
  const { flight } = state
  if (!flight || state.now < flight.landAt) return state
  return { ...state, holder: flight.to, heldSince: state.now, flight: null }
}

function botTurn(state: EngineState): EngineState {
  const { holder } = state
  if (state.phase.kind !== 'play' || state.flight || state.players[holder].kind !== 'bot') return state
  const rng = createRng(state.seed)
  if (state.botAt === null) return { ...state, seed: rng.seed(), botAt: state.now + within(rng, BOT_HOLD_MS) }
  if (state.now < state.botAt) return state
  const to = pickOne(rng, neighborsOf(state.alive, holder) ?? [])
  return pass({ ...state, seed: rng.seed() }, holder, to)
}

/**
 * i 바로 옆에 앉은 살아 있는 사람: [왼쪽, 오른쪽]. 자리 번호가 커지는 쪽이 왼쪽
 * (화면에서 나를 맨 아래에 두고 시계 방향으로 앉히므로 다음 번호가 내 왼쪽에 보인다). 둘만 남으면 같은 사람
 */
export function neighborsOf(alive: readonly boolean[], i: number): [number, number] | null {
  const n = alive.length
  const step = (dir: 1 | -1) => {
    for (let k = 1; k < n; k++) {
      const j = (i + dir * k + n) % n
      if (alive[j]) return j
    }
    return -1
  }
  const left = step(1)
  return left < 0 ? null : [left, step(-1)]
}

/** 받은 폭탄을 다시 던질 수 있게 되기까지 남은 시간 */
export function holdLeft(state: EngineState): number {
  return Math.max(0, state.heldSince + MIN_HOLD_MS - state.now)
}

/** 지금 from이 to에게 던질 수 있는지 (받고 MIN_HOLD_MS가 지난 뒤, 바로 옆 사람에게만) */
export function canPass(state: EngineState, from: number, to: number): boolean {
  if (state.phase.kind !== 'play' || state.flight !== null || state.holder !== from || from === to) return false
  if (holdLeft(state) > 0) return false
  return neighborsOf(state.alive, from)?.includes(to) ?? false
}

function pass(state: EngineState, from: number, to: number): EngineState {
  if (!canPass(state, from, to)) return state
  return {
    ...state,
    flight: { from, to, landAt: state.now + FLIGHT_MS },
    botAt: null,
    passes: state.passes.map((n, i) => (i === from ? n + 1 : n)),
  }
}

function drop(state: EngineState, player: number): EngineState {
  if (!state.alive[player] || state.phase.kind === 'done') return state
  let next = eliminate(state, player)
  const left = aliveIndexes(next)
  if (left.length <= 1) return { ...next, flight: null, phase: { kind: 'done', until: state.now + DONE_MS } }
  // 나간 사람이 폭탄을 들고 있었거나 받는 중이었으면 남은 사람 중 아무에게나
  const involved = next.holder === player || next.flight?.to === player || next.flight?.from === player
  if (involved) {
    const rng = createRng(next.seed)
    next = { ...next, seed: rng.seed(), holder: pickOne(rng, left), heldSince: state.now, flight: null, botAt: null }
  }
  return next
}

function tick(state: EngineState): EngineState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'countdown':
      return now >= phase.until ? startPlay(state) : state
    case 'play':
      if (now >= phase.explodeAt) return explode(state)
      return botTurn(land(state))
    case 'boom':
      return now >= phase.until ? afterBoom(state) : state
    case 'done':
      return state
  }
}

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'pass':
      return pass(state, action.from, action.to)
    case 'drop':
      return drop(state, action.player)
  }
}

/** 순위: 1등(끝까지 남은 사람)부터. 끝나기 전이면 남은 사람들은 순서 없이 앞에 */
export function rankingOf(state: EngineState): number[] {
  return [...aliveIndexes(state), ...[...state.out].reverse()]
}
