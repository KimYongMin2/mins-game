// 숫자 잇기 수치. 시간은 ms.

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

/** 숫자 1~MAX_NUM, 색 COLORS개, 두 벌 + 와일드 */
export const MAX_NUM = 13
export const COLORS = 4
export const COPIES = 2
export const WILDS = 2
/** 처음 나눠 주는 타일 수 */
export const HAND_SIZE = 13
/** 첫 등록: 내 타일만으로 만든 줄의 합이 이만큼 이상 */
export const FIRST_MELD = 30
/** 한 줄 최소 타일 수 */
export const MIN_SET = 3

/** 첫 차례 전 안내 */
export const INTRO_MS = 1800
/** 한 차례 시간. 넘기면 하던 것은 되돌리고 1장 가져온다 */
export const TURN_MS = 60_000
/** 봇이 한 차례 생각하는 시간 */
export const BOT_THINK_MS: readonly [number, number] = [1200, 2600]
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 3000
