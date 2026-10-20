import type { From } from '../rules/moves'
import type { YutView } from './view'

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 던지기·옮기기만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 메시지를 받지만 방장만 쓴다.

export type YutMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: 'start' }
  /** 방장 → 모두: 지금 화면 */
  | { t: 'view'; v: YutView }
  /** 친구 → 방장: 던지기 (접속 번호) */
  | { t: 'throw'; from: string }
  /** 친구 → 방장: 쌓인 결과 중 throwIdx번째로 이 말을 옮김 */
  | { t: 'move'; from: string; throwIdx: number; piece: From }
