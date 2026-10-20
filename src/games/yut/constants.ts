// 윷놀이 수치. 시간은 ms.

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4
/** 고를 수 있는 말 개수 */
export const PIECE_COUNTS = [2, 3, 4] as const

/** 첫 차례 전 안내 */
export const INTRO_MS = 1800
/** 던질지·무엇을 옮길지 고르는 시간. 넘기면 저절로 */
export const DECIDE_MS = 20_000
/** 던진 결과를 보여주는 동안 다음 행동을 막는다 */
export const THROW_SHOW_MS = 700
/** 봇이 한 번 행동하기 전 생각하는 시간 */
export const BOT_THINK_MS = 800
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 2500
