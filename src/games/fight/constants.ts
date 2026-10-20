// 격투 수치. 시간은 ms.

export type Difficulty = 'normal' | 'hard'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }

/** 처음 생명력 */
export const MAX_LIFE = 3
/** 준비 스택 최대 (처음 2에서 강타를 넣으며 3으로) */
export const MAX_STACKS = 3
/** 강타에 드는 스택 (모은 걸 전부) */
export const SMASH_COST = 3
/** 이 턴이 지나도 안 끝나면 생명력으로 승부 (방어만 계속하는 경우 대비) */
export const MAX_TURNS = 30

/** 자세를 고르는 시간 */
export const CHOOSE_MS = 2000
/** 공개한 결과를 보여주는 시간 */
export const REVEAL_MS = 1200
/** 첫 턴 전 '시작!' 표시 */
export const INTRO_MS = 1200
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 1800
