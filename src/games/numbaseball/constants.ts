// 숫자야구 수치. 시간은 ms.

export type Difficulty = 'normal' | 'hard'
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }

/** 숫자 개수 (3자리 / 4자리) */
export type Length = 3 | 4
export const LENGTHS: readonly Length[] = [3, 4]

/** 내 숫자 정하기, 한 번 부르기 모두 30초 (처음 20초는 생각할 시간이 모자라 늘림). 넘기면 무작위 */
export const TURN_MS = 30_000
/** 둘 다 숫자를 정한 뒤 '시작!' 표시 */
export const INTRO_MS = 1500
/** 부른 결과(1S 2B)를 크게 보여주는 시간 */
export const RESULT_MS = 1400
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 (서로의 숫자를 보여줌) */
export const DONE_MS = 3000

/** 대결: 한 사람이 부를 수 있는 최대 횟수. 둘 다 못 맞히면 무승부 */
export const MAX_TRIES = 12
/** 혼자 하기: 이만큼 불러도 못 맞히면 실패 */
export const SOLO_MAX_TRIES = 20

/** 봇이 한 번 부르는 데 '생각'하는 시간 (최소~최대) */
export const BOT_THINK_MS = { min: 1500, max: 3500 } as const

/** 봇이 지난 결과 하나하나를 기억해서 쓸 확률. 1이면 모든 단서를 다 쓴다.
 *  봇끼리 시뮬레이션 평균: 일반 3자리 약 7.6번·4자리 약 8.3번, 어려움 약 5.1번·5.4번 */
export const BOT_RECALL: Record<Difficulty, number> = { normal: 0.3, hard: 1 }
