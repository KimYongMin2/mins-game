// 폭탄 돌리기 수치. 시간은 ms.

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/** 폭탄이 터지기까지 (판마다 이 사이에서 무작위, 아무도 모름) */
export const FUSE_MS: readonly [number, number] = [7000, 16000]
/** 폭탄을 받으면 적어도 이만큼은 들고 있어야 다시 던질 수 있다 (받자마자 튕겨 보내지 못하게) */
export const MIN_HOLD_MS = 200
/** 던진 폭탄이 날아가는 시간. 그동안은 아무도 못 던진다 */
export const FLIGHT_MS = 300
/** 판 시작 전 3·2·1 */
export const COUNTDOWN_MS = 2400
/** 펑! 보여주기 */
export const BOOM_MS = 2200
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 2500

/** 봇이 폭탄을 받고 넘기기까지 */
export const BOT_HOLD_MS: readonly [number, number] = [350, 1500]
