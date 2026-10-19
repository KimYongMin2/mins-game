import { describe, expect, it } from 'vitest'
import { AUTO_RELEASE_MS, DRAW_MS, SHOT_CLOCK_MS } from '../constants'
import { flightMs, swayOffset } from './shot'
import { windDrift } from './wind'
import {
  ANNOUNCE_MS,
  type RoundState,
  createRound,
  currentDistance,
  reticleAt,
  roundReducer,
  shotClockLeft,
  summarizeRound,
} from './roundState'

const FRAME = 16

function tickUntil(s: RoundState, done: (x: RoundState) => boolean, limit = 30000): RoundState {
  const end = s.now + limit
  let x = s
  while (!done(x)) {
    if (x.now > end) throw new Error(`시간 초과: ${x.phase.kind}`)
    x = roundReducer(x, { type: 'tick', now: x.now + FRAME })
  }
  return x
}

const ready = (s: RoundState) => tickUntil(s, (x) => x.phase.kind === 'ready')

/** 한 발 쏘기: holdMs만큼 당기고 그동안 조준을 (dx, dy)만큼 옮긴 뒤 놓는다 */
function shoot(s: RoundState, holdMs: number, aim?: (x: RoundState) => { dx: number; dy: number }): RoundState {
  let x = ready(s)
  x = roundReducer(x, { type: 'press', at: x.now })
  if (aim) x = roundReducer(x, { type: 'aimBy', ...aim(x) })
  x = tickUntil(x, (y) => y.now >= (y.phase.kind === 'drawing' ? y.phase.startedAt : 0) + holdMs)
  x = roundReducer(x, { type: 'release', at: x.now })
  return tickUntil(x, (y) => y.phase.kind === 'scored')
}

/** 바람과 (놓는 순간의) 흔들림을 정확히 보정하는 완벽한 궁수 */
function perfectAim(holdMs: number) {
  return (x: RoundState) => {
    if (x.phase.kind !== 'drawing') return { dx: 0, dy: 0 }
    const distance = currentDistance(x)
    const releaseAt = x.phase.startedAt + Math.ceil(holdMs / FRAME) * FRAME
    const drift = windDrift(x.wind, distance)
    const sway = swayOffset(releaseAt, releaseAt - x.phase.startedAt, distance, x.swayPhase)
    return { dx: -drift.x - sway.x, dy: -drift.y - sway.y }
  }
}

function playAll(seed: number, holdMs: number, aim?: (x: RoundState) => { dx: number; dy: number }) {
  let s = createRound(0, seed)
  while (s.phase.kind !== 'done') {
    s = shoot(s, holdMs, aim)
    s = tickUntil(s, (x) => x.phase.kind !== 'scored')
  }
  return s
}

describe('경기 흐름', () => {
  it('처음엔 30m 안내 후 누르기를 기다린다', () => {
    const s = createRound(0, 1)
    expect(s.phase.kind).toBe('announce')
    expect(currentDistance(s)).toBe(30)
    const r = ready(s)
    expect(r.now).toBeGreaterThanOrEqual(ANNOUNCE_MS)
  })

  it('당기는 중에만 조준이 움직이고, 화면 밖으로는 못 나간다', () => {
    let s = ready(createRound(0, 1))
    expect(roundReducer(s, { type: 'aimBy', dx: 0.1, dy: 0 }).aim).toEqual({ x: 0, y: 0 })
    s = roundReducer(s, { type: 'press', at: s.now })
    s = roundReducer(s, { type: 'aimBy', dx: 0.1, dy: -0.05 })
    expect(s.aim).toEqual({ x: 0.1, y: -0.05 })
    s = roundReducer(s, { type: 'aimBy', dx: 100, dy: 0 })
    expect(s.aim.x).toBeLessThan(2)
  })

  it('당기는 중에는 조준점이 흔들린다', () => {
    let s = ready(createRound(0, 3))
    s = roundReducer(s, { type: 'press', at: s.now })
    const a = reticleAt(s, s.now + 300)!
    const b = reticleAt(s, s.now + 900)!
    expect(a).not.toEqual(b)
  })

  it('놓으면 거리에 맞는 시간 동안 날아간 뒤 점수가 매겨진다', () => {
    let s = ready(createRound(0, 1))
    s = roundReducer(s, { type: 'press', at: s.now })
    s = roundReducer(s, { type: 'release', at: s.now + DRAW_MS })
    expect(s.phase.kind).toBe('flying')
    if (s.phase.kind !== 'flying') return
    expect(s.phase.until - s.phase.startAt).toBeCloseTo(flightMs(30))
    s = tickUntil(s, (x) => x.phase.kind === 'scored')
    expect(s.shots).toHaveLength(1)
    expect(s.sounds.map((x) => x.name)).toContain('release')
  })

  it('10초 동안 안 놓으면 자동 발사', () => {
    let s = ready(createRound(0, 1))
    s = roundReducer(s, { type: 'press', at: s.now })
    const pressedAt = s.now
    s = tickUntil(s, (x) => x.phase.kind === 'flying')
    expect(s.now - pressedAt).toBeGreaterThanOrEqual(AUTO_RELEASE_MS)
  })

  it('10발을 30·50·70·100m 순서로 쏘고 끝난다', () => {
    const s = playAll(5, DRAW_MS + 500)
    expect(s.shots.map((x) => x.distance)).toEqual([30, 30, 30, 50, 50, 50, 70, 70, 70, 100])
    expect(s.sounds.at(-1)?.name).toBe('end')
    const sum = summarizeRound(s)
    expect(sum.points).toBe(s.shots.reduce((a, x) => a + x.score.points, 0))
  })
})

