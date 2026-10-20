// 눈치게임 수치. 시간은 ms.

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6

/** 이 안에 두 명 이상이 누르면 '동시' → 모두 탈락 */
export const COLLIDE_MS = 300
/** 한 판에 누를 수 있는 시간. 끝나면 안 누른 사람 모두 탈락 */
export const CALL_MS = 10_000
/** 판 시작 전 3·2·1 */
export const COUNTDOWN_MS = 2400
/** 판 결과(탈락자) 보여주기 */
export const RESULT_MS = 2400

/** 결승 가위바위보: 고르는 시간, 공개 보여주기 */
export const RPS_PICK_MS = 3000
export const RPS_REVEAL_MS = 1800

/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 2500

/** 봇이 누를 시각 (판 시작부터): 성격마다 다름 */
export const BOT_STYLES: readonly (readonly [number, number])[] = [
  [300, 2500], // 성급함
  [1200, 5500], // 보통
  [2500, 8500], // 느긋함
]
