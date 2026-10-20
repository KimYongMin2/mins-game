import type { Hand } from './engine'
import type { NunchiView } from './view'

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 누른 것·고른 손만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 메시지를 받지만 방장만 쓴다.

export type NunchiMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: 'start' }
  /** 방장 → 모두: 지금 화면 */
  | { t: 'view'; v: NunchiView }
  /** 친구 → 방장: 외침 (접속 번호) */
  | { t: 'press'; from: string }
  /** 친구 → 방장: 결승 가위바위보 손 */
  | { t: 'pick'; from: string; hand: Hand }
