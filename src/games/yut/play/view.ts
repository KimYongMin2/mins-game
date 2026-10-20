// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 숨길 것이 없어서(윷은 던진 뒤에 정해짐) 심판 상태를 거의 그대로 보낸다.
import type { From, Piece } from '../rules/moves'
import type { Throw } from '../rules/throw'
import type { EngineState } from './engine'

export type YutView = {
  players: { id: string; name: string }[]
  left: boolean[]
  pieces: Piece[][]
  turn: number
  pending: Throw[]
  throwsLeft: number
  phase: EngineState['phase']['kind']
  /** 지금 단계(차례면 고르는 시간)가 끝나기까지 */
  leftMs: number
  /** 던진 결과 보여주는 동안 남은 시간 */
  lockMs: number
  lastThrow: EngineState['lastThrow']
  lastMove: { player: number; from: From; to: number | 'out'; captured: number; seq: number } | null
  winner: number | null
}

export function toView(s: EngineState): YutView {
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    left: s.left,
    pieces: s.pieces,
    turn: s.turn,
    pending: s.pending,
    throwsLeft: s.throwsLeft,
    phase: s.phase.kind,
    leftMs: Math.max(0, s.phase.until - s.now),
    lockMs: Math.max(0, s.lockUntil - s.now),
    lastThrow: s.lastThrow,
    lastMove: s.lastMove,
    winner: s.phase.kind === 'done' ? s.phase.winner : null,
  }
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
export function viewChanged(a: YutView | null, b: YutView): boolean {
  if (!a) return true
  return (
    a.phase !== b.phase ||
    a.turn !== b.turn ||
    a.throwsLeft !== b.throwsLeft ||
    a.pending.length !== b.pending.length ||
    a.lastThrow?.seq !== b.lastThrow?.seq ||
    a.lastMove?.seq !== b.lastMove?.seq ||
    a.left.some((x, i) => x !== b.left[i])
  )
}

export type SoundName = 'turn' | 'throw' | 'bonus' | 'move' | 'capture' | 'out' | 'win' | 'lose'

export type ScreenState = {
  now: number
  myId: string
  view: YutView | null
  /** 내 시계로: 지금 단계가 끝나는 시각, 결과 보여주기가 끝나는 시각 */
  phaseUntil: number
  lockUntil: number
  /** 마지막으로 던진 시각 (윷가락 연출) */
  throwAt: number
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type ScreenAction = { type: 'view'; view: YutView } | { type: 'tick'; now: number }

export function createScreen(myId: string, now: number): ScreenState {
  return { now, myId, view: null, phaseUntil: now, lockUntil: now, throwAt: -Infinity, sounds: [], soundSeq: 0 }
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1
}

/** 내 차례이고 던질 수 있는지 / 옮길 수 있는지 */
export function myThrow(s: ScreenState): boolean {
  const v = s.view
  return !!v && v.phase === 'turn' && v.turn === myIndex(s) && v.throwsLeft > 0 && s.now >= s.lockUntil
}

export function myMove(s: ScreenState): boolean {
  const v = s.view
  return !!v && v.phase === 'turn' && v.turn === myIndex(s) && v.throwsLeft === 0 && v.pending.length > 0 && s.now >= s.lockUntil
}

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s
  let seq = s.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq }
}

function receive(s: ScreenState, v: YutView): ScreenState {
  const prev = s.view
  const me = v.players.findIndex((p) => p.id === s.myId)
  const sounds: SoundName[] = []
  let throwAt = s.throwAt
  if (prev && v.lastThrow && v.lastThrow.seq !== prev.lastThrow?.seq) {
    sounds.push(v.lastThrow.result === 'yut' || v.lastThrow.result === 'mo' ? 'bonus' : 'throw')
    throwAt = s.now
  }
  if (prev && v.lastMove && v.lastMove.seq !== prev.lastMove?.seq) {
    sounds.push(v.lastMove.captured > 0 ? 'capture' : v.lastMove.to === 'out' ? 'out' : 'move')
  }
  if (prev && v.phase === 'turn' && v.turn === me && (prev.turn !== me || prev.phase !== 'turn')) sounds.push('turn')
  if (prev && v.phase === 'done' && prev.phase !== 'done') sounds.push(v.winner === me ? 'win' : 'lose')
  return withSounds({ ...s, view: v, phaseUntil: s.now + v.leftMs, lockUntil: s.now + v.lockMs, throwAt }, sounds)
}

export function screenReducer(s: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'tick':
      return { ...s, now: action.now }
    case 'view':
      return receive(s, action.view)
  }
}
