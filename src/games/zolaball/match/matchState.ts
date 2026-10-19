// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
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
import { createRng } from '../play/random'
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

/** 누가 조작하는지. PvP를 붙일 때 'remote'를 추가한다. */
export type Controller = 'user' | 'bot'

export type MatchConfig = {
  difficulty: Difficulty
  /** 사용자가 선공(away)인지 후공(home)인지 */
  userSide: Side
}

export type SoundName = 'pitch' | 'mitt' | 'hit' | 'cheer' | 'strikeout' | 'walk' | 'gameEnd'

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
  /** 재생할 효과음. id가 커지는 순서로 쌓이고 최근 것만 남긴다. */
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  | { type: 'selectKey'; key: PitchKey }
  | { type: 'selectHeight'; height: PitchHeight }
  | { type: 'swing'; at: number }

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
  return side === config.userSide ? 'user' : 'bot'
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
  return {
    ...state,
    seed: rng.seed(),
    phase: { kind: 'choosing', startedAt: now, selection: EMPTY_SELECTION, botPitchAt },
  }
}

function throwPitch(state: MatchState, call: PitchCall): MatchState {
  const rng = createRng(state.seed)
  const windup = isUserPitching(state) ? USER_WINDUP_MS : between(rng.next(), BOT_WINDUP_MS)
  const pitch = createPitch(call, state.now + windup)
  const { balls, strikes } = state.game
  const botSwing = isUserBatting(state)
    ? null
    : botDecideSwing(state.config.difficulty, call, { balls, strikes }, state.recentTypes, rng)
  return {
    ...state,
    seed: rng.seed(),
    recentTypes: [...state.recentTypes, call.type].slice(-3),
    phase: { kind: 'pitching', pitch, botSwing, swing: null, released: false, caught: false },
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

function resolvePitch(state: MatchState, contactAt: number | null): MatchState {
  if (state.phase.kind !== 'pitching') return state
  const { pitch, swing } = state.phase
  const outcome = outcomeOf(pitch, swing)
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
  if (contactAt !== null) sounds.push('hit')
  if (event.plateResult === 'homerun') sounds.push('cheer')
  if (event.plateResult === 'strikeout') sounds.push('strikeout')
  if (event.plateResult === 'walk') sounds.push('walk')
  if (event.gameEnded) sounds.push('gameEnd')

  return withSounds(
    {
      ...state,
      game,
      seed: rng.seed(),
      phase: { kind: 'result', until, event, pitch, userDiffMs, batted },
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

      // 봇 타자의 스윙
      if (botSwing?.swing && !p.swing && now >= pitch.arriveAt + botSwing.diffMs) {
        const at = pitch.arriveAt + botSwing.diffMs
        const result = judgeSwing({ diffMs: botSwing.diffMs, difficulty: 'normal', pitchIsBall: pitch.isBall })
        p = { ...p, swing: { at, result } }
        next = { ...next, phase: p, swingAt: at }
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

function swing(state: MatchState, at: number): MatchState {
  // 스윙 동작 중에는 다시 휘두를 수 없다.
  if (!isUserBatting(state) || state.phase.kind === 'final') return state
  if (state.swingAt !== null && at < state.swingAt + SWING_DURATION_MS) return state

  const next = { ...state, swingAt: at }
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
  }
}

export type MatchSummary = {
  config: MatchConfig
  outcome: 'win' | 'lose' | 'draw'
  userRuns: number
  botRuns: number
  linescore: GameState['linescore']
  userStats: GameState['stats'][Side]
}

export function summarize(state: MatchState): MatchSummary {
  const { userSide } = state.config
  const botSide: Side = userSide === 'away' ? 'home' : 'away'
  const userRuns = totalRuns(state.game, userSide)
  const botRuns = totalRuns(state.game, botSide)
  return {
    config: state.config,
    outcome: userRuns > botRuns ? 'win' : userRuns < botRuns ? 'lose' : 'draw',
    userRuns,
    botRuns,
    linescore: state.game.linescore,
    userStats: state.game.stats[userSide],
  }
}
