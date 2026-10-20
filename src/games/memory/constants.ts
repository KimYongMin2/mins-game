// 짝맞추기 수치. 시간은 ms.

export type Difficulty = 'normal' | 'hard'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }

/** 그림 가짓수 = 쌍 수. 카드는 그 두 배 */
export const PAIRS = 12
export const CARD_COUNT = PAIRS * 2

/** 한 장 고르는 시간. 넘기면 무작위로 열린다 */
export const PICK_MS = 10_000
/** 첫 차례 전 '시작!' 표시 */
export const INTRO_MS = 1500
/** 짝이 맞은 두 장을 보여주는 시간 (그다음 같은 사람이 또 연다) */
export const MATCH_SHOW_MS = 700
/** 틀린 두 장을 보여주는 시간 (그다음 덮고 차례가 넘어간다) */
export const MISS_SHOW_MS = 1000
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 1800

/** 봇이 한 장 여는 데 걸리는 시간 */
export const BOT_THINK_MS = 700

/** 봇 기억력: 열린 카드를 기억할 확률, 차례가 바뀔 때 기억한 카드 하나를 잊을 확률 */
export const BOT_MEMORY: Record<Difficulty, { remember: number; forget: number }> = {
  normal: { remember: 0.5, forget: 0.2 },
  hard: { remember: 0.9, forget: 0.03 },
}
