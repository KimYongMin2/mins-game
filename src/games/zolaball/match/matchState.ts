// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
//
// 친구 대전(opponent: 'remote'): 투수 쪽 기기가 구종을 정해 'remotePitch'로 보내고,
// 타자 쪽 기기가 스윙을 판정해 그 결과를 'remoteOutcome'으로 보낸다.
// 두 기기가 같은 결과를 같은 순서로 적용하므로 경기 상태가 똑같이 흘러간다.
import { type BotSwing, botDecideSwing } from '../bot/batterBot'
import { botChoosePitch } from '../bot/pitcherBot'
import { type BattedBall, battedBallEndAt, createBattedBall } from '../play/battedBall'
import { type Pitch, type PitchCall, type PitchHeight, type PitchType, createPitch, pitchEndAt } from '../play/pitch'
import {
  EMPTY_SELECTION,
  PITCH_CHOICE_MS,
  type PitchKey,
  type PitchSelection,
  completeSelection,
  isSelectionComplete,
} from '../play/pitchSelection'
import { createRng } from '../../../shared/random'
import {
  type GameState,
  type PitchOutcome,
  type PlayEvent,
  type Side,
  applyPitch,
  battingSide,
  createGame,
  fieldingSide,
  totalRuns,
} from '../rules/game'
import { type Difficulty, type SwingResult, judgeSwing } from '../rules/judge'
import { SWING_DURATION_MS } from '../constants'

/** 누가 조작하는지. remote = 방에 들어온 친구 */
export type Controller = 'user' | 'bot' | 'remote'

export type MatchConfig = {
  difficulty: Difficulty
  /** 사용자가 선공(away)인지 후공(home)인지 */
  userSide: Side
  /** 상대. 기본은 봇 */
  opponent?: 'bot' | 'remote'
}

/** 친구가 보낸 투구 (내 쪽이 아직 받을 준비가 안 됐으면 맡아 둔다) */
type RemotePitch = { n: number; call: PitchCall; windupMs: number }

/** swing: 휘두르는 소리 · foul/hit/crack: 맞은 정도별 타격음(파울 < 범타·안타 < 2루타·홈런) · fly: 홈런 타구 날아감 */
export type SoundName = 'pitch' | 'mitt' | 'swing' | 'foul' | 'hit' | 'crack' | 'fly' | 'cheer' | 'strikeout' | 'walk' | 'gameEnd'

export type Phase =
  /** 경기 시작·공수 교대 안내 */
  | { kind: 'announce'; until: number }
  /** 투수가 구종을 고르는 중 */
  | { kind: 'choosing'; startedAt: number; selection: PitchSelection; botPitchAt: number }
  /** 공이 날아가는 중 */
  | {
      kind: 'pitching'
      pitch: Pitch
      botSwing: BotSwing | null
      swing: { at: number; result: SwingResult } | null
      released: boolean
      caught: boolean
      /** 친구가 타자일 때 도착한 판정. 공이 홈에 닿으면 적용한다 */
      remoteOutcome: { outcome: PitchOutcome; contact: boolean } | null
    }
  /** 투구 결과 보여주는 중 */
  | {
      kind: 'result'
      until: number
      event: PlayEvent
      pitch: Pitch
      /** 사용자가 타자로 스윙했을 때의 시각 차이(ms) */
      userDiffMs: number | null
      /** 배트에 맞아 날아가는 공. 헛스윙·스윙 안 함이면 null */
      batted: BattedBall | null
      outcome: PitchOutcome
      /** 배트에 맞았는지 */
      contact: boolean
    }
  | { kind: 'final' }

