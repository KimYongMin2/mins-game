// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 총알이 몇 번째 칸에 있는지는 절대 안 보낸다 (당긴 횟수만).
import { BANG_SHOW_MS, BLANK_SHOW_MS, SUSPENSE_MS } from '../constants'
import { type EngineState, type Fire, ranksOf } from './engine'

export type PhaseKind = EngineState['phase']['kind']

export type RouletteView = {
  players: { id: string; name: string }[]
  alive: boolean[]
  kills: number[]
  turn: number
  aimAt: number | null
  /** 이번 총으로 당긴 횟수 (0~5) */
  pulls: number
  phase: PhaseKind
  leftMs: number
  fire: Fire | null
  ranks: number[]
}

/** 심판 상태 → 화면 */
export function toView(s: EngineState): RouletteView {
  const { phase, now } = s
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    alive: s.alive,
    kills: s.kills,
    turn: s.turn,
    aimAt: s.aimAt,
    pulls: s.pulls,
    phase: phase.kind,
    leftMs: Math.max(0, phase.until - now),
    fire: phase.kind === 'fire' ? phase.fire : null,
    ranks: ranksOf(s),
  }
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
export function viewChanged(a: RouletteView | null, b: RouletteView): boolean {
  if (!a) return true
  return a.phase !== b.phase || a.turn !== b.turn || a.aimAt !== b.aimAt || a.pulls !== b.pulls || a.alive.some((x, i) => x !== b.alive[i])
}

export type SoundName = 'turn' | 'aim' | 'cock' | 'click' | 'bang' | 'reload' | 'win' | 'lose'

export type ScreenState = {
  now: number
  myId: string
  view: RouletteView | null
  /** 내 시계로 지금 단계가 시작한·끝나는 시각 */
  phaseStart: number
  phaseUntil: number
  /** 방아쇠 연출에서 이미 소리 낸 일 수 (틱/탕, 다시 넣기) */
  fireStage: number
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type ScreenAction = { type: 'view'; view: RouletteView } | { type: 'tick'; now: number }

export function createScreen(myId: string, now: number): ScreenState {
  return { now, myId, view: null, phaseStart: now, phaseUntil: now, fireStage: 0, sounds: [], soundSeq: 0 }
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1
}

/** 지금 내 차례라 고르고 쏠 수 있는지 */
export function isMyTurn(s: ScreenState): boolean {
  const v = s.view
  return !!v && v.phase === 'aim' && v.turn === myIndex(s) && s.now < s.phaseUntil
}

/** 방아쇠 연출 중 결과(틱/탕)가 났는지 */
export const fired = (s: ScreenState) => s.view?.phase === 'fire' && s.now - s.phaseStart >= SUSPENSE_MS

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s
  let seq = s.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq }
}

function receive(s: ScreenState, v: RouletteView): ScreenState {
  const prev = s.view
  const me = v.players.findIndex((p) => p.id === s.myId)
  const sounds: SoundName[] = []
  const changed = !prev || prev.phase !== v.phase || (v.phase === 'aim' && prev.turn !== v.turn)
  let next: ScreenState = { ...s, view: v, phaseUntil: s.now + v.leftMs }
  if (changed) {
    next = { ...next, phaseStart: s.now, fireStage: 0 }
    if (v.phase === 'aim' && v.turn === me) sounds.push('turn')
    if (v.phase === 'fire') {
      sounds.push('cock')
      // 늦게 받았으면 그만큼 연출이 진행된 걸로
      const total = SUSPENSE_MS + (v.fire?.bang ? BANG_SHOW_MS : BLANK_SHOW_MS)
      next = { ...next, phaseStart: s.now - Math.max(0, total - v.leftMs) }
    }
    if (v.phase === 'done') sounds.push(v.ranks[me] === 1 ? 'win' : 'lose')
  } else if (prev && v.phase === 'aim' && v.aimAt !== null && prev.aimAt !== v.aimAt) sounds.push('aim')
  return withSounds(next, sounds)
}

/** 방아쇠 연출: SUSPENSE_MS에 틱/탕, 맞았으면 조금 뒤 총알 다시 넣는 소리 */
function advanceFire(s: ScreenState): ScreenState {
  const f = s.view?.fire
  if (s.view?.phase !== 'fire' || !f) return s
  const t = s.now - s.phaseStart
  const events: SoundName[] = [f.bang ? 'bang' : 'click', ...(f.bang && s.view.alive.filter(Boolean).length > 2 ? ['reload' as const] : [])]
  const times = [SUSPENSE_MS, SUSPENSE_MS + 1300]
  const due = events.filter((_, i) => t >= times[i]).length
  if (due <= s.fireStage) return s
  return withSounds({ ...s, fireStage: due }, events.slice(s.fireStage, due))
}

export function screenReducer(s: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'tick':
      return advanceFire({ ...s, now: action.now })
    case 'view':
      return receive(s, action.view)
  }
}
