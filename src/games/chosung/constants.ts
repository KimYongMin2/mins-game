// 초성 퀴즈 수치 (사용자와 정한 것, 2026-11-16)
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const QUESTIONS = 10
export const INTRO_MS = 2000
/** 한 문제 */
export const ASK_MS = 20_000
/** 이만큼 지나면 글자 하나 힌트 */
export const HINT_MS = 10_000
export const REVEAL_MS = 2500
export const DONE_MS = 2000
/** 맞힌 순서대로 (그 뒤 1점). 힌트가 나온 뒤에 맞히면 절반(올림) */
export const POINTS = [10, 7, 5, 3, 2] as const
export const CHAT_MAX = 20
export const LOG_KEEP = 30
