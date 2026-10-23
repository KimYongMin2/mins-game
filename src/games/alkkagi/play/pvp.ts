import { type Stone, flipIndex, flipStones } from '../rules/physics'
import type { Card, MatchAction, MatchState, Side } from './matchState'

// 친구 대전 메시지. 방장이 누가 카드를 고를지와 흑 카드를 정해 보내고, 그다음은 대칭:
// 카드를 고른 쪽이 'pick', 튕긴 쪽이 n번째로 튕긴 돌·속도와 결과(멈춘 자리)를 'shot'으로 보낸다.
// 좌표는 보내는 쪽 시점 그대로 보내고, 받는 쪽이 판을 180도 돌려 쓴다. 방장·친구 모두 자기 자신이 0이다.

export type AlkkagiMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 (방장은 이걸 받고 첫 경기를 시작한다) */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기. 친구가 카드를 고르는지, 흑 카드가 몇 번째인지 */
  | { t: 'start'; guestPicks: boolean; blackCard: Card }
  | { t: 'pick'; card: Card }
  | { t: 'shot'; n: number; index: number; vx: number; vy: number; final: Stone[] }

/** 경기 시작 메시지에서 카드 고를 쪽 (나 = 0) */
export function pickerOf(msg: Extract<AlkkagiMsg, { t: 'start' }>, role: 'host' | 'guest'): Side {
  return msg.guestPicks === (role === 'guest') ? 0 : 1
}

/** 상태가 prev → next로 바뀌면서 상대에게 보낼 메시지 */
export function outbox(prev: MatchState, next: MatchState): AlkkagiMsg[] {
  const out: AlkkagiMsg[] = []
  if (prev.picked === null && next.picked !== null && next.picker === 0) out.push({ t: 'pick', card: next.picked })
  const shot = next.lastShot
  if (shot && shot !== prev.lastShot && shot.shooter === 0) {
    out.push({ t: 'shot', n: shot.n, index: shot.index, vx: shot.vx, vy: shot.vy, final: shot.final })
  }
  return out
}

/** 상대 메시지 → 내 경기에 넣을 액션 (상대 시점 좌표를 내 시점으로) */
export function actionOf(msg: AlkkagiMsg): MatchAction | null {
  switch (msg.t) {
    case 'pick':
      return { type: 'remotePick', card: msg.card }
    case 'shot':
      return {
        type: 'remoteShot',
        n: msg.n,
        index: flipIndex(msg.index, msg.final.length),
        vx: -msg.vx,
        vy: -msg.vy,
        final: flipStones(msg.final),
      }
    default:
      return null
  }
}
