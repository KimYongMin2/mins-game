// 탱크 대전 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 차례: 조준(움직이고 각도·힘 정하기, TURN_MS) → 발사(포탄이 날아감) → 터짐(땅 파임·피해) → 다음 사람. 한 명 남으면 끝.
import { type Rng, createRng } from '../../../shared/random'
import { type BotLevel, chooseBotAim } from '../bot/artilleryBot'
import {
  ANGLE_MAX,
  ANGLE_MIN,
  BOOM_MS,
  BOT_THINK_MS,
  COUNTDOWN_MS,
  DONE_MS,
  HP,
  MOVE_MAX,
  POWER_MAX,
  POWER_MIN,
  STEP,
  TURN_MS,
  WIND_MAX,
  WORLD_W,
} from '../constants'
import { type Shot, type Terrain, type Vec, explode, makeTerrain, simulateShot } from '../rules/physics'
import { type Team, lastTeam, sameTeam } from '../../../shared/team/teams'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'
export type Player = { id: string; name: string; kind: PlayerKind }

export type Tank = { x: number; hp: number; alive: boolean; angle: number; power: number }

/** 터진 결과 (화면 연출용) */
export type Boom = { at: Vec | null; damage: number[]; dead: number[]; fell: number[] }

export type Phase =
  | { kind: 'countdown'; until: number }
  /** startX: 이번 차례 처음 자리 (여기서 MOVE_MAX까지만 움직임) */
  | { kind: 'aim'; until: number; startX: number }
  | { kind: 'flight'; until: number; shot: Shot }
  | { kind: 'boom'; until: number; boom: Boom }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  level: BotLevel
  players: Player[]
  /** 팀전이면 사람마다 팀 (같은 팀은 포탄에 안 다침). 개인전이면 null */
  teams: Team[] | null
  tanks: Tank[]
  terrain: Terrain
  /** 지금 차례인 사람 */
  turn: number
  /** 몇 번째 차례인지 (친구 메시지가 옛 차례 것인지 가릴 때) */
  turnNo: number
  wind: number
  /** 차례마다 탈락한 사람들 (같은 발에 탈락하면 같은 등수) */
  out: number[][]
  kills: number[]
  /** 봇이 쏠 시각 */
  botAt: number | null
  phase: Phase
}

export type EngineAction =
  | { type: 'tick'; now: number }
  /** 조준 중: 자리·각도·힘 (차례인 사람만) */
  | { type: 'aim'; player: number; x: number; angle: number; power: number }
  | { type: 'fire'; player: number; x: number; angle: number; power: number }
  /** 친구가 나감: 그 자리에서 탈락 */
  | { type: 'drop'; player: number }

export const aliveIndexes = (s: { tanks: { alive: boolean }[] }) => s.tanks.flatMap((t, i) => (t.alive ? [i] : []))

const within = (rng: Rng, [min, max]: readonly [number, number]) => min + rng.next() * (max - min)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/** 대포 자리: 맵을 사람 수만큼 나눠 칸마다 한 명 (조금씩 흔들고, 누가 어디일지는 섞는다) */
function startSpots(rng: Rng, n: number): number[] {
  const seg = (WORLD_W - 30) / n
  const spots = Array.from({ length: n }, (_, i) => round1(15 + seg * (i + 0.5) + (rng.next() - 0.5) * seg * 0.4))
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[spots[i], spots[j]] = [spots[j], spots[i]]
  }
  return spots
}

export function createEngine(opts: { now: number; seed: number; players: Player[]; teams?: Team[] | null; level?: BotLevel }): EngineState {
  const rng = createRng(opts.seed)
  const terrain = makeTerrain(rng)
  const spots = startSpots(rng, opts.players.length)
  const tanks = spots.map((x) => ({ x, hp: HP, alive: true, angle: x < WORLD_W / 2 ? 45 : 135, power: 60 }))
  const turn = Math.floor(rng.next() * opts.players.length)
  return {
    now: opts.now,
    seed: rng.seed(),
    level: opts.level ?? 'normal',
    players: opts.players,
    teams: opts.teams ?? null,
    tanks,
    terrain,
    turn,
    turnNo: 0,
    wind: 0,
    out: [],
    kills: opts.players.map(() => 0),
    botAt: null,
    phase: { kind: 'countdown', until: opts.now + COUNTDOWN_MS },
  }
}

/** 끝났는지: 한 명 남음, 팀전이면 한 팀만 남음 */
function isOver(s: EngineState): boolean {
  return aliveIndexes(s).length <= 1 || (!!s.teams && lastTeam(s.tanks.map((t) => t.alive), s.teams) !== null)
}

/** 이긴 팀 (팀전이고 끝났을 때) */
export function winnerTeam(s: EngineState): Team | null {
  return s.teams ? lastTeam(s.tanks.map((t) => t.alive), s.teams) : null
}

