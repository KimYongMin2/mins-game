import type { RouletteView } from './view'

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 고른 사람·당김만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 메시지를 받지만 방장만 쓴다.

export type RouletteMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: 'start' }
  /** 방장 → 모두: 지금 화면 */
  | { t: 'view'; v: RouletteView }
  /** 친구 → 방장: 쏠 사람 고름 */
  | { t: 'aim'; from: string; target: number }
  /** 친구 → 방장: 방아쇠 (고른 사람을 같이 보내 순서가 바뀌어도 맞게) */
  | { t: 'pull'; from: string; target: number }
