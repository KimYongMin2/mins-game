import type { Stance } from '../rules/turn'
import type { MatchAction, MatchState } from './matchState'

// 친구 대전 메시지. 방장이 턴 시작·공개를 보내고, 친구는 고른 자세만 보낸다.
// 방장 쪽 경기에서 친구는 오른쪽(1), 친구 쪽 경기에서 방장은 오른쪽(1)이다.

export type FightMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 (방장은 이걸 받고 첫 경기를 시작한다) */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기 시작 (처음·다시 하기) */
  | { t: 'start' }
  /** 방장 → 친구: 새 턴 */
  | { t: 'turn'; turn: number }
  /** 방장 → 친구: 공개 */
  | { t: 'reveal'; turn: number; host: Stance; guest: Stance }
  /** 친구 → 방장: 고른 자세 (바꿀 때마다 다시 보냄) */
  | { t: 'pick'; turn: number; stance: Stance }

/** 방장: 상태가 prev → next로 바뀌면서 친구에게 보낼 메시지 */
export function hostOutbox(prev: MatchState, next: MatchState): FightMsg[] {
  const out: FightMsg[] = []
  if (next.turns.length > prev.turns.length) {
    const t = next.turns.at(-1)!
    out.push({ t: 'reveal', turn: next.turns.length - 1, host: t.stances[0], guest: t.stances[1] })
  }
  const p = next.phase
  if (p.kind === 'choosing' && (prev.phase.kind !== 'choosing' || prev.phase.index !== p.index)) {
    out.push({ t: 'turn', turn: p.index })
  }
  return out
}

/** 방장: 친구 메시지 → 내 경기에 넣을 액션 */
export function hostActionOf(msg: FightMsg): MatchAction | null {
  return msg.t === 'pick' ? { type: 'remotePick', side: 1, turn: msg.turn, stance: msg.stance } : null
}

/** 친구: 방장 메시지 → 내 경기에 넣을 액션 (내가 왼쪽) */
export function guestActionOf(msg: FightMsg): MatchAction | null {
  if (msg.t === 'turn') return { type: 'remoteTurn', turn: msg.turn }
  if (msg.t === 'reveal') return { type: 'remoteReveal', turn: msg.turn, stances: [msg.guest, msg.host] }
  return null
}

/** 친구: 지금 고른 자세를 방장에게 보낼 메시지. 고를 수 없는 때면 null */
export function guestPickMsg(state: MatchState, stance: Stance): FightMsg | null {
  return state.phase.kind === 'choosing' ? { t: 'pick', turn: state.phase.index, stance } : null
}
