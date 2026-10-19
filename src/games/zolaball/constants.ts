// 필드 치수. 단위는 모두 미터, x는 홈플레이트(0)에서 외야 방향, y는 지면(0)에서 위쪽.
export const PITCHER_DISTANCE = 18.44
export const MOUND_HEIGHT = 0.45 // 실제(약 0.25m)보다 조금 과장
export const FENCE_DISTANCE = 120
export const FENCE_HEIGHT = 5
export const DISTANCE_MARKS = [50, 100, 150]

export const STANDS_START = 124
export const STANDS_STEP_DEPTH = 3.5
export const STANDS_STEP_RISE = 3.2
export const STANDS_STEPS = 10

// 졸라맨은 화면에서 잘 보이도록 실제 키보다 크게 그린다.
export const PLAYER_HEIGHT = 3
export const BATTER_X = -0.7

/** 스윙 애니메이션 전체 길이. 배트가 수평이 되는 시점은 field/StickMen의 SWING_CONTACT_RATIO. */
export const SWING_DURATION_MS = 280