export type MatchState = {
  config: MatchConfig
  game: GameState
  phase: Phase
  now: number
  seed: number
  /** 타자 스윙 애니메이션 시작 시각 */
  swingAt: number | null
  /** 최근 투구 구종 (봇 판단용, 최대 3개) */
  recentTypes: PitchType[]
  /** 지금까지 던진 공 수. 친구 대전 메시지 번호 */
  pitchCount: number
  /** 친구가 미리 던진 공 (내가 아직 결과를 보여주는 중일 때) */
  pendingPitch: RemotePitch | null
  /** 재생할 효과음. id가 커지는 순서로 쌓이고 최근 것만 남긴다. */
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  | { type: 'selectKey'; key: PitchKey }
  | { type: 'selectHeight'; height: PitchHeight }
  | { type: 'swing'; at: number }
  /** 친구(투수)가 던짐 */
  | { type: 'remotePitch'; n: number; call: PitchCall; windupMs: number }
  /** 친구(타자)의 판정 */
  | { type: 'remoteOutcome'; n: number; outcome: PitchOutcome; contact: boolean }

export const ANNOUNCE_MS = 1600
const BOT_THINK_MS = [700, 1500] as const
const BOT_WINDUP_MS = [300, 800] as const
const USER_WINDUP_MS = 250
const MITT_DELAY_MS = 40
const RESULT_MS = 1100
/** 타구가 떨어진 뒤 결과를 더 보여주는 시간 */
const AFTER_LANDING_MS = 700
const PLATE_RESULT_MS = 1600
const HOMERUN_MS = 2400
const FINAL_MS = 2200

export function controllerOf(config: MatchConfig, side: Side): Controller {
  return side === config.userSide ? 'user' : (config.opponent ?? 'bot')
}

function pitcherOf(state: MatchState): Controller {
  return controllerOf(state.config, fieldingSide(state.game.half))
}

function batterOf(state: MatchState): Controller {
  return controllerOf(state.config, battingSide(state.game.half))
}

export function isUserBatting(state: MatchState): boolean {
  return controllerOf(state.config, battingSide(state.game.half)) === 'user'
}

export function isUserPitching(state: MatchState): boolean {
  return controllerOf(state.config, fieldingSide(state.game.half)) === 'user'
}

export function createMatch(config: MatchConfig, now: number, seed: number): MatchState {
  return {
    config,
    game: createGame(),
    phase: { kind: 'announce', until: now + ANNOUNCE_MS },
    now,
    seed,
    swingAt: null,
    recentTypes: [],
    pitchCount: 0,
    pendingPitch: null,
    sounds: [],
    soundSeq: 0,
  }
}

function withSounds(state: MatchState, ...names: SoundName[]): MatchState {
  if (names.length === 0) return state
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-8), soundSeq: seq }
}

function between(random: number, [min, max]: readonly [number, number]) {
  return min + random * (max - min)
}

function startChoosing(state: MatchState, now: number): MatchState {
  const rng = createRng(state.seed)
  const botPitchAt = now + between(rng.next(), BOT_THINK_MS)
  const next: MatchState = {
    ...state,
    seed: rng.seed(),
    phase: { kind: 'choosing', startedAt: now, selection: EMPTY_SELECTION, botPitchAt },
  }
  // 친구가 이미 던진 공이 있으면 바로 날아온다
  const pending = state.pendingPitch
  if (pending && pending.n === state.pitchCount && pitcherOf(state) === 'remote') {
    return throwPitch(next, pending.call, pending.windupMs)
  }
  return next
}

function throwPitch(state: MatchState, call: PitchCall, windupMs?: number): MatchState {
  const rng = createRng(state.seed)
  const windup = windupMs ?? (isUserPitching(state) ? USER_WINDUP_MS : between(rng.next(), BOT_WINDUP_MS))
  const pitch = createPitch(call, state.now + windup)
  const { balls, strikes } = state.game
  const botSwing =
    batterOf(state) === 'bot'
      ? botDecideSwing(state.config.difficulty, call, { balls, strikes }, state.recentTypes, rng)
      : null
  return {
    ...state,
    seed: rng.seed(),
    recentTypes: [...state.recentTypes, call.type].slice(-3),
    pitchCount: state.pitchCount + 1,
    pendingPitch: null,
    phase: { kind: 'pitching', pitch, botSwing, swing: null, released: false, caught: false, remoteOutcome: null },
  }
}

function outcomeOf(pitch: Pitch, swing: { result: SwingResult } | null): PitchOutcome {
  if (!swing) return pitch.isBall ? 'ball' : 'calledStrike'
  return swing.result === 'miss' ? 'swingingStrike' : swing.result
}

function resultDuration(event: PlayEvent): number {
  if (event.gameEnded) return FINAL_MS
  if (event.plateResult === 'homerun') return HOMERUN_MS
  if (event.plateResult) return PLATE_RESULT_MS
  return RESULT_MS
}

