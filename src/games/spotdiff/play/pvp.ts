import type { SpotView } from './view'

// 친구 대전 메시지. 심판은 우리 게임 서버
export type SpotMsg =
  | { t: 'start' }
  /** 서버 → 나: 지금 화면 */
  | { t: 'view'; v: SpotView }
  /** 나 → 서버: q번째 문제 그림의 (x, y)를 누름 (그림 좌표 400×300) */
  | { t: 'tap'; q: number; x: number; y: number }