describe('한 발 제한 시간', () => {
  it('거리 안내 중에는 시간이 가지 않고, 당기기 대기부터 15초', () => {
    const s = createRound(0, 1)
    expect(shotClockLeft(s)).toBeNull()
    const r = ready(s)
    expect(shotClockLeft(r)).toBeGreaterThan(SHOT_CLOCK_MS - 100)
  })

  it('15초 안에 안 쏘면 0점(시간 초과)으로 넘어간다', () => {
    let s = ready(createRound(0, 1))
    const start = s.now
    s = tickUntil(s, (x) => x.phase.kind === 'scored')
    expect(s.now - start).toBeGreaterThanOrEqual(SHOT_CLOCK_MS)
    expect(s.shots[0]).toMatchObject({ impact: null, score: { points: 0, x: false } })
    expect(s.sounds.at(-1)?.name).toBe('miss')
    // 다음 화살은 다시 15초
    s = tickUntil(s, (x) => x.phase.kind === 'ready')
    expect(s.arrowIndex).toBe(1)
    expect(shotClockLeft(s)).toBeGreaterThan(SHOT_CLOCK_MS - 100)
  })

  it('당기는 중에 시간이 끝나면 그 자리에서 발사된다', () => {
    let s = ready(createRound(0, 1))
    const start = s.now
    // 시간이 2초 남았을 때 당기기 시작 → 자동 발사(10초)보다 먼저 제한 시간이 끝난다
    s = tickUntil(s, (x) => x.now - start >= SHOT_CLOCK_MS - 2000)
    s = roundReducer(s, { type: 'press', at: s.now })
    s = tickUntil(s, (x) => x.phase.kind === 'flying')
    expect(s.now - start).toBeGreaterThanOrEqual(SHOT_CLOCK_MS)
    expect(s.now - start).toBeLessThan(SHOT_CLOCK_MS + 100)
    if (s.phase.kind !== 'flying') return
    expect(s.phase.shot.impact).not.toBeNull()
  })

  it('쏘고 나면 시간 표시가 없다', () => {
    let s = ready(createRound(0, 1))
    s = roundReducer(s, { type: 'press', at: s.now })
    s = roundReducer(s, { type: 'release', at: s.now + DRAW_MS })
    expect(shotClockLeft(s)).toBeNull()
  })
})

describe('조준과 점수', () => {
  it('바람과 흔들림을 완벽히 보정하면 전부 X', () => {
    const hold = DRAW_MS + 400
    const sum = summarizeRound(playAll(7, hold, perfectAim(hold)))
    expect(sum.points).toBe(100)
    expect(sum.xCount).toBe(10)
  })

  it('보정 없이 가운데만 노리면 100점보다 낮다 (바람 때문에)', () => {
    let total = 0
    for (const seed of [1, 2, 3, 4, 5]) total += summarizeRound(playAll(seed, DRAW_MS + 400)).points
    expect(total / 5).toBeLessThan(90)
  })

  it('덜 당기고 쏘면 아래로 처져 점수가 낮다', () => {
    const full = summarizeRound(playAll(9, DRAW_MS + 400, perfectAim(DRAW_MS + 400))).points
    const weak = summarizeRound(playAll(9, DRAW_MS / 3)).points
    expect(weak).toBeLessThan(full - 30)
  })
})
