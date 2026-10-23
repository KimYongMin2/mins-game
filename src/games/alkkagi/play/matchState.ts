// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 흐름: 카드 고르기(흑·백, 10초) → 카드 공개 → 흑부터 번갈아 튕기기(한 번 20초) → 굴러가는 걸 보여줌 → … → 끝
//
// 모드
// - bot: 나 vs 봇. 카드는 내가 고르고 봇은 남은 카드
// - pvp: 나 vs 친구. 방장이 누가 카드를 고를지와 어느 카드가 흑인지 정해 보낸다.
//   튕긴 쪽 기기가 계산한 결과(돌이 멈춘 자리)를 같이 보내고, 받은 쪽은 그 결과를 그대로 쓴다
//   (물리 계산은 기기마다 아주 조금 다를 수 있어서. 굴러가는 그림만 받은 쪽이 다시 계산한다)
// 내 돌(0)은 늘 판 아래쪽, 상대(1)는 위쪽. 친구 기기와는 판을 180도 돌려서 주고받는다.
import { type Rng, createRng } from '../../../shared/random'
import { type Shot, chooseShot, weakShot } from '../bot/shotBot'
import { BOT_THINK_MS, DONE_MS, type Difficulty, PICK_MS, REVEAL_MS, SETTLE_MS, TURN_MS } from '../constants'
import { FRAME_MS, type ShotResult, type Side, type Stone, initialStones, remaining, simulate } from '../rules/physics'
import { type TurnOutcome, judgeShot } from '../rules/turn'

export type { Side }
export type Mode = 'bot' | 'pvp'
/** 카드 두 장 중 몇 번째 */
export type Card = 0 | 1

export type SoundName = 'flip' | 'shoot' | 'hit' | 'fall' | 'win' | 'lose' | 'draw'

export type Phase =
  /** picker가 카드를 고르는 중. 시간이 넘으면 무작위 */
  | { kind: 'pick'; until: number }
  /** 고른 카드를 뒤집어 보여주는 중 */
  | { kind: 'reveal'; until: number }
  /** turn인 쪽이 조준하는 중. botAt에 봇이 튕긴다 */
  | { kind: 'aiming'; until: number; botAt: number }
  /** 돌이 굴러가는 중. emitted = 소리 낸 물리 이벤트 수 */
  | { kind: 'rolling'; start: number; shooter: Side; result: ShotResult; outcome: TurnOutcome; emitted: number }
  | { kind: 'done'; winner: Side | 'draw'; until: number }

/** 마지막으로 튕긴 것 (친구에게 보낼 때 씀) */
export type LastShot = Shot & { n: number; shooter: Side; final: Stone[] }

export type MatchState = {
  now: number
  seed: number
  mode: Mode
  difficulty: Difficulty
  /** 카드를 고르는 쪽 (나 = 0) */
  picker: Side
  /** 흑 카드가 몇 번째 카드인지 */
  blackCard: Card
  picked: Card | null
  /** 흑인 쪽. 카드를 고르기 전엔 null */
  black: Side | null
  /** 지금 판 (굴러가는 중엔 튕기기 전 자리) */
  stones: Stone[]
  /** 지금까지 튕긴 횟수 */
  shots: number
  lastShot: LastShot | null
  turn: Side
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  | { type: 'pick'; card: Card }
  /** 내가 튕김 */
  | { type: 'shoot'; index: number; vx: number; vy: number }
  | { type: 'remotePick'; card: Card }
  /** 친구가 n번째로 튕긴 것과 그 결과 (이미 내 시점으로 돌려 둔 것) */
  | { type: 'remoteShot'; n: number; index: number; vx: number; vy: number; final: Stone[] }

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
  return {
    now: opts.now,
    seed: rng.seed(),
    mode: opts.mode,
    difficulty: opts.difficulty,
    picker: opts.picker ?? 0,
    blackCard: opts.blackCard ?? (rng.next() < 0.5 ? 0 : 1),
    picked: null,
    black: null,
    stones: initialStones(),
    shots: 0,
    lastShot: null,
    turn: 0,
    phase: { kind: 'pick', until: opts.now + PICK_MS },
    sounds: [],
    soundSeq: 0,
  }
}

function pick(state: MatchState, card: Card): MatchState {
  if (state.phase.kind !== 'pick') return state
  const black: Side = card === state.blackCard ? state.picker : ((1 - state.picker) as Side)
  return withSounds({ ...state, picked: card, black, turn: black, phase: { kind: 'reveal', until: state.now + REVEAL_MS } }, 'flip')
}

function aiming(state: MatchState, rng: Rng): MatchState {
  const botAt = state.now + BOT_THINK_MS.min + rng.next() * (BOT_THINK_MS.max - BOT_THINK_MS.min)
  return { ...state, seed: rng.seed(), phase: { kind: 'aiming', until: state.now + TURN_MS, botAt } }
}

