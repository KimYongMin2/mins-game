// 팔씨름 수치. 시간은 ms, 위치는 −1(상대 승) ~ +1(내 승).

export type Difficulty = 'normal' | 'hard'
/** 종목: 연타전 / 타이밍전 */
export type Event = 'mash' | 'timing'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }
export const EVENT_LABEL: Record<Event, string> = { mash: '연타전', timing: '타이밍전' }

/** 먼저 이만큼 판을 이기면 승리 (3판 2선승) */
export const WINS_NEEDED = 2
/** 한 판 최대 시간. 끝나면 더 넘긴 쪽이 이김 */
export const ROUND_MS = 15_000
/** 판 시작 전 3·2·1 */
export const COUNTDOWN_MS = 2400
/** 판 결과 보여주기 */
export const ROUND_END_MS = 1800
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 1800

/** 연타전: 한 번 누를 때 넘어가는 양 */
export const TAP_PUSH = 0.05

/** 타이밍전: 막대가 한쪽 끝에서 반대쪽까지 가는 시간 */
export const PASS_MS = 750

/** 봇 연타 속도(초당) */
export const BOT_TAP_RATE: Record<Difficulty, number> = { normal: 5.5, hard: 7.5 }
