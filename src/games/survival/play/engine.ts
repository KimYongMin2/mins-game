// 서바이벌 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 라운드: 맵 줄어듦 안내 → 모두 몰래 위치·방향 고르기 → 공개(총알이 일자로, 처음 맞은 한 명 탈락) → 다음 라운드.
// 5라운드 뒤로는 가장 작은 맵 그대로 한 명 남을 때까지.
import { type Rng, createRng } from '../../../shared/random'
import { chooseBotPlan } from '../bot/survivalBot'
import { AFTER_SHOT_MS, BOT_PLAN_MS, COUNTDOWN_MS, DONE_MS, LASER_SPEED, PLAN_MS, SHOT_AT } from '../constants'
import { type Vec, clampToArena, halfOf, randomInArena, shoot } from '../rules/geometry'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'

export type Player = { id: string; name: string; kind: PlayerKind }

/** 고르는 중인 것. locked = [확정] 누름 (그 뒤로는 못 바꿈) */
export type Plan = { pos: Vec | null; angle: number | null; locked: boolean }

export type Shot = { from: number; pos: Vec; end: Vec; hit: number | null }

/** 라운드 공개 결과. voided = 남은 사람이 모두 맞아서 무효(아무도 탈락 안 함), ms = 공개 보여주는 시간 */
export type Reveal = { round: number; half: number; positions: (Vec | null)[]; shots: Shot[]; dead: number[]; voided: boolean; ms: number }

/** 레이저가 끝(맞은 곳·맵 끝)까지 가는 데 걸리는 시간 */
export const laserMs = (sh: Shot) => Math.hypot(sh.end.x - sh.pos.x, sh.end.y - sh.pos.y) / LASER_SPEED

/** 공개 시작부터 이 사람이 처음 맞는 시각 (안 맞으면 null) */
export function hitAtOf(r: Pick<Reveal, 'shots'>, player: number): number | null {
  const times = r.shots.filter((sh) => sh.hit === player).map((sh) => SHOT_AT + laserMs(sh))
  return times.length ? Math.min(...times) : null
}

/** 공개 시작부터 레이저가 모두 멈추는 시각 */
export const lasersDoneAt = (r: Pick<Reveal, 'shots'>) => SHOT_AT + Math.max(0, ...r.shots.map(laserMs))

export type Phase =
  | { kind: 'countdown'; until: number }
  | { kind: 'plan'; until: number }
  | { kind: 'reveal'; until: number }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  alive: boolean[]
  /** 라운드마다 탈락한 사람들 (같은 라운드면 같은 등수) */
  out: number[][]
  kills: number[]
  round: number
  plans: Partial<Record<number, Plan>>
  /** 봇이 정할 시각 */
  botAt: Partial<Record<number, number>>
  /** 지난 공개 결과 (봇이 노릴 때도 씀) */
  lastReveal: Reveal | null
  phase: Phase
}

export type EngineAction =
  | { type: 'tick'; now: number }
  | { type: 'plan'; player: number; plan: Plan }
  /** 친구가 나감: 그 자리에서 탈락 */
  | { type: 'drop'; player: number }

export const aliveIndexes = (s: { alive: boolean[] }) => s.alive.flatMap((a, i) => (a ? [i] : []))

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  return {
    now: opts.now,
    seed: opts.seed,
    players: opts.players,
    alive: opts.players.map(() => true),
    out: [],
    kills: opts.players.map(() => 0),
    round: 1,
    plans: {},
    botAt: {},
    lastReveal: null,
    phase: { kind: 'countdown', until: opts.now + COUNTDOWN_MS },
  }
}

const within = (rng: Rng, [min, max]: readonly [number, number]) => min + rng.next() * (max - min)

function startPlan(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const botAt: Partial<Record<number, number>> = {}
  for (const i of aliveIndexes(s)) if (s.players[i].kind === 'bot') botAt[i] = s.now + within(rng, BOT_PLAN_MS)
  return { ...s, seed: rng.seed(), plans: {}, botAt, phase: { kind: 'plan', until: s.now + PLAN_MS } }
}