/** side가 튕긴다. final을 주면(친구 기기 결과) 그걸 결과로 쓴다 */
function shoot(state: MatchState, side: Side, shot: Shot, final?: Stone[]): MatchState {
  if (state.phase.kind !== 'aiming' || state.turn !== side) return state
  const stone = state.stones[shot.index]
  if (!stone || stone.side !== side || !stone.on) return state
  const sim = simulate(state.stones, shot.index, shot.vx, shot.vy)
  const result = final ? { ...sim, final } : sim
  const outcome = judgeShot(result.final, side)
  const lastShot: LastShot = { ...shot, n: state.shots, shooter: side, final: result.final }
  return withSounds(
    { ...state, shots: state.shots + 1, lastShot, phase: { kind: 'rolling', start: state.now, shooter: side, result, outcome, emitted: 0 } },
    'shoot',
  )
}

/** 다 굴러간 뒤: 판을 결과로 바꾸고 다음 차례 / 끝 */
function settle(state: MatchState): MatchState {
  const { phase } = state
  if (phase.kind === 'reveal') return aiming(state, createRng(state.seed))
  if (phase.kind !== 'rolling') return state
  const next = { ...state, stones: phase.result.final }
  const { outcome } = phase
  if (outcome.kind === 'over') {
    const sound: SoundName = outcome.winner === 'draw' ? 'draw' : outcome.winner === 0 ? 'win' : 'lose'
    return withSounds({ ...next, phase: { kind: 'done', winner: outcome.winner, until: state.now + DONE_MS } }, sound)
  }
  return aiming({ ...next, turn: (1 - phase.shooter) as Side }, createRng(state.seed))
}

/** 굴러가는 시간 (마지막 프레임 + 잠깐) */
export const rollingMs = (result: ShotResult) => (result.frames.length - 1) * FRAME_MS + SETTLE_MS

function tick(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'pick': {
      if (now < phase.until || state.picker !== 0) return state
      const rng = createRng(state.seed)
      return pick({ ...state, seed: rng.seed() }, rng.next() < 0.5 ? 0 : 1)
    }
    case 'reveal':
      return now >= phase.until ? settle(state) : state
    case 'aiming': {
      const rng = createRng(state.seed)
      if (state.turn === 1 && state.mode === 'bot' && now >= phase.botAt) {
        return shoot({ ...state, seed: rng.seed() }, 1, chooseShot(rng, state.stones, 1, state.difficulty))
      }
      // 시간 초과는 차례인 사람 기기만 처리한다
      if (state.turn === 0 && now >= phase.until) return shoot({ ...state, seed: rng.seed() }, 0, weakShot(rng, state.stones, 0))
      return state
    }
    case 'rolling': {
      // 부딪힘·떨어짐 소리를 시간에 맞춰
      const elapsed = (now - phase.start) / 1000
      let emitted = phase.emitted
      const names: SoundName[] = []
      while (emitted < phase.result.events.length && phase.result.events[emitted].t <= elapsed) {
        const ev = phase.result.events[emitted++]
        if (ev.kind === 'fall' || ev.strength > 0.6) names.push(ev.kind)
      }
      const next = emitted === phase.emitted ? state : withSounds({ ...state, phase: { ...phase, emitted } }, ...names.slice(0, 3))
      return now >= phase.start + rollingMs(phase.result) ? settle(next) : next
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
    case 'shoot':
      return shoot(state, 0, action)
    case 'remotePick':
      return state.mode === 'pvp' && state.picker === 1 ? pick(state, action.card) : state
    case 'remoteShot': {
      if (state.mode !== 'pvp' || action.n !== state.shots) return state
      // 카드 공개나 앞 수 굴러가는 게 아직 안 끝났으면(통신 지연) 바로 끝내고 받는다
      const s = settle(state)
      return shoot(s, 1, action, action.final)
    }
  }
}

export type MatchSummary = {
  mode: Mode
  difficulty: Difficulty
  outcome: 'win' | 'lose' | 'draw'
  /** 내 돌 색 */
  stone: 'black' | 'white'
  /** 끝났을 때 남은 내 돌 */
  left: number
  /** 둘이 튕긴 횟수 합 */
  shots: number
}

export function summarizeMatch(state: MatchState): MatchSummary {
  if (state.phase.kind !== 'done') throw new Error('경기가 아직 안 끝났어요')
  const { winner } = state.phase
  return {
    mode: state.mode,
    difficulty: state.difficulty,
    outcome: winner === 'draw' ? 'draw' : winner === 0 ? 'win' : 'lose',
    stone: state.black === 0 ? 'black' : 'white',
    left: remaining(state.stones, 0),
    shots: state.shots,
  }
}