/** 차례 시작: 바람을 새로 정하고, 봇이면 쏠 시각을 정한다 */
function startTurn(s: EngineState, turn: number): EngineState {
  const rng = createRng(s.seed)
  const wind = round1((rng.next() * 2 - 1) * WIND_MAX)
  const botAt = s.players[turn].kind === 'bot' ? s.now + within(rng, BOT_THINK_MS) : null
  return { ...s, seed: rng.seed(), turn, turnNo: s.turnNo + 1, wind, botAt, phase: { kind: 'aim', until: s.now + TURN_MS, startX: s.tanks[turn].x } }
}

function nextAlive(s: EngineState, from: number): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (from + k) % s.players.length
    if (s.tanks[i].alive) return i
  }
  return from
}

/** 조준 값 정리: 움직일 수 있는 범위·각도·힘 안으로 */
function setAim(s: EngineState, player: number, x: number, angle: number, power: number): EngineState {
  if (s.phase.kind !== 'aim' || player !== s.turn || !s.tanks[player].alive) return s
  const { startX } = s.phase
  const tank: Tank = {
    ...s.tanks[player],
    x: round1(clamp(x, Math.max(3, startX - MOVE_MAX), Math.min(WORLD_W - 3, startX + MOVE_MAX))),
    angle: round1(clamp(angle, ANGLE_MIN, ANGLE_MAX)),
    power: round1(clamp(power, POWER_MIN, POWER_MAX)),
  }
  return { ...s, tanks: s.tanks.map((t, i) => (i === player ? tank : t)) }
}

/** 발사: 궤적을 미리 다 계산해 두고, 날아가는 시간만큼 보여준다 */
function launch(s: EngineState): EngineState {
  const t = s.tanks[s.turn]
  const shot = simulateShot(s.terrain, s.tanks, s.turn, t.angle, t.power, s.wind)
  const ms = Math.max(300, shot.steps * STEP * 1000)
  return { ...s, botAt: null, phase: { kind: 'flight', until: s.now + ms, shot } }
}

/** 터짐: 피해·땅 파임·떨어짐을 반영하고 탈락자를 정한다 */
function land(s: EngineState, shot: Shot): EngineState {
  if (!shot.impact) return { ...s, phase: { kind: 'boom', until: s.now + BOOM_MS, boom: { at: null, damage: s.tanks.map(() => 0), dead: [], fell: [] } } }
  const blast = explode(s.terrain, s.tanks, shot.impact)
  // 팀전: 쏜 사람과 같은 팀은 안 다친다 (나는 다침)
  if (s.teams) blast.damage = blast.damage.map((d, i) => (sameTeam(s.teams, s.turn, i) ? 0 : d))
  const tanks = s.tanks.map((t, i) => {
    if (!t.alive) return t
    const hp = Math.max(0, t.hp - blast.damage[i])
    return { ...t, hp: blast.fell.includes(i) ? 0 : hp, alive: hp > 0 && !blast.fell.includes(i) }
  })
  const dead = tanks.flatMap((t, i) => (s.tanks[i].alive && !t.alive ? [i] : []))
  const kills = s.kills.map((k, i) => (i === s.turn ? k + dead.filter((d) => d !== s.turn && !sameTeam(s.teams, s.turn, d)).length : k))
  return {
    ...s,
    terrain: blast.terrain,
    tanks,
    kills,
    out: dead.length ? [...s.out, dead] : s.out,
    phase: { kind: 'boom', until: s.now + BOOM_MS, boom: { at: shot.impact, damage: blast.damage, dead, fell: blast.fell } },
  }
}

function afterBoom(s: EngineState): EngineState {
  if (isOver(s)) return { ...s, phase: { kind: 'done', until: s.now + DONE_MS } }
  return startTurn(s, nextAlive(s, s.turn))
}

function drop(s: EngineState, player: number): EngineState {
  if (!s.tanks[player].alive || s.phase.kind === 'done') return s
  const next: EngineState = { ...s, tanks: s.tanks.map((t, i) => (i === player ? { ...t, hp: 0, alive: false } : t)), out: [...s.out, [player]] }
  if (isOver(next)) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  // 그 사람 차례였으면 바로 다음 사람
  if (s.phase.kind === 'aim' && s.turn === player) return startTurn(next, nextAlive(next, player))
  return next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'countdown':
      return now >= phase.until ? startTurn(s, s.turn) : s
    case 'aim': {
      if (s.botAt !== null && now >= s.botAt) {
        const rng = createRng(s.seed)
        const aim = chooseBotAim(rng, s.terrain, s.tanks, s.turn, s.wind, s.level, s.teams)
        const t = s.tanks[s.turn]
        return launch(setAim({ ...s, seed: rng.seed() }, s.turn, t.x, aim.angle, aim.power))
      }
      // 시간이 끝나면 지금 겨눈 대로 쏜다
      return now >= phase.until ? launch(s) : s
    }
    case 'flight':
      return now >= phase.until ? land(s, phase.shot) : s
    case 'boom':
      return now >= phase.until ? afterBoom(s) : s
    case 'done':
      return s
  }
}

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'aim':
      return setAim(state, action.player, action.x, action.angle, action.power)
    case 'fire':
      if (state.phase.kind !== 'aim' || action.player !== state.turn || !state.tanks[action.player].alive) return state
      return launch(setAim(state, action.player, action.x, action.angle, action.power))
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
