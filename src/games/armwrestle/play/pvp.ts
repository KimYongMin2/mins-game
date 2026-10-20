import type { Event } from '../constants'
import type { Grade } from '../rules/timing'
import type { MatchAction, MatchState, PhaseKind, Side } from './matchState'
import { phaseLeft } from './matchState'

// 친구 대전 메시지. 방장 기기가 심판으로 위치·판·시간을 정해 보내고,
// 친구는 누른 횟수(연타전)나 판정(타이밍전)만 보낸다. 방장 쪽 경기에서 친구는 오른쪽(1)이다.

export type ArmMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 (방장은 이걸 받고 첫 경기를 시작한다) */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기. 종목은 방장이 고른 것 */
  | { t: 'start'; event: Event }
  /** 방장 → 친구: 지금 상태 (방장 기준. 위치 + = 방장 쪽) */
  | {
      t: 'sync'
      round: number
      wins: readonly [number, number]
      pos: number
      phase: PhaseKind
      left: number
      winner: 'host' | 'guest' | null
      hostGrade: { pass: number; grade: Grade } | null
    }
  /** 친구 → 방장: 경기 전체에서 지금까지 누른 횟수 (메시지가 빠져도 다음 것으로 맞춰짐) */
  | { t: 'taps'; total: number }
  /** 친구 → 방장: 타이밍 판정 */
  | { t: 'press'; pass: number; grade: Grade }

/** 방장: 지금 상태를 친구에게 보낼 메시지 */
export function hostSync(state: MatchState): ArmMsg {
  const { phase } = state
  const winner = phase.kind === 'roundEnd' || phase.kind === 'done' ? phase.winner : null
  const g = state.lastGrade[0]
  return {
    t: 'sync',
    round: state.round,
    wins: state.wins,
    pos: state.pos,
    phase: phase.kind,
    left: phaseLeft(state),
    winner: winner === null ? null : winner === 0 ? 'host' : 'guest',
    hostGrade: g && state.pressed[0] >= 0 ? { pass: state.pressed[0], grade: g.grade } : null,
  }
}

/** 방장: 단계나 판이 바뀌었으면 바로 보낸다 (그 밖엔 0.1초마다) */
export function phaseChanged(prev: MatchState, next: MatchState): boolean {
  return prev.phase.kind !== next.phase.kind || prev.round !== next.round
}

/** 친구: 방장 메시지 → 내 경기에 넣을 액션 (내가 왼쪽) */
export function guestActionOf(msg: ArmMsg): MatchAction | null {
  if (msg.t !== 'sync') return null
  const side = (w: 'host' | 'guest' | null): Side | null => (w === null ? null : w === 'guest' ? 0 : 1)
  return {
    type: 'sync',
    sync: {
      round: msg.round,
      wins: [msg.wins[1], msg.wins[0]],
      pos: -msg.pos,
      phase: msg.phase,
      left: msg.left,
      winner: side(msg.winner),
      foeGrade: msg.hostGrade,
    },
  }
}

/** 방장: 친구 메시지 → 내 경기에 넣을 액션 */
export function hostActionOf(msg: ArmMsg): MatchAction | null {
  if (msg.t === 'taps') return { type: 'remoteTaps', total: msg.total }
  if (msg.t === 'press') return { type: 'remotePress', pass: msg.pass, grade: msg.grade }
  return null
}

/** 친구: 상태가 prev → next로 바뀌면서 방장에게 보낼 판정 (누른 횟수는 따로 0.1초마다) */
export function guestPressOut(prev: MatchState, next: MatchState): ArmMsg | null {
  const g = next.lastGrade[0]
  if (next.pressed[0] === prev.pressed[0] || next.pressed[0] < 0 || !g) return null
  return { t: 'press', pass: next.pressed[0], grade: g.grade }
}
