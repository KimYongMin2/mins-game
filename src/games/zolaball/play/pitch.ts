import { MOUND_HEIGHT, PITCHER_DISTANCE, PLAYER_HEIGHT } from '../constants'

// 투구 하나의 궤적과 시간. 시간은 모두 performance.now()와 같은 기준(ms).
// 지금은 연습용 직구 하나뿐이고, 변화구·높낮이는 이후 단계에서 추가한다.
export type Pitch = {
  releaseAt: number
  /** 공이 홈플레이트(x=0)를 지나는 시점. 타이밍 판정의 기준. */
  arriveAt: number
  isBall: boolean
  /** 홈플레이트를 지날 때 공 높이(m) */
  plateHeight: number
}

export type Point = { x: number; y: number }

const RELEASE: Point = { x: PITCHER_DISTANCE - 0.4, y: MOUND_HEIGHT + PLAYER_HEIGHT * 0.78 }
const CATCHER_X = -1.6
const FASTBALL_FLIGHT_MS = 550
const STRIKE_HEIGHT = 1.1
const BALL_HEIGHT = 0.35

/** 공이 도착한 뒤 이만큼 지나면 투구가 끝난다. 가장 늦은 판정 구간(170ms)보다 길어야 한다. */
export const PITCH_END_AFTER_ARRIVAL_MS = 300

export function createPracticePitch(releaseAt: number, isBall: boolean): Pitch {
  return {
    releaseAt,
    arriveAt: releaseAt + FASTBALL_FLIGHT_MS,
    isBall,
    plateHeight: isBall ? BALL_HEIGHT : STRIKE_HEIGHT,
  }
}

export function pitchEndAt(pitch: Pitch): number {
  return pitch.arriveAt + PITCH_END_AFTER_ARRIVAL_MS
}

/** 시각 t의 공 위치. 투구 전이면 null. 홈플레이트를 지난 뒤에는 같은 속도로 포수까지 가서 멈춘다. */
export function ballPosition(pitch: Pitch, t: number): Point | null {
  if (t < pitch.releaseAt) return null
  const progress = (t - pitch.releaseAt) / (pitch.arriveAt - pitch.releaseAt)
  const x = RELEASE.x * (1 - progress)
  const y = RELEASE.y + (pitch.plateHeight - RELEASE.y) * progress
  if (x >= CATCHER_X) return { x, y }
  // 포수 미트에서 멈춤
  const catchProgress = (RELEASE.x - CATCHER_X) / RELEASE.x
  return { x: CATCHER_X, y: RELEASE.y + (pitch.plateHeight - RELEASE.y) * catchProgress }
}
