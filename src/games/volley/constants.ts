// 점프 배구 수치. 길이는 m, 시간은 초(물리) / ms(화면). 물리는 1초에 STEP_HZ번 고정 스텝으로 계산한다.

export const STEP_HZ = 60
export const DT = 1 / STEP_HZ

/** 코트: 가로 0~COURT_W, 바닥 y=0, 위로 +. 네트는 가운데 */
export const COURT_W = 16
export const CEILING = 12
export const NET_X = COURT_W / 2
export const NET_HALF = 0.15
export const NET_H = 2.4

export const GRAVITY = 20
/** 공 */
export const BALL_R = 0.45
/** 공기 저항 (1초에 줄어드는 비율) */
export const BALL_DRAG = 0.08
/** 벽·천장·네트에 튈 때 남는 속도 비율 */
export const WALL_BOUNCE = 0.8
export const NET_BOUNCE = 0.6
/** 공이 이보다 빠르면 잘라 낸다 (터널링 방지) */
export const BALL_MAX_SPEED = 24

/** 선수: 몸통 원 + 머리 원 (발 위치 기준 높이) */
export const BODY_R = 0.6
export const BODY_Y = 0.65
export const HEAD_R = 0.45
export const HEAD_Y = 1.6
export const MOVE_SPEED = 6.5
export const MOVE_ACCEL = 45
export const JUMP_SPEED = 9.5
/** 몸에 맞고 튈 때 남는 속도 비율과 최소 튀는 속도 (받으면 늘 위로 떠오르게) */
export const BODY_BOUNCE = 0.75
export const MIN_BUMP_SPEED = 8
/** 받을 때 선수 속도를 공에 더하는 비율 */
export const CARRY = 0.5
/** 위쪽(머리·어깨)에 맞으면 네트 쪽으로 밀어 주는 속도와 최소 위로 뜨는 속도 (그냥 받아도 넘어가게) */
export const BUMP_PUSH = 4
export const BUMP_UP = 10
/** 네트 꼭대기에 얹힌 공을 옆으로 미는 속도 (안 그러면 위에서 멈출 수 있음) */
export const NET_TOP_NUDGE = 1.5

/** 스파이크: 공중에서 치기. 머리에서 이 거리 안의 공만 (점프 한 번에 한 번) */
export const SPIKE_REACH = 1.5
/** 방향별 스파이크 속도 (앞 = 상대 쪽). x는 보는 쪽으로 */
export const SPIKE = {
  forward: { vx: 17, vy: -7 },
  none: { vx: 13, vy: -2.5 },
  back: { vx: 6, vy: 9 },
} as const

/** 몸 날리기: 땅에서 치기 */
export const DIVE_SPEED = 11
export const DIVE_S = 0.35
/** 날린 뒤 못 움직이는 시간 */
export const DIVE_RECOVER_S = 0.5
/** 날리는 동안 몸이 낮아지는 비율 (낮은 공 살리기) */
export const DIVE_LOW = 0.45

/** 경기 */
export const WIN_SCORE = 15
/** 점수가 나면 보여주는 시간 */
export const POINT_S = 1.4
/** 서브: 서브하는 사람 머리 위 이 높이에서 공을 떨어뜨린다 */
export const SERVE_DROP_Y = 5
/** 서브 전 준비 시간 */
export const SERVE_WAIT_S = 0.8
/** 경기 끝난 뒤 결과로 넘어가기까지 (ms) */
export const DONE_MS = 2500
