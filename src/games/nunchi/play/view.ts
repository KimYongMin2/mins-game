// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 그 위에서 각 기기가 효과음·남은 시간을 자기 시계로 계산한다 (screenReducer).
import { COLLIDE_MS } from '../constants'
import { type EngineState, type Hand, type OutReason, aliveIndexes, collidedOf, ranksOf } from './engine'

export type PhaseKind = EngineState['phase']['kind']

export type NunchiView = {
  players: { id: string; name: string }[]
  alive: boolean[]
  round: number
  phase: PhaseKind
  /** 지금 단계가 끝나기까지 (외치기는 시간 초과까지) */
  leftMs: number
  /** 이번 판에 누른 순서. collided = 다른 사람과 동시 */
  presses: { player: number; n: number; collided: boolean }[]
  losers: { player: number; reason: OutReason }[]
  replay: boolean
  /** 결승: 고른 사람 (손은 공개 전까지 안 보냄) */
  picked: number[]
  hands: Partial<Record<number, Hand>>
  winner: number | null
  ranks: number[]
}

/** 심판 상태 → 화면 */
export function toView(s: EngineState): NunchiView {
  const { phase, now } = s
  const collided = collidedOf(s.presses)
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    alive: s.alive,
    round: s.round,
    phase: phase.kind,
    leftMs: Math.max(0, phase.until - now),
    presses: s.presses.map((p, i) => ({ player: p.player, n: i + 1, collided: collided.has(p.player) })),
    losers: phase.kind === 'result' ? phase.losers : [],
    replay: phase.kind === 'result' && phase.replay,
    picked: phase.kind === 'rps' ? aliveIndexes(s).filter((i) => s.picks[i] !== undefined) : [],
    hands: phase.kind === 'reveal' ? phase.hands : {},
    winner: phase.kind === 'reveal' ? phase.winner : null,
    ranks: ranksOf(s),
  }
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
export function viewChanged(a: NunchiView | null, b: NunchiView): boolean {
  if (!a) return true
  return (
    a.phase !== b.phase ||
    a.round !== b.round ||
    a.presses.length !== b.presses.length ||
    a.presses.some((p, i) => p.collided !== b.presses[i]?.collided) ||
    a.picked.length !== b.picked.length ||
    a.alive.some((x, i) => x !== b.alive[i])
  )
}

export type SoundName = 'count' | 'go' | 'call' | 'clash' | 'out' | 'reveal' | 'win' | 'lose'

export type ScreenState = {
  now: number
  myId: string
  view: NunchiView | null
  /** 내 시계로 지금 단계가 끝나는 시각 */
  phaseUntil: number
  /** 결승에서 내가 고른 손 (화면에만) */
  myHand: Hand | null
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type ScreenAction = { type: 'view'; view: NunchiView } | { type: 'tick'; now: number } | { type: 'myHand'; hand: Hand }

export function createScreen(myId: string, now: number): ScreenState {
  return { now, myId, view: null, phaseUntil: now, myHand: null, sounds: [], soundSeq: 0 }
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1
}

/** 지금 내가 외칠 수 있는지 */
export function canCall(s: ScreenState): boolean {
  const v = s.view
  const me = myIndex(s)
  return !!v && me >= 0 && v.phase === 'call' && v.alive[me] && !v.presses.some((p) => p.player === me)
}

/** 지금 내가 가위바위보를 고를 수 있는지 (결승에 올라감) */
export function canPick(s: ScreenState): boolean {
  const v = s.view
  const me = myIndex(s)
  return !!v && me >= 0 && v.phase === 'rps' && v.alive[me] && s.now < s.phaseUntil
}

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s
  let seq = s.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq }
}

function receive(s: ScreenState, v: NunchiView): ScreenState {
  const prev = s.view
  const me = v.players.findIndex((p) => p.id === s.myId)
  const sounds: SoundName[] = []
  const phaseChanged = !prev || prev.phase !== v.phase || prev.round !== v.round
  if (phaseChanged) {
    if (v.phase === 'countdown') sounds.push('count')
    if (v.phase === 'call' || v.phase === 'rps') sounds.push('go')
    if (v.phase === 'result') sounds.push('out')
    if (v.phase === 'reveal') sounds.push('reveal')
    if (v.phase === 'done') sounds.push(v.ranks[me] === 1 ? 'win' : 'lose')
  }
  if (prev && !phaseChanged) {
    if (v.presses.length > prev.presses.length) sounds.push('call')
    if (v.presses.filter((p) => p.collided).length > prev.presses.filter((p) => p.collided).length) sounds.push('clash')
  }
  return withSounds(
    {
      ...s,
      view: v,
      phaseUntil: s.now + v.leftMs,
      myHand: phaseChanged && v.phase === 'rps' ? null : s.myHand,
    },
    sounds,
  )
}

export function screenReducer(s: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'tick':
      return { ...s, now: action.now }
    case 'view':
      return receive(s, action.view)
    case 'myHand':
      return canPick(s) ? { ...s, myHand: action.hand } : s
  }
}

/** 동시 판정 폭 (안내 문구용) */
export const COLLIDE_SEC = COLLIDE_MS / 1000
