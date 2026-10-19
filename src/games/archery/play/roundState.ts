// 한 경기(10발)의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
import { createRng } from '../../../shared/random'
import { type Distance, TOTAL_ARROWS } from '../constants'
import { viewHalfSize } from '../field/view'
import {
  type ArrowScore,
  type Point,
  distanceOfArrow,
  isFirstAtDistance,
  scoreImpact,
  totalOf,
} from '../rules/scoring'
import { computeImpact, drawProgress, flightMs, shouldAutoRelease, swayOffset } from './shot'
import { type Wind, randomWind } from './wind'

export type SoundName = 'draw' | 'release' | 'hit' | 'ten' | 'x' | 'miss' | 'end'

export type Shot = {
  index: number
  distance: Distance
  wind: Wind
  impact: Point
  score: ArrowScore
  /** 놓을 때 당긴 정도 */
  progress: number
}

export type Phase =
  /** 새 거리 안내 */
  | { kind: 'announce'; until: number }
  /** 누르기를 기다림 */
  | { kind: 'ready' }
  /** 당기며 조준 중 */
  | { kind: 'drawing'; startedAt: number }
  /** 화살이 날아가는 중 */
  | { kind: 'flying'; shot: Shot; startAt: number; until: number }
  /** 점수 보여주는 중 */
  | { kind: 'scored'; shot: Shot; until: number }
  | { kind: 'done' }

export type RoundState = {
  now: number
  seed: number
  /** 지금 쏠 화살 번호 (0부터) */
  arrowIndex: number
  wind: Wind
  /** 이번 화살의 흔들림 모양 */
  swayPhase: number
  /** 조준점 (흔들림 제외) */
  aim: Point
  shots: Shot[]
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type RoundAction =
  | { type: 'tick'; now: number }
  | { type: 'press'; at: number }
  | { type: 'aimBy'; dx: number; dy: number }
  | { type: 'release'; at: number }

export const ANNOUNCE_MS = 1400
export const SCORED_MS = 1300

const CENTER: Point = { x: 0, y: 0 }

export function currentDistance(state: RoundState): Distance {
  return distanceOfArrow(Math.min(state.arrowIndex, TOTAL_ARROWS - 1))
}

function withSounds(state: RoundState, ...names: SoundName[]): RoundState {
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-8), soundSeq: seq }
}

/** 화살마다 새 바람과 흔들림 모양 */
function prepareArrow(state: RoundState, index: number, now: number): RoundState {
  const rng = createRng(state.seed)
  const wind = randomWind(rng)
  const swayPhase = rng.next() * Math.PI * 2
  const phase: Phase = isFirstAtDistance(index) ? { kind: 'announce', until: now + ANNOUNCE_MS } : { kind: 'ready' }
  return { ...state, seed: rng.seed(), arrowIndex: index, wind, swayPhase, aim: CENTER, phase }
}

export function createRound(now: number, seed: number): RoundState {
  const base: RoundState = {
    now,
    seed,
    arrowIndex: 0,
    wind: { direction: 0, tier: 'light', speed: 0 },
    swayPhase: 0,
    aim: CENTER,
    shots: [],
    phase: { kind: 'ready' },
    sounds: [],
    soundSeq: 0,
  }
  return prepareArrow(base, 0, now)
}

/** 화면에 그릴 조준점 (당기는 중에는 흔들림 포함) */
export function reticleAt(state: RoundState, now = state.now): Point | null {
  const { phase } = state
  if (phase.kind === 'ready') return state.aim
  if (phase.kind !== 'drawing') return null
  const sway = swayOffset(now, now - phase.startedAt, currentDistance(state), state.swayPhase)
  return { x: state.aim.x + sway.x, y: state.aim.y + sway.y }
}

export function holdMsOf(state: RoundState, now = state.now): number {
  return state.phase.kind === 'drawing' ? Math.max(0, now - state.phase.startedAt) : 0
}

function fire(state: RoundState, at: number): RoundState {
  if (state.phase.kind !== 'drawing') return state
  const distance = currentDistance(state)
  const holdMs = Math.max(0, at - state.phase.startedAt)
  const progress = drawProgress(holdMs)
  const sway = swayOffset(at, holdMs, distance, state.swayPhase)
  const impact = computeImpact({ aim: state.aim, sway, wind: state.wind, distance, progress })
  const shot: Shot = { index: state.arrowIndex, distance, wind: state.wind, impact, score: scoreImpact(impact), progress }
  return withSounds(
    { ...state, phase: { kind: 'flying', shot, startAt: at, until: at + flightMs(distance) } },
    'release',
  )
}

function hitSound(score: ArrowScore): SoundName {
  if (score.x) return 'x'
  if (score.points === 10) return 'ten'
  if (score.points === 0) return 'miss'
  return 'hit'
}

function tick(state: RoundState): RoundState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'announce':
      return now >= phase.until ? { ...state, phase: { kind: 'ready' } } : state
    case 'drawing':
      return shouldAutoRelease(now - phase.startedAt) ? fire(state, now) : state
    case 'flying': {
      if (now < phase.until) return state
      return withSounds(
        { ...state, shots: [...state.shots, phase.shot], phase: { kind: 'scored', shot: phase.shot, until: now + SCORED_MS } },
        hitSound(phase.shot.score),
      )
    }
    case 'scored': {
      if (now < phase.until) return state
      const next = state.arrowIndex + 1
      if (next >= TOTAL_ARROWS) return withSounds({ ...state, arrowIndex: next, phase: { kind: 'done' } }, 'end')
      return prepareArrow(state, next, now)
    }
    case 'ready':
    case 'done':
      return state
  }
}

function aimBy(state: RoundState, dx: number, dy: number): RoundState {
  if (state.phase.kind !== 'drawing') return state
  // 조준은 보이는 화면 안에서만
  const limit = viewHalfSize(currentDistance(state))
  const clamp = (v: number) => Math.min(Math.max(v, -limit), limit)
  return { ...state, aim: { x: clamp(state.aim.x + dx), y: clamp(state.aim.y + dy) } }
}

export function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'press':
      if (state.phase.kind !== 'ready') return state
      return withSounds({ ...state, phase: { kind: 'drawing', startedAt: action.at } }, 'draw')
    case 'aimBy':
      return aimBy(state, action.dx, action.dy)
    case 'release':
      return fire(state, action.at)
  }
}

export type RoundSummary = {
  shots: Shot[]
  points: number
  xCount: number
}

export function summarizeRound(state: RoundState): RoundSummary {
  const { points, xCount } = totalOf(state.shots.map((s) => s.score))
  return { shots: state.shots, points, xCount }
}