/** forced: 친구(타자)가 보낸 판정 */
function resolvePitch(state: MatchState, contactAt: number | null, forced?: PitchOutcome): MatchState {
  if (state.phase.kind !== 'pitching') return state
  const { pitch, swing } = state.phase
  const outcome = forced ?? outcomeOf(pitch, swing)
  const { game, event } = applyPitch(state.game, outcome)
  const userDiffMs = swing && isUserBatting(state) ? swing.at - pitch.arriveAt : null

  const rng = createRng(state.seed)
  const batted =
    contactAt !== null && (outcome === 'foul' || outcome === 'out' || outcome === 'single' || outcome === 'double' || outcome === 'homerun')
      ? createBattedBall(outcome, { x: 0, y: pitch.plateHeight }, contactAt, rng)
      : null
  const until = Math.max(
    state.now + resultDuration(event),
    batted ? battedBallEndAt(batted) + AFTER_LANDING_MS : 0,
  )

  const sounds: SoundName[] = []
  // 친구 타자는 휘두른 순간을 모르니 판정과 함께 휘두르는 소리
  if (forced && outcome !== 'ball' && outcome !== 'calledStrike') sounds.push('swing')
  if (contactAt !== null) sounds.push(outcome === 'foul' ? 'foul' : outcome === 'homerun' || outcome === 'double' ? 'crack' : 'hit')
  else if (forced) sounds.push('mitt')
  if (event.plateResult === 'homerun') sounds.push('fly', 'cheer')
  if (event.plateResult === 'strikeout') sounds.push('strikeout')
  if (event.plateResult === 'walk') sounds.push('walk')
  if (event.gameEnded) sounds.push('gameEnd')

  return withSounds(
    {
      ...state,
      game,
      seed: rng.seed(),
      // 친구 타자가 휘둘렀으면 휘두르는 모습도 보여준다
      swingAt: forced && outcome !== 'ball' && outcome !== 'calledStrike' ? pitch.arriveAt - 60 : state.swingAt,
      phase: { kind: 'result', until, event, pitch, userDiffMs, batted, outcome, contact: contactAt !== null },
    },
    ...sounds,
  )
}

function tick(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'announce':
      return now >= phase.until ? startChoosing(state, now) : state

    case 'choosing': {
      // 친구가 투수면 친구가 던질 때까지 기다린다
      if (pitcherOf(state) === 'remote') return state
      if (isUserPitching(state)) {
        if (now < phase.startedAt + PITCH_CHOICE_MS) return state
        // 시간 초과: 고르지 않은 항목은 무작위
        const rng = createRng(state.seed)
        const call = completeSelection(phase.selection, rng)
        return throwPitch({ ...state, seed: rng.seed() }, call)
      }
      if (now < phase.botPitchAt) return state
      const rng = createRng(state.seed)
      const { balls, strikes } = state.game
      const call = botChoosePitch(state.config.difficulty, { balls, strikes }, state.recentTypes, rng)
      return throwPitch({ ...state, seed: rng.seed() }, call)
    }

    case 'pitching': {
      const { pitch, botSwing } = phase
      let next: MatchState = state
      let p = phase

      if (!p.released && now >= pitch.releaseAt) {
        p = { ...p, released: true }
        next = withSounds({ ...next, phase: p }, 'pitch')
      }

      // 친구가 타자: 친구 기기의 판정이 오면 공이 홈에 닿는 순간 적용한다
      if (batterOf(state) === 'remote') {
        const r = p.remoteOutcome
        if (!r || now < pitch.arriveAt) return next
        return resolvePitch(next, r.contact ? pitch.arriveAt : null, r.outcome)
      }

      // 봇 타자의 스윙
      if (botSwing?.swing && !p.swing && now >= pitch.arriveAt + botSwing.diffMs) {
        const at = pitch.arriveAt + botSwing.diffMs
        const result = judgeSwing({ diffMs: botSwing.diffMs, difficulty: 'normal', pitchIsBall: pitch.isBall })
        p = { ...p, swing: { at, result } }
        next = withSounds({ ...next, phase: p, swingAt: at }, 'swing')
      }

      const contact = p.swing !== null && p.swing.result !== 'miss'
      if (contact && now >= pitch.arriveAt) return resolvePitch(next, pitch.arriveAt)

      if (!contact && !p.caught && now >= pitch.arriveAt + MITT_DELAY_MS) {
        p = { ...p, caught: true }
        next = withSounds({ ...next, phase: p }, 'mitt')
      }
      if (!contact && now >= pitchEndAt(pitch)) return resolvePitch(next, null)
      return next
    }

    case 'result': {
      if (now < phase.until) return state
      if (state.game.final) return { ...state, phase: { kind: 'final' } }
      if (phase.event.halfEnded) return { ...state, phase: { kind: 'announce', until: now + ANNOUNCE_MS } }
      return startChoosing(state, now)
    }

    case 'final':
      return state
  }
}

