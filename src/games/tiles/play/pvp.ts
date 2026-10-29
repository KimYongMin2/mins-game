import type { Table } from '../rules/turn'
import type { TilesView } from './view'

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 낸 바닥·가져오기만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 메시지를 받지만 방장만 쓴다.

export type TilesMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: 'start' }
  /** 방장 → 모두: 지금 화면 */
  | { t: 'view'; v: TilesView }
  /** 친구 → 방장: 바닥을 이렇게 바꿔 내려놓음 (접속 번호) */
  | { t: 'play'; from: string; table: Table }
  /** 친구 → 방장: 1장 가져오기 */
  | { t: 'draw'; from: string }
  /** 친구 → 방장: 짜고 있는 바닥 (바꿀 때마다). 시간 초과 때 다 맞으면 그대로 낸다 */
  | { t: 'draft'; from: string; turnSeq: number; table: Table }
