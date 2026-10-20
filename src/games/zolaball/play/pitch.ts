import { MOUND_HEIGHT, PITCHER_DISTANCE, PLAYER_HEIGHT } from '../constants'

// 투구 하나의 궤적과 시간. 시간은 모두 performance.now()와 같은 기준(ms).

export type PitchType = 'fastball' | 'breaking'
export type PitchHeight = 'high' | 'low'

/** 투수가 고르는 것: 구종 + 스트라이크/볼 + 높낮이 */
export type PitchCall = {
  type: PitchType
  isBall: boolean
  height: PitchHeight
}

export type Pitch = PitchCall & {
  releaseAt: number
  /** 공이 홈플레이트(x=0)를 지나는 시점. 타이밍 판정의 기준. */
  arriveAt: number
  /** 홈플레이트를 지날 때 공 높이(m) */
  plateHeight: number
}

export type Point = { x: number; y: number }

const RELEASE: Point = { x: PITCHER_DISTANCE - 0.4, y: MOUND_HEIGHT + PLAYER_HEIGHT * 0.78 }
const CATCHER_X = -1.6
const BALL_MIN_Y = 0.2 // 땅에 박히지 않게 (공 반지름)

/** 스트라이크 존(m). 졸라맨(키 3m) 기준 무릎~가슴. 필드에 그려서 볼/스트라이크를 구분할 수 있게 한다. */
export const STRIKE_ZONE = { bottom: 0.8, top: 1.9 }

const FLIGHT_MS: Record<PitchType, number> = {
  fastball: 400,
  breaking: 525,
}

// 스트라이크는 존 경계 안쪽, 볼은 공 전체가 경계 바깥에 오게 (화면의 공 반지름 0.15m).
// 볼은 스트라이크와 60cm 넘게 떨어뜨려 구분되게 한다. 높은 직구 볼은 떠오르듯, 낮은 변화구 볼은 떨어지듯 더 빠진다.
const PLATE_HEIGHT: Record<PitchType, Record<'strike' | 'ball', Record<PitchHeight, number>>> = {
  fastball: {
    strike: { high: 1.7, low: 1.0 },
    ball: { high: 2.45, low: 0.4 },
  },
  breaking: {
    strike: { high: 1.7, low: 1.0 },
    ball: { high: 2.4, low: 0.3 },
  },
}

/** 높은 공은 조금 빨리, 낮은 공은 조금 늦게 도착한다. 존 가운데에서 1m 벗어날 때마다 이만큼. */
const ARRIVAL_SHIFT_MS_PER_M = 30

/** 궤적 모양. 세로 진행도 = s^verticalPower (클수록 늦게 떨어짐), 위로 볼록한 정도 = arc(m). */
const SHAPE: Record<PitchType, { verticalPower: number; arc: number }> = {
  fastball: { verticalPower: 1, arc: 0.35 },
  breaking: { verticalPower: 5, arc: 5.5 },
}

/** 공이 도착한 뒤 이만큼 지나면 투구가 끝난다. 가장 늦은 판정 구간(파울 130ms)보다 길어야 한다. */
export const PITCH_END_AFTER_ARRIVAL_MS = 300

export function createPitch(call: PitchCall, releaseAt: number): Pitch {
  const plateHeight = PLATE_HEIGHT[call.type][call.isBall ? 'ball' : 'strike'][call.height]
  const zoneMiddle = (STRIKE_ZONE.top + STRIKE_ZONE.bottom) / 2
  const shift = -(plateHeight - zoneMiddle) * ARRIVAL_SHIFT_MS_PER_M
  return {
    ...call,
    releaseAt,
    arriveAt: releaseAt + FLIGHT_MS[call.type] + shift,
    plateHeight,
  }
}

export function pitchEndAt(pitch: Pitch): number {
  return pitch.arriveAt + PITCH_END_AFTER_ARRIVAL_MS
}

/** 진행도 s(0=손에서 놓음, 1=홈플레이트)에서의 위치 */
function pathAt(pitch: Pitch, s: number): Point {
  const { verticalPower, arc } = SHAPE[pitch.type]
  const x = RELEASE.x * (1 - s)
  const y = RELEASE.y + (pitch.plateHeight - RELEASE.y) * s ** verticalPower + arc * s * (1 - s)
  return { x, y }
}

/** 시각 t의 공 위치. 투구 전이면 null. 홈플레이트를 지난 뒤에는 그 방향 그대로 포수까지 가서 멈춘다. */
export function ballPosition(pitch: Pitch, t: number): Point | null {
  if (t < pitch.releaseAt) return null
  const s = (t - pitch.releaseAt) / (pitch.arriveAt - pitch.releaseAt)
  if (s <= 1) return pathAt(pitch, s)

  const catchS = 1 + (0 - CATCHER_X) / RELEASE.x
  const end = pathAt(pitch, 1)
  const before = pathAt(pitch, 0.99)
  const k = (Math.min(s, catchS) - 1) / 0.01
  return {
    x: end.x + (end.x - before.x) * k,
    y: Math.max(BALL_MIN_Y, end.y + (end.y - before.y) * k),
  }
}
