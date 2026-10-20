// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 그 위에서 각 기기가 날아가는 폭탄 위치·째깍 소리·효과음을 자기 시계로 계산한다 (screenReducer).
import { FLIGHT_MS } from '../constants'
import { type EngineState, holdLeft, rankingOf } from './engine'

export type PhaseKind = 'countdown' | 'play' | 'boom' | 'done'

export type BombView = {
  players: { id: string; name: string }[]
  alive: boolean[]
  holder: number
  /** 날아가는 중이면 던진 사람·받는 사람·도착까지 남은 시간 */
  flight: { from: number; to: number; leftMs: number } | null
  /** 든 사람이 다시 던질 수 있게 되기까지 남은 시간 */
  holdLeftMs: number
  phase: PhaseKind
  /** 3·2·1 / 펑 / 끝 화면이 끝나기까지 */
  leftMs: number
  /** 돌리기 시작한 뒤 지난 시간 (째깍 소리를 점점 빠르게) */
  elapsedMs: number
  victim: number | null
  round: number
  ranking: number[]
}

/** 심판 상태 → 화면 (터지는 시각은 넣지 않는다) */
export function toView(s: EngineState): BombView {
  const { phase, now } = s
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    alive: s.alive,
    holder: s.holder,
    flight: s.flight ? { from: s.flight.from, to: s.flight.to, leftMs: Math.max(0, s.flight.landAt - now) } : null,
    holdLeftMs: holdLeft(s),
    phase: phase.kind,
    leftMs: phase.kind === 'play' ? 0 : Math.max(0, phase.until - now),
    elapsedMs: phase.kind === 'play' ? now - phase.start : 0,
    victim: phase.kind === 'boom' ? phase.victim : null,
    round: s.round,
    ranking: rankingOf(s),
  }
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
export function viewChanged(a: BombView | null, b: BombView): boolean {
  if (!a) return true
  return (
    a.phase !== b.phase ||
    a.round !== b.round ||
    a.holder !== b.holder ||
    (a.flight === null) !== (b.flight === null) ||
    a.flight?.to !== b.flight?.to ||
    a.alive.some((x, i) => x !== b.alive[i])
  )
}

export type SoundName = 'count' | 'go' | 'tick' | 'throw' | 'catch' | 'boom' | 'win' | 'lose'

/** 각 기기 화면 상태: 받은 화면 + 내 시계 기준 시각들 */
export type ScreenState = {
  now: number
  myId: string
  view: BombView | null
  /** 내 시계로 날아가는 폭탄의 출발·도착 시각 */
  flight: { from: number; to: number; startAt: number; landAt: number } | null
  /** 내 시계로 돌리기 시작한 시각, 지금 단계가 끝나는 시각 */
  playStart: number
  phaseUntil: number
  /** 내 시계로 든 사람이 던질 수 있게 되는 시각 */
  holdUntil: number
  nextTickAt: number
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type ScreenAction = { type: 'view'; view: BombView } | { type: 'tick'; now: number }

export function createScreen(myId: string, now: number): ScreenState {
  return { now, myId, view: null, flight: null, playStart: now, phaseUntil: now, holdUntil: now, nextTickAt: 0, sounds: [], soundSeq: 0 }
}

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s
  let seq = s.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq }
}

/** 지금 내가 던질 수 있는지 (내가 들고 있고, 날아가는 중이 아니고, 받은 지 MIN_HOLD_MS가 지남) */
export function canThrowNow(s: ScreenState): boolean {
  const v = s.view
  const me = myIndex(s)
  return !!v && me >= 0 && v.phase === 'play' && v.holder === me && !s.flight && s.now >= s.holdUntil
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1
}

function receive(s: ScreenState, v: BombView): ScreenState {
  const prev = s.view
  const { now } = s
  const sounds: SoundName[] = []
  const phaseChanged = !prev || prev.phase !== v.phase || prev.round !== v.round
  if (phaseChanged) {
    if (v.phase === 'countdown') sounds.push('count')
    if (v.phase === 'play') sounds.push('go')
    if (v.phase === 'boom') sounds.push('boom')
    if (v.phase === 'done') sounds.push(v.ranking[0] === v.players.findIndex((p) => p.id === s.myId) ? 'win' : 'lose')
  }
  // 날아가는 폭탄: 새로 던졌으면 내 시계로 출발·도착을 정한다
  let flight = s.flight
  if (v.flight) {
    if (!flight || flight.to !== v.flight.to || flight.from !== v.flight.from) {
      flight = { from: v.flight.from, to: v.flight.to, startAt: now - (FLIGHT_MS - v.flight.leftMs), landAt: now + v.flight.leftMs }
      sounds.push('throw')
    }
  } else if (flight) {
    if (v.phase === 'play' && v.holder === flight.to) sounds.push('catch')
    flight = null
  }
  const playStart = v.phase === 'play' ? (phaseChanged ? now - v.elapsedMs : s.playStart) : s.playStart
  return withSounds(
    {
      ...s,
      view: v,
      flight,
      playStart,
      phaseUntil: v.phase === 'play' ? now : now + v.leftMs,
      // 새로 받았으면 내 시계로 기다릴 시각을 정한다 (같은 사람이 계속 들고 있으면 그대로)
      holdUntil: !prev || prev.holder !== v.holder || phaseChanged ? now + v.holdLeftMs : s.holdUntil,
      nextTickAt: phaseChanged && v.phase === 'play' ? now + 300 : s.nextTickAt,
    },
    sounds,
  )
}

/** 째깍 간격: 돌리기 시작할 땐 느리게, 오래될수록 빠르게 (언제 터질지는 알려주지 않음) */
export function tickGap(elapsedMs: number): number {
  return Math.max(130, 520 - elapsedMs * 0.03)
}

function tickScreen(s: ScreenState): ScreenState {
  if (s.view?.phase !== 'play' || s.now < s.nextTickAt) return s
  return withSounds({ ...s, nextTickAt: s.now + tickGap(s.now - s.playStart) }, ['tick'])
}

export function screenReducer(s: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'tick':
      return tickScreen({ ...s, now: action.now })
    case 'view':
      return receive(s, action.view)
  }
}
