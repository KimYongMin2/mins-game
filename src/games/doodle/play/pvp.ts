import type { InkOp } from './ink'
import type { DoodleView } from './view'

// 친구 대전 메시지. 심판은 우리 게임 서버: 사람마다 화면(view)을 보내고, 제시어·정답 판정·점수를 맡는다.
// 그림(ink)은 그리는 사람 → 서버 → 모두 (서버가 그 판 그림을 기억해서 늦게 온 사람에게 inkAll로 다시 보냄).
export type DoodleMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로) */
  | { t: 'start' }
  /** 서버 → 나: 지금 화면 */
  | { t: 'view'; v: DoodleView }
  /** 그리는 사람 → 모두: 바뀐 그림 (turn = 몇 번째 차례) */
  | { t: 'ink'; turn: number; ops: InkOp[] }
  /** 나 → 서버: 지금까지 그림 다시 보내 줘 */
  | { t: 'inkSync' }
  /** 서버 → 나: 이번 차례 그림 전부 */
  | { t: 'inkAll'; turn: number; ops: InkOp[] }
  /** 그릴 사람 → 서버: 제시어 고름 */
  | { t: 'choose'; index: number }
  /** 맞히는 사람 → 서버: 채팅 답 */
  | { t: 'guess'; text: string }
  /** 맞히는 사람 → 서버: 보기 고름 */
  | { t: 'pick'; index: number }
