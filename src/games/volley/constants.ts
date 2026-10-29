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
/** 공이 이보다 빠르면 잘라 낸다. 한 스텝에 0.5m라 몸(반지름 합 1.05m)·네트(0.6m)를 뚫지 않는다 */
export const BALL_MAX_SPEED = 30

/** 선수: 몸통 원 + 머리 원 (발 위치 기준 높이) */
export const BODY_R = 0.6
export const BODY_Y = 0.65
export const HEAD_R = 0.45
export const HEAD_Y = 1.6
/**
 * 피격 판정: 발끝~머리 위까지 일자 막대(캡슐) 하나. 아래·위 끝 원 중심 높이와 반지름 → 0~2.1m.
 * 처음엔 몸통·머리 원 두 개였는데 목 부분이 잘록해서 어디에 맞는지 헷갈렸음. 위 BODY_·HEAD_는 그림용
 */
export const HIT_R = 0.55
export const HIT_LOW = 0.55
export const HIT_HIGH = 1.55
/** 몸 날리는 중: 막대가 보는 쪽으로 눕는다 (머리 쪽 끝이 앞으로 이만큼, 높이는 이만큼) */
export const DIVE_REACH = 0.9
export const DIVE_HIGH = 0.6
/** 이동은 누르는 순간 이 속도 (가속 없이 바로 방향 전환. 처음 6.5 + 가속은 느리고 굼떠서 바꿈) */
export const MOVE_SPEED = 8.5
/** 점프 높이 = JUMP_SPEED² / (2 × 중력) ≈ 3.3m (처음 9.5 ≈ 2.3m는 낮았음) */
export const JUMP_SPEED = 11.5
/** 몸에 맞고 튈 때 남는 속도 비율과 최소 튀는 속도 (받으면 늘 위로 떠오르게) */
export const BODY_BOUNCE = 0.55
export const MIN_BUMP_SPEED = 6.5
/** 받을 때 선수 속도를 공에 더하는 비율 */
export const CARRY = 0.35
/**
 * 위쪽(머리·어깨)에 맞으면 네트 쪽으로 밀어 주는 속도와 최소 위로 뜨는 속도 (그냥 받아도 넘어가게).
 * 미는 속도는 네트에서 멀수록 크게: 1m당 BUMP_AIM, BUMP_PUSH_MIN~MAX 사이.
 * 몸에 맞은 공은 느리게 (처음 반발 0.75·최소 8·밀기 4·위로 10은 빨라서 줄였는데, 뒤에서 받으면 네트를 못 넘어 거리별로)
 */
export const BUMP_AIM = 1
export const BUMP_PUSH_MIN = 2.5
export const BUMP_PUSH_MAX = 5
export const BUMP_UP = 9
/** 몸(위·옆)에 맞은 공이 이보다 느리면 받아 넘기기 도움을 준다. 빠른 공(스파이크)은 물리대로 튕겨서 받기 어렵게 */
export const FAST_BALL_SPEED = 13
/** 그 밖에 몸 어디에 맞든 공이 적어도 이만큼은 위로 뜬다 (빠른 스파이크도 조금은) */
export const ANY_BUMP_UP = 2
/** 빠른 공(FAST_BALL_SPEED 이상)이 몸 옆에 맞으면 남는 속도 비율 — 힘없이 떨어진다 */
export const FAST_HIT_BOUNCE = 0.25
/** 네트 꼭대기에 얹힌 공을 옆으로 미는 속도 (안 그러면 위에서 멈출 수 있음) */
export const NET_TOP_NUDGE = 1.5

/** 스파이크: 공중에서 치기. 머리에서 이 거리 안의 공만 (점프 한 번에 한 번) */
export const SPIKE_REACH = 1.5
/**
 * 방향키별 스파이크 속도 (x는 상대 쪽으로 +). 위(점프 키를 누른 채) = 위로 강타, 앞(상대 쪽) = 옆으로 빠르게,
 * 뒤(반대쪽) = 느리게, 아래 = 내리찍기, 없음 = 중간. 처음엔 앞·없음·뒤 셋뿐이었음. 더 빠르게 해 달라고 해서 약 1.3배로
 */
export const SPIKE = {
  up: { vx: 8, vy: 21 },
  forward: { vx: 26, vy: -2 },
  none: { vx: 18, vy: -6.5 },
  back: { vx: 10, vy: 2.5 },
  down: { vx: 15, vy: -17 },
} as const
/** 공중에서 누른 치기를 이만큼(초) 기억해 두고 그 사이 공이 손에 닿으면 친다 (조금 일찍 눌러도 되게) */
export const HIT_BUFFER_S = 0.13

/** 몸 날리기: 땅에서 치기 */
export const DIVE_SPEED = 9
/** 약 2m (처음 11m/s × 0.35초 ≈ 3.9m는 너무 멀었음) */
export const DIVE_S = 0.22
/** 날린 뒤 못 움직이는 시간 */
export const DIVE_RECOVER_S = 0.3

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