function bots(s: EngineState): EngineState {
  let next = s
  for (const [key, at] of Object.entries(s.botAt)) {
    const i = Number(key)
    if (at === undefined || s.now < at) continue
    const rest = { ...next.botAt }
    delete rest[i]
    const rng = createRng(next.seed)
    const lastSeen = aliveIndexes(next)
      .filter((j) => j !== i)
      .map((j) => next.lastReveal?.positions[j] ?? null)
    const { pos, angle } = chooseBotPlan(rng, halfOf(next.round), lastSeen)
    next = { ...next, seed: rng.seed(), botAt: rest, plans: { ...next.plans, [i]: { pos, angle, locked: true } } }
  }
  return next
}

function plan(s: EngineState, player: number, p: Plan): EngineState {
  if (s.phase.kind !== 'plan' || !s.alive[player] || s.plans[player]?.locked) return s
  const half = halfOf(s.round)
  const pos = p.pos && clampToArena(p.pos, half)
  return { ...s, plans: { ...s.plans, [player]: { pos, angle: p.angle, locked: p.locked && pos !== null && p.angle !== null } } }
}

/** 공개: 안 고른 건 무작위로 채우고 모두 동시에 쏜다 */
function reveal(s: EngineState): EngineState {
  const rng = createRng(s.seed)
  const half = halfOf(s.round)
  const alive = aliveIndexes(s)
  const positions: (Vec | null)[] = s.players.map(() => null)
  const angles: number[] = s.players.map(() => 0)
  for (const i of alive) {
    const p = s.plans[i]
    positions[i] = p?.pos ?? randomInArena(rng, half)
    angles[i] = p?.angle ?? rng.next() * Math.PI * 2
  }
  const shots: Shot[] = alive.map((i) => {
    const targets = alive.filter((j) => j !== i).map((j) => ({ player: j, pos: positions[j]! }))
    const { hit, end } = shoot(positions[i]!, angles[i], targets, half)
    return { from: i, pos: positions[i]!, end, hit }
  })
  const hits = [...new Set(shots.flatMap((sh) => (sh.hit === null ? [] : [sh.hit])))].sort((a, b) => a - b)
  const voided = hits.length >= alive.length
  const ms = lasersDoneAt({ shots }) + AFTER_SHOT_MS
  return {
    ...s,
    seed: rng.seed(),
    botAt: {},
    lastReveal: { round: s.round, half, positions, shots, dead: voided ? [] : hits, voided, ms },
    phase: { kind: 'reveal', until: s.now + ms },
  }
}

function afterReveal(s: EngineState): EngineState {
  const r = s.lastReveal
  if (!r) return s
  const kills = r.voided ? s.kills : s.kills.map((k, i) => k + r.shots.filter((sh) => sh.from === i && sh.hit !== null).length)
  const next: EngineState = r.dead.length
    ? { ...s, kills, alive: s.alive.map((a, i) => a && !r.dead.includes(i)), out: [...s.out, r.dead] }
    : { ...s, kills }
  if (aliveIndexes(next).length <= 1) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  return { ...next, round: next.round + 1, plans: {}, phase: { kind: 'countdown', until: s.now + COUNTDOWN_MS } }
}

function drop(s: EngineState, player: number): EngineState {
  if (!s.alive[player] || s.phase.kind === 'done') return s
  const next: EngineState = { ...s, alive: s.alive.map((a, i) => a && i !== player), out: [...s.out, [player]] }
  if (aliveIndexes(next).length <= 1) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  return next
}

/** 살아 있는 사람이 모두 확정했는지 */
const allLocked = (s: EngineState) => aliveIndexes(s).every((i) => s.plans[i]?.locked)

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'countdown':
      return now >= phase.until ? startPlan(s) : s
    case 'plan': {
      const b = bots(s)
      return now >= phase.until || allLocked(b) ? reveal(b) : b
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
    case 'plan':
      return plan(state, action.player, action.plan)
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
