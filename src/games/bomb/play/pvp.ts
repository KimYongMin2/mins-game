import type { BombView } from './view'

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 던진 것만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 'pass'를 받지만 방장만 쓴다.

export type BombMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: 'start' }
  /** 방장 → 모두: 지금 화면 */
  | { t: 'view'; v: BombView }
  /** 친구 → 방장: from(나)이 to에게 던짐. 접속 번호(id)로 */
  | { t: 'pass'; from: string; to: string }
