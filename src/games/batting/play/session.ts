// 한 경기(10구)의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
import { createRng } from '../../../shared/random'
import { type Difficulty, type Hand, TOTAL_PITCHES } from '../constants'
import { type Contact, type Outcome, type ZonePoint, judgeSwing, timingWindows } from '../rules/judge'
import { type Totals, totalOf } from '../rules/scoring'
import { type BattedBall, battedBallEndAt, createBattedBall } from './battedBall'
import { type Pitch, ballPosition, createPitch, pitchEndAt } from './pitch'

export type SoundName = 'pitch' | 'mitt' | 'hit' | 'weak' | 'whiff' | 'homerun' | 'end'

/** 공 하나의 기록 */
export type PitchRecord = {
  index: number
  pitch: Pitch
  /** 터치한 곳. 안 쳤으면 null */
  touched: ZonePoint | null
  outcome: Outcome
  contact: Contact | null
  /** 터치 시각 − 도착 시각. 안 쳤으면 null */
  offsetMs: number | null
  /** 비거리(m) = 점수. 앞으로 안 갔으면 null */
  distance: number | null
}

export type Swing = { point: ZonePoint; at: number }

export type Phase =
  /** 다음 공 기다리는 중 */
  | { kind: 'ready'; until: number }
  /** 투수 와인드업. until에 공을 놓는다 */
  | { kind: 'windup'; pitch: Pitch; until: number }
  /** 공이 날아오는 중. 헛스윙이면 swing이 있고 공은 미트까지 간다 */
  | { kind: 'pitching'; pitch: Pitch; swing: Swing | null; record: PitchRecord | null }
  /** 결과 보여주는 중 */
  | { kind: 'result'; pitch: Pitch; swing: Swing | null; record: PitchRecord; batted: BattedBall | null; until: number }
  | { kind: 'done'; until: number }

export type SessionState = {
  now: number
  seed: number
  difficulty: Difficulty
  hand: Hand
  /** 지금 던질(던지는) 공 번호 (0부터) */
  index: number
  records: PitchRecord[]
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type SessionAction = { type: 'tick'; now: number } | { type: 'swing'; point: ZonePoint; at: number }

export const FIRST_READY_MS = 1200
/** 공과 공 사이 쉬는 시간 */
export const READY_MS = 1500
export const WINDUP_MS = 900
/** 결과를 보여주는 최소 시간 */
export const RESULT_MS = 1800
/** 마지막 공 뒤 '경기 끝'을 보여주고 결과 화면으로 넘어가기까지 */
export const DONE_MS = 1800

function withSounds(state: SessionState, ...names: SoundName[]): SessionState {
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-8), soundSeq: seq }
}

export function createSession(opts: { now: number; seed: number; difficulty: Difficulty; hand: Hand }): SessionState {
  return {
    now: opts.now,
    seed: opts.seed,
    difficulty: opts.difficulty,
    hand: opts.hand,
    index: 0,
    records: [],
    phase: { kind: 'ready', until: opts.now + FIRST_READY_MS },
    sounds: [],
    soundSeq: 0,
  }
}

function startWindup(state: SessionState): SessionState {
  const rng = createRng(state.seed)
  const releaseAt = state.now + WINDUP_MS
  const pitch = createPitch(rng, state.difficulty, releaseAt)
  return { ...state, seed: rng.seed(), phase: { kind: 'windup', pitch, until: releaseAt } }
}

function hitSound(record: PitchRecord): SoundName[] {
  if (record.outcome === 'homerun') return ['hit', 'homerun']
  if (record.contact === 'sweet') return ['hit']
  return ['weak']
}

/** 결과 단계로. 친 공이면 타구 비행을 만든다 */
function showResult(state: SessionState, pitch: Pitch, swing: Swing | null, record: PitchRecord): SessionState {
  const rng = createRng(state.seed)
  const batted =
    swing && record.contact && record.offsetMs !== null
      ? createBattedBall({
          outcome: record.outcome,
          contact: record.contact,
          hand: state.hand,
          offsetMs: record.offsetMs,
          distance: record.distance,
          foulWindowMs: timingWindows(state.difficulty).foul,
          start: ballPosition(pitch, swing.at) ?? { x: 0, y: 1, z: 0 },
          startAt: swing.at,
          rng,
        })
      : null
  const until = Math.max(state.now + RESULT_MS, batted ? battedBallEndAt(batted) : 0)
  return {
    ...state,
    seed: rng.seed(),
    records: [...state.records, record],
    phase: { kind: 'result', pitch, swing, record, batted, until },
  }
}

function swing(state: SessionState, point: ZonePoint, at: number): SessionState {
  const { phase } = state
  if (phase.kind !== 'pitching' || phase.swing) return state
  const { pitch } = phase
  const result = judgeSwing({
    difficulty: state.difficulty,
    hand: state.hand,
    touch: point,
    ball: pitch.cell,
    swingAt: at,
    arriveAt: pitch.arriveAt,
  })
  const record: PitchRecord = { index: state.index, pitch, touched: point, ...result }
  const s: Swing = { point, at }
  if (result.outcome === 'whiff') {
    // 헛스윙: 공은 미트까지 그대로 가고 끝나면 결과로
    return withSounds({ ...state, phase: { ...phase, swing: s, record } }, 'whiff')
  }
  return withSounds(showResult(state, pitch, s, record), ...hitSound(record))
}

function tick(state: SessionState): SessionState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'ready':
      return now >= phase.until ? startWindup(state) : state
    case 'windup':
      if (now < phase.until) return state
      return withSounds({ ...state, phase: { kind: 'pitching', pitch: phase.pitch, swing: null, record: null } }, 'pitch')
    case 'pitching': {
      if (now < pitchEndAt(phase.pitch)) return state
      const record: PitchRecord = phase.record ?? {
        index: state.index,
        pitch: phase.pitch,
        touched: null,
        outcome: 'looking',
        contact: null,
        offsetMs: null,
        distance: null,
      }
      return withSounds(showResult(state, phase.pitch, phase.swing, record), 'mitt')
    }
    case 'result': {
      if (now < phase.until) return state
      const next = state.index + 1
      if (next >= TOTAL_PITCHES) return withSounds({ ...state, index: next, phase: { kind: 'done', until: now + DONE_MS } }, 'end')
      return { ...state, index: next, phase: { kind: 'ready', until: now + READY_MS } }
    }
    case 'done':
      return state
  }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'swing':
      return swing(state, action.point, action.at)
  }
}

export type SessionSummary = Totals & {
  difficulty: Difficulty
  hand: Hand
  records: PitchRecord[]
}

export function summarizeSession(state: SessionState): SessionSummary {
  return {
    difficulty: state.difficulty,
    hand: state.hand,
    records: state.records,
    ...totalOf(state.records),
  }
}

/** 지금 그릴 투수 동작 (FrontView의 PitcherPose) */
export function pitcherPoseOf(state: SessionState): number {
  const { phase, now } = state
  if (phase.kind === 'windup') return 1 - Math.max(0, phase.until - now) / WINDUP_MS
  if (phase.kind === 'pitching' || phase.kind === 'result') return 1 + Math.min(1, (now - phase.pitch.releaseAt) / 400)
  return 0
}
