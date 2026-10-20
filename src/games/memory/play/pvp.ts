import type { MatchAction, MatchState, Side } from './matchState'

// 친구 대전 메시지. 방장이 덱 시드와 선공을 정해 보내고, 그다음은 대칭:
// 자기 차례인 쪽이 연 카드 번호를 보낸다. 방장·친구 모두 자기 자신이 왼쪽(0)이다.

export type MemoryMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 (방장은 이걸 받고 첫 경기를 시작한다) */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기. 덱 시드와 친구가 먼저 하는지 */
  | { t: 'start'; deckSeed: number; guestFirst: boolean }
  /** 차례인 쪽 → 상대: n번째로 연 카드 */
  | { t: 'flip'; n: number; index: number }

/** 경기 시작 메시지에서 내 쪽 선공 (나 = 0) */
export function firstOf(msg: Extract<MemoryMsg, { t: 'start' }>, role: 'host' | 'guest'): Side {
  return msg.guestFirst === (role === 'guest') ? 0 : 1
}

/** 상태가 prev → next로 바뀌면서 상대에게 보낼 메시지 (내가 연 카드) */
export function outbox(prev: MatchState, next: MatchState): MemoryMsg[] {
  const out: MemoryMsg[] = []
  for (let n = prev.flips.length; n < next.flips.length; n++) {
    const f = next.flips[n]
    if (next.controllers[f.side] === 'user') out.push({ t: 'flip', n, index: f.index })
  }
  return out
}

/** 상대 메시지 → 내 경기에 넣을 액션 */
export function actionOf(msg: MemoryMsg): MatchAction | null {
  return msg.t === 'flip' ? { type: 'remoteFlip', n: msg.n, index: msg.index } : null
}
