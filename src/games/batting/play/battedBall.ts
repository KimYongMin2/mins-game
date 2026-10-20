import type { Rng } from '../../../shared/random'
import type { Hand } from '../constants'
import type { Contact, Outcome } from '../rules/judge'
import type { Vec3 } from './pitch'

// 배트에 맞은 공의 비행. 결과는 판정으로 이미 정해져 있고, 그에 맞는 그림만 만든다.
// 빠르게 치면 당겨 친 쪽(우타는 왼쪽), 늦게 치면 밀어 친 쪽으로 날아간다.

export type BattedBall = {
  startAt: number
  /** 이 시간 동안 보여준다 */
  duration: number
  start: Vec3
  /** 처음 속도(m/s) */
  velocity: Vec3
}

const GRAVITY = 9.8
/** 땅에 튈 때 남는 세로 속도 비율 */
const BOUNCE = 0.4

type Range = readonly [number, number]

/** 앞으로 나가는 속도 · 위로 뜨는 속도 · 보여주는 시간 */
const PROFILES: Record<'homerun' | 'triple' | 'double' | 'single' | 'fly' | 'grounder', { forward: Range; up: Range; duration: number }> = {
  homerun: { forward: [36, 40], up: [20, 24], duration: 2000 },
  triple: { forward: [33, 36], up: [12, 15], duration: 1700 },
  double: { forward: [30, 33], up: [9, 12], duration: 1500 },
  single: { forward: [26, 30], up: [3, 6], duration: 1200 },
  fly: { forward: [12, 18], up: [22, 26], duration: 1700 },
  grounder: { forward: [18, 24], up: [-4, -2], duration: 1200 },
}

/** 페어 타구의 최대 좌우 각도 */
const MAX_FAIR_ANGLE = (38 * Math.PI) / 180

function within(rng: Rng, [min, max]: Range) {
  return min + rng.next() * (max - min)
}

export function createBattedBall(opts: {
  outcome: Outcome
  contact: Contact
  hand: Hand
  /** 터치 시각 − 도착 시각 */
  offsetMs: number
  /** 가장 넓은 판정 구간(파울) */
  maxWindowMs: number
  start: Vec3
  startAt: number
  rng: Rng
}): BattedBall | null {
  const { outcome, contact, hand, offsetMs, maxWindowMs, start, startAt, rng } = opts
  if (outcome === 'whiff' || outcome === 'looking') return null
  /** 우타 기준 +면 밀어 친 쪽(오른쪽) */
  const handSign = hand === 'right' ? 1 : -1
  const lateness = Math.max(-1, Math.min(1, offsetMs / maxWindowMs))

  if (outcome === 'foul') {
    // 스침은 뒤로 높이 뜨고, 타이밍이 어긋난 파울은 옆으로 빠진다
    if (contact === 'graze') {
      return { startAt, duration: 1100, start, velocity: { x: (rng.next() - 0.5) * 4, y: within(rng, [11, 14]), z: within(rng, [-9, -6]) } }
    }
    const angle = (Math.sign(lateness || 1) * handSign * within(rng, [55, 72]) * Math.PI) / 180
    const speed = within(rng, [22, 28])
    return { startAt, duration: 1300, start, velocity: { x: Math.sin(angle) * speed, y: within(rng, [6, 10]), z: Math.cos(angle) * speed } }
  }

  const kind = outcome === 'out' ? (rng.next() < 0.5 ? 'fly' : 'grounder') : outcome
  const p = PROFILES[kind]
  const angle = lateness * handSign * MAX_FAIR_ANGLE + (rng.next() - 0.5) * 0.1
  const forward = within(rng, p.forward)
  return {
    startAt,
    duration: p.duration,
    start,
    velocity: { x: Math.sin(angle) * forward, y: within(rng, p.up), z: Math.cos(angle) * forward },
  }
}

export function battedBallEndAt(ball: BattedBall): number {
  return ball.startAt + ball.duration
}

/** 시각 t의 공 위치. 땅에 닿으면 한 번 튀고 그다음엔 굴러간다 */
export function battedBallPosition(ball: BattedBall, t: number): Vec3 {
  const sec = Math.max(0, Math.min(t - ball.startAt, ball.duration)) / 1000
  const { start, velocity: v } = ball
  const x = start.x + v.x * sec
  const z = start.z + v.z * sec
  // 처음 땅에 닿는 시각: start.y + v.y·t − g·t²/2 = 0
  const land = (v.y + Math.sqrt(v.y * v.y + 2 * GRAVITY * start.y)) / GRAVITY
  if (sec <= land) return { x, y: start.y + v.y * sec - (GRAVITY / 2) * sec * sec, z }
  const up = (GRAVITY * land - v.y) * BOUNCE
  const after = sec - land
  return { x, y: Math.max(0, up * after - (GRAVITY / 2) * after * after), z }
}
