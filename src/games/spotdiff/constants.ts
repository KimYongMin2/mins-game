// 다른 그림 찾기 수치 (사용자와 정한 것, 2026-11-23)
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
/** 한 판 문제 수 */
export const QUESTIONS = 5
/** 한 문제 제한 시간 */
export const ASK_MS = 60_000
/** 틀린 곳을 누르면 이만큼 못 누름 */
export const LOCK_MS = 3000
/** 친구 대전: 시간 안에 못 찾은 곳 하나마다 걸린 시간에 더함 */
export const MISS_PENALTY_MS = 10_000
/** 다 찾은 뒤 다음 문제까지 (시간에 안 셈) */
export const CLEAR_PAUSE_MS = 1500
/** 시간이 끝나 못 찾은 곳을 보여 주는 동안 (시간에 안 셈) */
export const REVEAL_MS = 2500
export const INTRO_MS = 3000
export const DONE_MS = 2000
/** 혼자 하기 점수: 찾을 때마다 100점 + 다 찾으면 남은 초 × 10점 */
export const FIND_POINTS = 100
export const BONUS_PER_SEC = 10
