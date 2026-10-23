import type { Plan } from './engine'
import type { SurvivalView } from './view'

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 자기가 고른 것만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 메시지를 받지만 방장만 쓴다
// (친구끼리 고른 자리를 몰래 볼 수는 있다 — 친구끼리라 치팅 방지는 안 함).

export type SurvivalMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: 'start' }
  /** 방장 → 모두: 지금 화면 */
  | { t: 'view'; v: SurvivalView }
  /** 친구 → 방장: 지금까지 고른 자리·방향 (확정 전에도 보내 둬서 시간 초과 때 씀) */
  | { t: 'plan'; from: string; round: number; plan: Plan }
