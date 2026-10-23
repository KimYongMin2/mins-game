// 러시안룰렛 수치. 시간은 ms.

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

/** 탄창 칸 수. 총알 한 발이 1~6번째 중 한 곳에 들어 있다 */
export const CHAMBERS = 6

/** 시작 전 안내 */
export const INTRO_MS = 1500
/** 한 차례 시간. 넘기면 골라 둔 사람(없으면 아무나)을 쏜다 */
export const TURN_MS = 15_000
/** 방아쇠: 철컥 뒤 SUSPENSE_MS에 '틱' 또는 '탕' */
export const SUSPENSE_MS = 1100
/** 빈 칸이면 보여주는 시간, 맞으면 보여주는 시간(쓰러짐 + 총알 다시 넣기) */
export const BLANK_SHOW_MS = 900
export const BANG_SHOW_MS = 2400
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 2500

/** 봇: 누구를 쏠지 고르기까지, 고른 뒤 당기기까지 */
export const BOT_AIM_MS: readonly [number, number] = [700, 1600]
export const BOT_PULL_MS: readonly [number, number] = [500, 1100]

/** 자리별 색 (모든 기기에서 같게) */
export const PLAYER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#1f2937']
