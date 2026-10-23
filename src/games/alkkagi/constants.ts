// 알까기 수치. 길이는 판의 칸(줄 간격) 단위, 시간은 ms(물리는 초).

export type Difficulty = 'normal' | 'hard'
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }

/** 판 줄 수 (오목판 그대로 15줄). 줄은 0~14 */
export const LINES = 15
/** 판 끝: 바깥 줄에서 0.7칸 더. 돌 가운데가 이 밖으로 나가면 떨어진다 */
export const EDGE = { min: -0.7, max: LINES - 1 + 0.7 } as const
/** 돌 반지름 (칸) */
export const RADIUS = 0.44
/** 한 사람 돌 개수, 처음 줄 (나는 아래 11번 줄, 상대는 위 3번 줄) */
export const STONES = 5
export const HOME_ROW = 11

/** 가장 세게 튕길 때 속도 (칸/초). 혼자 굴리면 멈출 때까지 약 23칸.
 *  처음 줄 상대 돌(8칸 앞)을 정면으로 맞히면 세기 85%쯤부터 떨어진다 */
export const MAX_SPEED = 18
/** 마찰로 줄어드는 속도 (칸/초²). 6 → 4.5로 줄였다가 밀려나는 거리가 너무 길어서 7로 */
export const FRICTION = 7
/** 돌끼리 부딪힐 때 튕기는 정도 (1이면 완전 탄성: 정면으로 맞히면 친 돌이 멈추고, 빗겨 맞히면 거의 직각으로 갈라짐).
 *  세게 부딪힐수록 조금 낮춰서 친 돌이 맞힌 뒤에도 더 나간다. 부딪히는 속도가 hardAt(칸/초) 이상이면 hard.
 *  한때 hard 0.1까지 낮췄더니 친 돌이 맞고도 거의 꺾이지 않고 곧게 가서 이상해 0.5로 */
export const RESTITUTION = { soft: 0.95, hard: 0.5, hardAt: 14 } as const
/** 이만큼(칸) 당기면 가장 세게. 길게 당기게 해서 방향을 세밀하게 (처음 3.2칸은 손가락이 조금만 움직여도 방향이 크게 바뀜) */
export const MAX_PULL = 6
/** 이보다 덜 당긴 채 놓으면 취소 */
export const CANCEL_PULL = 0.5

/** 흑·백 카드 고르기. 넘기면 무작위 */
export const PICK_MS = 10_000
/** 고른 카드를 뒤집어 보여주는 시간 */
export const REVEAL_MS = 1800
/** 한 번 튕기기 20초. 넘기면 아무 돌이나 약하게 */
export const TURN_MS = 20_000
/** 돌이 다 멈춘 뒤 잠깐 보여주고 다음 차례 */
export const SETTLE_MS = 500
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
export const DONE_MS = 3000

/** 봇이 한 번 튕기는 데 '생각'하는 시간 (최소~최대) */
export const BOT_THINK_MS = { min: 900, max: 1800 } as const
/** 봇 조준 흔들림: 방향(도), 힘(비율) */
export const BOT_AIM: Record<Difficulty, { angle: number; power: number }> = {
  normal: { angle: 7, power: 0.22 },
  hard: { angle: 2.5, power: 0.1 },
}
