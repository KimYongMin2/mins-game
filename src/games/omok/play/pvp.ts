import type { Card, MatchAction, MatchState, Side } from './matchState'
import { moverOf } from './matchState'

// 친구 대전 메시지. 방장이 누가 카드를 고를지와 흑 카드를 정해 보내고, 그다음은 대칭:
// 카드를 고른 쪽이 고른 카드를(pick), 둔 쪽이 n번째 수의 자리를(move) 보낸다. 방장·친구 모두 자기 자신이 0이다.

export type OmokMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 (방장은 이걸 받고 첫 경기를 시작한다) */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기. 친구가 카드를 고르는지, 흑 카드가 몇 번째인지 */
  | { t: 'start'; guestPicks: boolean; blackCard: Card }
  | { t: 'pick'; card: Card }
  | { t: 'move'; n: number; pos: number }

/** 경기 시작 메시지에서 카드 고를 쪽 (나 = 0) */
export function pickerOf(msg: Extract<OmokMsg, { t: 'start' }>, role: 'host' | 'guest'): Side {
  return msg.guestPicks === (role === 'guest') ? 0 : 1
}

/** 상태가 prev → next로 바뀌면서 상대에게 보낼 메시지 */
export function outbox(prev: MatchState, next: MatchState): OmokMsg[] {
  const out: OmokMsg[] = []
  if (prev.picked === null && next.picked !== null && next.picker === 0) out.push({ t: 'pick', card: next.picked })
  for (let n = prev.moves.length; n < next.moves.length; n++) {
    if (moverOf(next, n) === 0) out.push({ t: 'move', n, pos: next.moves[n] })
  }
  return out
}

/** 상대 메시지 → 내 경기에 넣을 액션 */
export function actionOf(msg: OmokMsg): MatchAction | null {
  switch (msg.t) {
    case 'pick':
      return { type: 'remotePick', card: msg.card }
    case 'move':
      return { type: 'remoteMove', n: msg.n, pos: msg.pos }
    default:
      return null
  }
}
