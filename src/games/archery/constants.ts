// 졸라 양궁 수치. 길이는 미터, 시간은 ms.
// 과녁 좌표계: 과녁 중심이 (0, 0), x는 오른쪽, y는 위쪽.

export type Distance = 30 | 50 | 70 | 100

/** 한 경기: 30m 3발 → 50m 3발 → 70m 3발 → 100m 1발 */
export const ROUNDS: readonly { distance: Distance; arrows: number }[] = [
  { distance: 30, arrows: 3 },
  { distance: 50, arrows: 3 },
  { distance: 70, arrows: 3 },
  { distance: 100, arrows: 1 },
]

export const TOTAL_ARROWS = ROUNDS.reduce((sum, r) => sum + r.arrows, 0)

/** 과녁 반지름 (지름 80cm 과녁, 처음 122cm에서 플레이 후 줄임). 링 10개, 가운데 X는 10점 링의 절반 */
export const TARGET_RADIUS = 0.4
export const RING_WIDTH = TARGET_RADIUS / 10
export const X_RADIUS = RING_WIDTH / 2

/** 완전히 당기는 데 걸리는 시간 */
export const DRAW_MS = 800
/** 완전히 당긴 뒤 이만큼은 흔들림이 늘지 않는다 */
export const FATIGUE_GRACE_MS = 2000
/** 한 발을 쏘는 제한 시간. '눌러서 당기기'가 뜨면 시작. 못 쏘면 0점, 당기는 중이면 바로 발사 */
export const SHOT_CLOCK_MS = 10000
/** 이때부터 시간 표시가 빨개진다 */
export const SHOT_CLOCK_WARN_MS = 3000

/** 누른 뒤 이 시간이 지나면 팔이 풀려 자동 발사 */
export const AUTO_RELEASE_MS = 10000

/**
 * 조준 흔들림(각도, 라디안). 거리가 멀수록 과녁 위에서는 크게 흔들린다.
 * 30m 약 1링 · 100m 약 3.5링. 흔들림이 가운데를 지나는 순간에 놓는 게 실력
 */
export const SWAY_ANGLE = 0.0014

/** 화살 속도 (m/s). 비행 시간 = 거리 / 속도 */
export const ARROW_SPEED = 70

/**
 * 바람 1m/s에 과녁에서 밀리는 거리(m). 비행 시간이 길수록 많이 밀린다. (처음 값의 1.5배, 70m만 약 1.1배)
 * 강한 바람(6m/s) 기준 30m 약 2.5링 · 50m 약 6링 · 70m 약 7.5링 · 100m 과녁 밖
 */
export const WIND_DRIFT_PER_MPS: Record<Distance, number> = {
  30: 0.0165,
  50: 0.039,
  70: 0.05,
  100: 0.105,
}

/** 덜 당기고 쏘면 처지는 정도. 30m에서 반만 당기면 3~4링 아래로 */
export const UNDERDRAW_DROP_AT_30M = 0.5
