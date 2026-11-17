// 그림 맞히기 수치 (사용자와 정한 것, 2026-11-16)
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
/** 시작 안내 */
export const INTRO_MS = 2000
/** 그릴 사람이 제시어 2개 중 고르는 시간 (넘으면 무작위) */
export const CHOOSE_MS = 6000
/** 그리는 시간 */
export const DRAW_MS = 60_000
/** 정답 보여주기 */
export const REVEAL_MS = 4000
export const DONE_MS = 2500
/** 맞힌 순서대로 점수 (그 뒤는 1점) */
export const GUESS_POINTS = [10, 8, 6, 5, 4, 3, 2] as const
/** 그린 사람: 맞힌 사람 1명당 */
export const DRAWER_POINTS = 3
/** 한 사람이 그리는 횟수 (두 바퀴) */
export const DRAWS_EACH = 2
/** 채팅 한 줄 최대 글자 */
export const CHAT_MAX = 30
/** 화면에 남기는 채팅 줄 수 */
export const LOG_KEEP = 40
/** 그림 판 크기 (좌표는 이 안의 정수, 화면에 맞춰 늘림) */
export const CANVAS_W = 1000
export const CANVAS_H = 750

// '다 같이 그리기' (투표) 모드 — 사용자 요청 2026-11-16
export const VOTE_MIN_PLAYERS = 3
export const VOTE_ROUNDS = 3
/** 제시어 보여주기 */
export const VOTE_WORD_MS = 3000
export const VOTE_DRAW_MS = 60_000
export const VOTE_PICK_MS = 15_000
/** 판 결과(누가 그렸는지·표) 보여주기 */
export const VOTE_RESULT_MS = 6000
/** 받은 표 1개당 점수 */
export const VOTE_POINTS = 3
