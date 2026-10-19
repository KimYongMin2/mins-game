import { STANDS_START, STANDS_STEPS, STANDS_STEP_DEPTH, STANDS_STEP_RISE } from '../constants'
import type { Point } from './pitch'
import type { Rng } from '../../../shared/random'

// 배트에 맞은 공의 비행. 결과(안타·홈런 등)는 판정으로 이미 정해져 있고, 그에 맞는 그림만 만든다.

export type BattedKind = 'foul' | 'out' | 'single' | 'double' | 'homerun'

export type BattedBall = {
  kind: BattedKind
  startAt: number
  duration: number
  start: Point
  /** 떨어지는 지점 */
  end: Point
  /** 시작·끝을 잇는 선 위로 솟는 높이(m) */
  apex: number
}

type Range = readonly [number, number]

const PROFILES: Record<BattedKind, { distance: Range; apex: Range; duration: Range }> = {
  // 뒤로 높이 뜨는 파울
  foul: { distance: [-28, -12], apex: [10, 18], duration: [900, 1100] },
  // 높이 떴다가 잡히는 뜬공
  out: { distance: [45, 95], apex: [24, 34], duration: [1500, 1800] },
  // 낮게 뻗는 라인드라이브
  single: { distance: [35, 65], apex: [3, 7], duration: [800, 1000] },
  double: { distance: [75, 105], apex: [12, 20], duration: [1300, 1500] },
  // 펜스(120m)를 넘어 관중석으로
  homerun: { distance: [128, 152], apex: [26, 38], duration: [2000, 2300] },
}

function within(rng: Rng, [min, max]: Range) {
  return min + rng.next() * (max - min)
}

/** x 위치의 관중석 높이 (관중석 밖이면 0) */
export function standsHeightAt(x: number): number {
  if (x < STANDS_START) return 0
  const step = Math.min(Math.floor((x - STANDS_START) / STANDS_STEP_DEPTH) + 1, STANDS_STEPS)
  return step * STANDS_STEP_RISE
}

export function createBattedBall(kind: BattedKind, start: Point, startAt: number, rng: Rng): BattedBall {
  const p = PROFILES[kind]
  const landX = within(rng, p.distance)
  return {
    kind,
    startAt,
    duration: within(rng, p.duration),
    start,
    end: { x: landX, y: standsHeightAt(landX) },
    apex: within(rng, p.apex),
  }
}

export function battedBallEndAt(ball: BattedBall): number {
  return ball.startAt + ball.duration
}

/** 시각 t의 공 위치. 떨어진 뒤에는 그 자리에 머문다. */
export function battedBallPosition(ball: BattedBall, t: number): Point {
  const u = Math.min(Math.max((t - ball.startAt) / ball.duration, 0), 1)
  return {
    x: ball.start.x + (ball.end.x - ball.start.x) * u,
    y: ball.start.y * (1 - u) + ball.end.y * u + 4 * ball.apex * u * (1 - u),
  }
}
