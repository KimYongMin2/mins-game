// 점프 배구 수치. 길이는 m, 시간은 초(물리) / ms(화면). 물리는 1초에 STEP_HZ번 고정 스텝으로 계산한다.
// 움직임은 고전 2D 네트 배구 게임의 손맛에 맞췄다: 그 게임의 화면 단위(가로 432칸, 1초 25프레임)를
// 우리 코트 16m에 맞춰 바꾼 값이다. PX = 한 칸 길이, V = (칸/프레임) → m/s, A = (칸/프레임²) → m/s²

/** 그 게임 1칸 = 16m / 432칸 */
const PX = 16 / 432
const FPS = 25
const V = PX * FPS
const A = PX * FPS * FPS

export const STEP_HZ = 60
export const DT = 1 / STEP_HZ

/** 코트: 가로 0~COURT_W, 바닥 y=0, 위로 +. 네트는 가운데 */
export const COURT_W = 16
export const NET_X = COURT_W / 2

/** 중력 (공·선수 같음) */
export const GRAVITY = 1 * A
/** 공 (선수 키의 절반쯤으로 크다) */
export const BALL_R = 20 * PX
/** 천장: 공 위쪽 끝이 여기 닿으면 아래로 툭 떨어진다 */
export const CEILING = BALL_R * 2 + 252 * PX
/** 천장에 닿은 공의 아래로 떨어지는 속도 */
export const CEILING_DROP = 1 * V
/** 공이 이보다 빠르면 잘라 낸다 (안전장치. 한 스텝 0.75m라 몸·네트를 뚫지 않는다) */
export const BALL_MAX_SPEED = 45

/**
 * 네트: 그림은 얇은 기둥(NET_HALF·NET_H). 공 가운데가 네트에서 NET_ZONE 안·NET_TOP_CY 아래면 부딪힌다.
 * 꼭대기 띠(NET_TOP_BAND) 안이면 위로 튀고, 그 아래면 옆으로 되돌아온다. 속도는 줄지 않는다
 */
export const NET_HALF = 0.15
export const NET_ZONE = 25 * PX
export const NET_TOP_CY = BALL_R + 76 * PX
export const NET_TOP_BAND = 16 * PX
export const NET_H = NET_TOP_CY - BALL_R

/**
 * 선수: 공과 부딪히는 판정은 네모 하나 (가운데에서 가로·세로 PLAYER_HALF 안에 공 가운데가 들어오면).
 * 가운데 높이는 발(y)에서 PLAYER_CY 위
 */
export const PLAYER_HALF = 32 * PX
export const PLAYER_CY = BALL_R + 8 * PX
/** 그림용 몸통·머리 원 (발 위치 기준 높이) */
export const BODY_R = 0.6
export const BODY_Y = 0.65
export const HEAD_R = 0.45
export const HEAD_Y = 1.6
/** 걷기 (누르는 순간 바로 이 속도, 공중에서도 움직인다) */
export const MOVE_SPEED = 6 * V
/** 점프 높이 = JUMP_SPEED² / (2 × 중력) ≈ 4.7m */
export const JUMP_SPEED = 16 * V

/**
 * 몸에 맞으면: 공은 늘 위로 튄다 (위로 가는 속도는 들어온 속도와 BUMP_UP 중 큰 것).
 * 옆으로는 몸 가운데에서 떨어진 만큼: 3칸당 1칸/프레임 (가운데에 맞으면 거의 수직, 몸 끝에 맞으면 옆으로 멀리)
 */
export const BUMP_UP = 15 * V
export const BUMP_SIDE_PER_PX = 1 / 3
export const PX_LEN = PX
export const V_UNIT = V

/**
 * 스파이크: 공중에서 치기를 누르면 땅에 닿을 때까지 '치는 자세'. 그동안 공이 몸에 닿으면 강타.
 * 옆으로: 방향키 ←→ 아무거나 누르면 빠르게, 안 누르면 보통 (늘 상대 쪽으로).
 * 위아래: ↑(점프 키) 위로 · ↓ 아래로 · 없으면 수평. 세기는 위로 튀는 속도의 2배
 */
export const SPIKE_SIDE_SLOW = 10 * V
export const SPIKE_SIDE_FAST = 20 * V
export const SPIKE_UP_MUL = 2

/** 몸 날리기: 땅에서 방향키와 같이 치기. 옆으로 미끄러지며 살짝 뜨고, 끝나면 잠깐 누워 있다 */
export const DIVE_SPEED = 8 * V
export const DIVE_HOP = 5 * V
export const DIVE_RECOVER_S = 0.2

/** 경기: 15점 먼저 (듀스 없음) */
export const WIN_SCORE = 15
/** 점수가 나면 보여주는 시간 */
export const POINT_S = 1.4
/** 서브: 공이 서브하는 사람 조금 앞 하늘 꼭대기에서 떨어진다 */
export const SERVE_BALL_X = 56 * PX
export const SERVE_PLAYER_X = 36 * PX
/** 서브 전 준비 시간 */
export const SERVE_WAIT_S = 0.8
/** 경기 끝난 뒤 결과로 넘어가기까지 (ms) */
export const DONE_MS = 2500
