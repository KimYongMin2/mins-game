// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 고르는 동안엔 다른 사람 자리·방향을 아예 안 보낸다 (확정했는지만). 공개 때 한꺼번에 보낸다.
// 내가 고르는 것(draft)은 각 기기가 들고 있다가 심판에게 보낸다.
import { SHOT_AT } from '../constants'
import { type Vec, clampToArena, halfOf } from '../rules/geometry'
import { type EngineState, type Plan, type Reveal, aliveIndexes, hitAtOf, ranksOf } from './engine'

export type PhaseKind = EngineState['phase']['kind']

export type SurvivalView = {
  players: { id: string; name: string }[]
  alive: boolean[]
  kills: number[]
  round: number
  /** 이번 라운드 맵 반지름, 지난 라운드 맵 반지름 (줄어드는 그림용) */
  half: number
  prevHalf: number
  phase: PhaseKind
  /** 지금 단계가 끝나기까지 */
  leftMs: number
  /** 고르기: 확정한 사람 */
  locked: number[]
  /** 공개·끝: 이번 라운드 결과 */
  reveal: Reveal | null
  ranks: number[]
}

/** 심판 상태 → 화면 */
export function toView(s: EngineState): SurvivalView {
  const { phase, now } = s
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    alive: s.alive,
    kills: s.kills,
    round: s.round,
    half: halfOf(s.round),
    prevHalf: halfOf(Math.max(1, s.round - 1)),
    phase: phase.kind,
    leftMs: Math.max(0, phase.until - now),
    locked: phase.kind === 'plan' ? aliveIndexes(s).filter((i) => s.plans[i]?.locked) : [],
    reveal: phase.kind === 'reveal' || phase.kind === 'done' ? s.lastReveal : null,
    ranks: ranksOf(s),
  }
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
export function viewChanged(a: SurvivalView | null, b: SurvivalView): boolean {
  if (!a) return true
  return a.phase !== b.phase || a.round !== b.round || a.locked.length !== b.locked.length || a.alive.some((x, i) => x !== b.alive[i])
}

export type SoundName = 'count' | 'shrink' | 'go' | 'place' | 'lock' | 'reveal' | 'shot' | 'hit' | 'win' | 'lose'

/** 고르기 단계: 자리 찍기 → 방향 찍기 */
export type Step = 'pos' | 'aim'

export type ScreenState = {
  now: number
  myId: string
  view: SurvivalView | null
  /** 내 시계로 지금 단계가 시작한·끝나는 시각 */
  phaseStart: number
  phaseUntil: number
  draft: Plan
  step: Step
  /** 공개 연출에서 이미 소리 낸 일 수 (레이저 발사, 맞음마다 하나씩) */
  revealStage: number
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type ScreenAction =
  | { type: 'view'; view: SurvivalView }
  | { type: 'tick'; now: number }
  | { type: 'place'; pos: Vec }
  | { type: 'aim'; angle: number }
  | { type: 'step'; step: Step }
  | { type: 'lock' }

const EMPTY_PLAN: Plan = { pos: null, angle: null, locked: false }

export function createScreen(myId: string, now: number): ScreenState {
  return { now, myId, view: null, phaseStart: now, phaseUntil: now, draft: EMPTY_PLAN, step: 'pos', revealStage: 0, sounds: [], soundSeq: 0 }
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1
}

/** 지금 내가 자리·방향을 고를 수 있는지 */
export function canPlan(s: ScreenState): boolean {
  const v = s.view
  const me = myIndex(s)
  return !!v && me >= 0 && v.phase === 'plan' && v.alive[me] && !s.draft.locked && s.now < s.phaseUntil
}

export const canLock = (s: ScreenState) => canPlan(s) && s.draft.pos !== null && s.draft.angle !== null

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s
  let seq = s.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq }
}

function receive(s: ScreenState, v: SurvivalView): ScreenState {
  const prev = s.view
  const me = v.players.findIndex((p) => p.id === s.myId)
  const changed = !prev || prev.phase !== v.phase || prev.round !== v.round
  if (!changed) return { ...s, view: v, phaseUntil: s.now + v.leftMs }
  const sounds: SoundName[] = []
  let next: ScreenState = { ...s, view: v, phaseUntil: s.now + v.leftMs, phaseStart: s.now }
  if (v.phase === 'countdown') sounds.push(v.half < v.prevHalf ? 'shrink' : 'count')
  if (v.phase === 'plan') {
    sounds.push('go')
    next = { ...next, draft: EMPTY_PLAN, step: 'pos' }
  }
  if (v.phase === 'reveal') {
    sounds.push('reveal')
    // 늦게 받았으면 그만큼 연출이 진행된 걸로
    next = { ...next, phaseStart: s.now - Math.max(0, (v.reveal?.ms ?? v.leftMs) - v.leftMs), revealStage: 0 }
  }
  if (v.phase === 'done') sounds.push(v.ranks[me] === 1 ? 'win' : 'lose')
  return withSounds(next, sounds)
}

/** 공개 연출: 레이저 발사 소리, 레이저가 사람에 닿을 때마다 맞는 소리 */
export function revealEvents(r: Pick<Reveal, 'shots'>): { at: number; sound: SoundName }[] {
  const hit = [...new Set(r.shots.flatMap((sh) => (sh.hit === null ? [] : [sh.hit])))]
  const hits = hit.map((p) => ({ at: hitAtOf(r, p)!, sound: 'hit' as const }))
  return [{ at: SHOT_AT, sound: 'shot' as const }, ...hits].sort((a, b) => a.at - b.at)
}

function advanceReveal(s: ScreenState): ScreenState {
  const r = s.view?.reveal
  if (s.view?.phase !== 'reveal' || !r) return s
  const t = s.now - s.phaseStart
  const due = revealEvents(r).filter((e) => e.at <= t)
  if (due.length <= s.revealStage) return s
  return withSounds({ ...s, revealStage: due.length }, due.slice(s.revealStage).map((e) => e.sound))
}

export function screenReducer(s: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'tick':
      return advanceReveal({ ...s, now: action.now })
    case 'view':
      return receive(s, action.view)
    case 'place':
      if (!canPlan(s)) return s
      return { ...s, draft: { ...s.draft, pos: clampToArena(action.pos, s.view!.half) } }
    case 'aim':
      if (!canPlan(s) || !s.draft.pos) return s
      return { ...s, draft: { ...s.draft, angle: action.angle } }
    case 'step':
      if (!canPlan(s) || (action.step === 'aim' && !s.draft.pos)) return s
      return withSounds({ ...s, step: action.step }, action.step === 'aim' ? ['place'] : [])
    case 'lock':
      if (!canLock(s)) return s
      return withSounds({ ...s, draft: { ...s.draft, locked: true } }, ['lock'])
  }
}
