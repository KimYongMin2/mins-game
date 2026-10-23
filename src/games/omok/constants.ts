// 오목 수치. 시간은 ms.

export type Difficulty = 'normal' | 'hard'
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }

/** 판 크기 (15줄 × 15줄) */
export const SIZE = 15

/** 흑·백 카드 고르기. 넘기면 무작위 */
export const PICK_MS = 10_000
/** 고른 카드를 뒤집어 보여주는 시간 */
export const REVEAL_MS = 1800
/** 한 수 30초. 넘기면 골라 둔 자리, 없으면 봇처럼 알아서 둔다 */
export const TURN_MS = 30_000
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 (다섯 줄을 보여줌) */
export const DONE_MS = 3500

/** 봇이 한 수 두는 데 '생각'하는 시간 (최소~최대) */
export const BOT_THINK_MS = { min: 700, max: 1600 } as const