function select(state: MatchState, change: Partial<PitchSelection>): MatchState {
  const { phase } = state
  if (phase.kind !== 'choosing' || !isUserPitching(state)) return state
  const selection = { ...phase.selection, ...change }
  if (!isSelectionComplete(selection)) return { ...state, phase: { ...phase, selection } }
  const rng = createRng(state.seed)
  return throwPitch({ ...state, seed: rng.seed() }, completeSelection(selection, rng))
}

function remotePitch(state: MatchState, pitch: RemotePitch): MatchState {
  if (pitcherOf(state) !== 'remote' || pitch.n !== state.pitchCount) return state
  if (state.phase.kind === 'choosing') return throwPitch(state, pitch.call, pitch.windupMs)
  return { ...state, pendingPitch: pitch }
}

function remoteOutcome(state: MatchState, n: number, outcome: PitchOutcome, contact: boolean): MatchState {
  const { phase } = state
  if (phase.kind !== 'pitching' || batterOf(state) !== 'remote' || n !== state.pitchCount - 1) return state
  return { ...state, phase: { ...phase, remoteOutcome: { outcome, contact } } }
}

function swing(state: MatchState, at: number): MatchState {
  // 스윙 동작 중에는 다시 휘두를 수 없다.
  if (!isUserBatting(state) || state.phase.kind === 'final') return state
  if (state.swingAt !== null && at < state.swingAt + SWING_DURATION_MS) return state

  const next = withSounds({ ...state, swingAt: at }, 'swing')
  const { phase } = state
  if (phase.kind !== 'pitching' || phase.swing || at < phase.pitch.releaseAt) return next

  const result = judgeSwing({
    diffMs: at - phase.pitch.arriveAt,
    difficulty: state.config.difficulty,
    pitchIsBall: phase.pitch.isBall,
  })
  return { ...next, phase: { ...phase, swing: { at, result } } }
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'selectKey':
      return select(state, { key: action.key })
    case 'selectHeight':
      return select(state, { height: action.height })
    case 'swing':
      return swing(state, action.at)
    case 'remotePitch':
      return remotePitch(state, { n: action.n, call: action.call, windupMs: action.windupMs })
    case 'remoteOutcome':
      return remoteOutcome(state, action.n, action.outcome, action.contact)
  }
}

export type MatchSummary = {
  config: MatchConfig
  /** 봇 대전 / 친구 대전 (기록을 따로 센다) */
  mode: 'bot' | 'pvp'
  outcome: 'win' | 'lose' | 'draw'
  userRuns: number
  botRuns: number
  linescore: GameState['linescore']
  userStats: GameState['stats'][Side]
  userPitching: GameState['pitching'][Side]
}

export function summarize(state: MatchState): MatchSummary {
  const { userSide } = state.config
  const botSide: Side = userSide === 'away' ? 'home' : 'away'
  const userRuns = totalRuns(state.game, userSide)
  const botRuns = totalRuns(state.game, botSide)
  return {
    config: state.config,
    mode: state.config.opponent === 'remote' ? 'pvp' : 'bot',
    outcome: userRuns > botRuns ? 'win' : userRuns < botRuns ? 'lose' : 'draw',
    userRuns,
    botRuns,
    linescore: state.game.linescore,
    userStats: state.game.stats[userSide],
    userPitching: state.game.pitching[userSide],
  }
}
