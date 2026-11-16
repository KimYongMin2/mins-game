import type { ChosungView } from './view'

// 친구 대전 메시지. 심판은 우리 게임 서버 (정답은 서버만 앎)
export type ChosungMsg =
  | { t: 'start' }
  /** 서버 → 나: 지금 화면 */
  | { t: 'view'; v: ChosungView }
  /** 나 → 서버: 답 */
  | { t: 'guess'; text: string }
