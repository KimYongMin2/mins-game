// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 각 기기가 자기 손패를 알아야 해서 모든 손패를 같이 보낸다. 화면엔 내 손패만 그린다 (치팅 방지 없음, 친구끼리라).
import type { TileId } from '../rules/tiles'
import type { Table } from '../rules/turn'
import { type EngineState, rankingOf } from './engine'

export type TilesView = {
  players: { id: string; name: string }[]
  left: boolean[]
  hands: TileId[][]
  table: Table
  melded: boolean[]
  poolCount: number
  turn: number
  phase: EngineState['phase']['kind']
  /** 지금 단계(차례면 남은 시간)가 끝나기까지 */
  leftMs: number
  last: EngineState['last']
  /** 끝났을 때만: 1등부터 */
  ranking: number[] | null
}

export function toView(s: EngineState): TilesView {
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    left: s.left,
    hands: s.hands,
    table: s.table,
    melded: s.melded,
    poolCount: s.pool.length,
    turn: s.turn,
    phase: s.phase.kind,
    leftMs: Math.max(0, s.phase.until - s.now),
    last: s.last,
    ranking: s.phase.kind === 'done' ? rankingOf(s) : null,
  }
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
export function viewChanged(a: TilesView | null, b: TilesView): boolean {
  if (!a) return true
  return a.phase !== b.phase || a.turn !== b.turn || a.last?.seq !== b.last?.seq || a.left.some((x, i) => x !== b.left[i])
}

export type SoundName = 'turn' | 'play' | 'draw' | 'pick' | 'drop' | 'nope' | 'win' | 'lose'

export type ScreenState = {
  now: number
  myId: string
  view: TilesView | null
  /** 내 시계로: 지금 단계가 끝나는 시각 */
  phaseUntil: number
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type ScreenAction = { type: 'view'; view: TilesView } | { type: 'tick'; now: number } | { type: 'sound'; name: SoundName }

export function createScreen(myId: string, now: number): ScreenState {
  return { now, myId, view: null, phaseUntil: now, sounds: [], soundSeq: 0 }
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1
}

export function myTurn(s: ScreenState): boolean {
  const v = s.view
  return !!v && v.phase === 'turn' && v.turn === myIndex(s) && s.now < s.phaseUntil
}

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s
  let seq = s.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq }
}

function receive(s: ScreenState, v: TilesView): ScreenState {
  const prev = s.view
  const me = v.players.findIndex((p) => p.id === s.myId)
  const sounds: SoundName[] = []
  if (prev && v.last && v.last.seq !== prev.last?.seq) sounds.push(v.last.kind === 'play' ? 'play' : 'draw')
  if (prev && v.phase === 'turn' && v.turn === me && (prev.turn !== me || prev.phase !== 'turn')) sounds.push('turn')
  if (prev && v.phase === 'done' && prev.phase !== 'done') sounds.push(v.ranking?.[0] === me ? 'win' : 'lose')
  return withSounds({ ...s, view: v, phaseUntil: s.now + v.leftMs }, sounds)
}

export function screenReducer(s: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'tick':
      return { ...s, now: action.now }
    case 'view':
      return receive(s, action.view)
    case 'sound':
      return withSounds(s, [action.name])
  }
}
