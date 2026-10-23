// 서바이벌 수치. 시간은 ms, 길이는 맵 단위(처음 맵이 지름 100인 원, 가운데가 0,0).

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/** 남은 사람 수별 맵 반지름 (2명 → 30 … 6명 → 50). 누가 탈락하면 다음 라운드에 줄어든다.
 *  처음엔 5라운드까지 라운드마다 줄였는데(50→20), 사람 수에 맞추고 둘이면 적당히 넓게 두기로 바꿈 */
export const ARENA_BY_PLAYERS: Readonly<Record<number, number>> = { 2: 30, 3: 35, 4: 40, 5: 45, 6: 50 }
export const MAX_ARENA = ARENA_BY_PLAYERS[6]

/** 엄폐물(벽): 길이·두께. 라운드마다 무작위로 새로 짓는다 */
export const WALL_LEN: readonly [number, number] = [10, 18]
export const WALL_THICK = 3
/** 벽끼리 가운데 사이 최소 거리 (작은 맵에선 맵 크기에 맞춰 좁힘) */
export const WALL_GAP = 16

/** 말 반지름 = 총알에 맞는 반경 */
export const PIECE_R = 4

/** 라운드 시작 안내(맵 줄어듦) */
export const COUNTDOWN_MS = 1800
/** 위치·방향 고르는 시간. 넘기면 고른 것까지만 쓰고 나머지는 무작위 */
export const PLAN_MS = 15_000
/** 공개: 말이 나타나고 SHOT_AT에 레이저가 나가기 시작한다 */
export const SHOT_AT = 700
/** 레이저 속도 (맵 단위/ms). 맵 끝에서 끝(100)까지 2초 — 천천히 뻗어 가며 닿는 순간 ✕ */
export const LASER_SPEED = 0.05
/** 레이저가 다 멈춘 뒤 결과 보여주기 */
export const AFTER_SHOT_MS = 1800
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 2500

/** 봇이 정하는 데 걸리는 시간 (고르기 시작부터) */
export const BOT_PLAN_MS: readonly [number, number] = [1500, 6000]

/** 참가 순서별 말 색 (모든 기기에서 같게) */
export const PLAYER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2']
