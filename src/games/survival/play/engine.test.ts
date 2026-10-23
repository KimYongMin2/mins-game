import { describe, expect, it } from 'vitest'
import { AFTER_SHOT_MS, COUNTDOWN_MS, LASER_SPEED, PIECE_R, PLAN_MS, SHOT_AT } from '../constants'
import { type EngineState, type Player, aliveIndexes, createEngine, engineReducer, hitAtOf, ranksOf } from './engine'

const people = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}`, kind: i === 0 ? 'user' : 'remote' }))
const bots = (n: number): Player[] => [{ id: 'me', name: '나', kind: 'user' }, ...Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `봇${i}`, kind: 'bot' as const }))]

const tick = (s: EngineState, now: number) => engineReducer(s, { type: 'tick', now })
// 자리를 정해 두고 보는 테스트라 엄폐물은 치운다
const toPlan = (s: EngineState) => tick({ ...s, walls: [] }, COUNTDOWN_MS)
const lockAt = (s: EngineState, player: number, x: number, y: number, angle: number) =>
  engineReducer(s, { type: 'plan', player, plan: { pos: { x, y }, angle, locked: true } })

describe('라운드', () => {
  it('안내 → 고르기 → 모두 확정하면 바로 공개', () => {
    let s = createEngine({ now: 0, seed: 1, players: people(2) })
    expect(s.phase.kind).toBe('countdown')
    s = toPlan(s)
    expect(s.phase.kind).toBe('plan')
    s = lockAt(s, 0, -20, 0, Math.PI / 2)
    s = tick(s, COUNTDOWN_MS + 100)
    expect(s.phase.kind).toBe('plan')
    s = lockAt(s, 1, 20, 0, Math.PI / 2)
    s = tick(s, COUNTDOWN_MS + 200)
    expect(s.phase.kind).toBe('reveal')
  })

  it('처음 맞은 한 명만 탈락, 쏜 사람 킬 +1', () => {
    let s = toPlan(createEngine({ now: 0, seed: 1, players: people(3) }))
    s = lockAt(s, 0, -30, 0, 0) // → 오른쪽으로: 1번(-10,0)이 먼저, 2번(10,0)은 뒤
    s = lockAt(s, 1, -10, 0, Math.PI / 2) // 위로 (아무도 없음)
    s = lockAt(s, 2, 10, 0, Math.PI / 2)
    s = tick(s, COUNTDOWN_MS + 1)
    expect(s.lastReveal?.dead).toEqual([1])
    // 레이저는 일정한 속도: 1번까지 약 16(20 − 반지름) → 그때 맞음, 2번 쪽 레이저 없음
    expect(hitAtOf(s.lastReveal!, 1)).toBeCloseTo(SHOT_AT + 16 / LASER_SPEED)
    expect(hitAtOf(s.lastReveal!, 2)).toBeNull()
    // 공개는 가장 긴 레이저가 멈춘 뒤 AFTER_SHOT_MS까지
    expect(s.lastReveal!.ms).toBeCloseTo(SHOT_AT + Math.sqrt(s.half * s.half - 10 * 10) / LASER_SPEED + AFTER_SHOT_MS)
    s = tick(s, COUNTDOWN_MS + 1 + s.lastReveal!.ms - 1)
    expect(s.phase.kind).toBe('reveal')
    s = tick(s, COUNTDOWN_MS + 1 + s.lastReveal!.ms)
    expect(s.alive).toEqual([true, false, true])
    expect(s.kills).toEqual([1, 0, 0])
    expect(s.round).toBe(2)
    expect(s.phase.kind).toBe('countdown')
  })

  it('서로 쏘면 둘 다 맞지만, 남은 사람이 모두 맞으면 무효', () => {
    let s = toPlan(createEngine({ now: 0, seed: 1, players: people(2) }))
    s = lockAt(s, 0, -20, 0, 0)
    s = lockAt(s, 1, 20, 0, Math.PI)
    s = tick(s, COUNTDOWN_MS + 1)
    expect(s.lastReveal?.voided).toBe(true)
    s = tick(s, COUNTDOWN_MS + 1 + s.lastReveal!.ms)
    expect(s.alive).toEqual([true, true])
    expect(s.round).toBe(2)
  })

  it('시간이 지나면 안 고른 건 무작위로 채워 공개', () => {
    let s = toPlan(createEngine({ now: 0, seed: 7, players: people(3) }))
    s = engineReducer(s, { type: 'plan', player: 0, plan: { pos: { x: 5, y: 5 }, angle: null, locked: false } })
    s = tick(s, COUNTDOWN_MS + PLAN_MS)
    expect(s.phase.kind).toBe('reveal')
    expect(s.lastReveal?.positions[0]).toEqual({ x: 5, y: 5 })
    expect(s.lastReveal?.positions.every((p) => p !== null)).toBe(true)
  })

  it('확정하면 못 바꾸고, 자리는 맵 안으로', () => {
    let s = toPlan(createEngine({ now: 0, seed: 1, players: people(2) }))
    s = lockAt(s, 0, 999, 0, 0)
    expect(s.plans[0]?.pos?.x).toBeLessThan(s.half)
    s = lockAt(s, 0, 0, 0, 1)
    expect(s.plans[0]?.angle).toBe(0)
  })

  it('맵은 남은 사람 수로: 탈락자가 나온 다음 라운드에 줄고, 안 나오면 그대로', () => {
    let s = toPlan(createEngine({ now: 0, seed: 1, players: people(4) }))
    expect(s.half).toBe(40)
    s = lockAt(s, 0, -30, 0, 0)
    s = lockAt(s, 1, -10, 0, Math.PI / 2)
    s = lockAt(s, 2, 10, 20, Math.PI / 2)
    s = lockAt(s, 3, 10, -20, -Math.PI / 2)
    s = tick(s, COUNTDOWN_MS + 1)
    s = tick(s, COUNTDOWN_MS + 1 + s.lastReveal!.ms)
    expect(s.alive.filter(Boolean)).toHaveLength(3)
    expect(s.half).toBe(35)
  })

  it('나가면 탈락, 한 명 남으면 끝', () => {
    let s = toPlan(createEngine({ now: 0, seed: 1, players: people(2) }))
    s = engineReducer(s, { type: 'drop', player: 1 })
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)).toEqual([1, 2])
  })
})

describe('엄폐물', () => {
  it('라운드마다 새로 짓고, 벽 뒤에 숨으면 안 맞는다', () => {
    let s = createEngine({ now: 0, seed: 3, players: people(2) })
    expect(s.walls.length).toBe(1)
    const first = s.walls
    s = tick({ ...s, walls: [{ x: 0, y: 0, w: 12, h: 3, angle: Math.PI / 2 }] }, COUNTDOWN_MS)
    s = lockAt(s, 0, -20, 0, 0)
    s = lockAt(s, 1, 20, 0, Math.PI / 2)
    s = tick(s, COUNTDOWN_MS + 1)
    expect(s.lastReveal?.dead).toEqual([])
    expect(s.lastReveal?.shots[0].end.x).toBeCloseTo(-1.5)
    s = tick(s, COUNTDOWN_MS + 1 + s.lastReveal!.ms)
    expect(s.round).toBe(2)
    expect(s.walls).not.toEqual(first)
  })

  it('벽 안에는 설 수 없다', () => {
    let s = createEngine({ now: 0, seed: 3, players: people(2) })
    s = tick({ ...s, walls: [{ x: 0, y: 0, w: 12, h: 3, angle: 0 }] }, COUNTDOWN_MS)
    s = lockAt(s, 0, 1, 0.5, 0)
    expect(Math.abs(s.plans[0]!.pos!.y)).toBeGreaterThanOrEqual(1.5 + PIECE_R - 1e-9)
  })
})

describe('봇끼리 끝까지', () => {
  it('2~6명 모두 한 명이 우승한다', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        // 나도 봇처럼: 아무것도 안 고르면 무작위로 채워진다
        let s = createEngine({ now: 0, seed, players: bots(n) })
        let now = 0
        while (s.phase.kind !== 'done' && now < 3_000_000) {
          now += 50
          s = tick(s, now)
        }
        expect(s.phase.kind).toBe('done')
        expect(aliveIndexes(s)).toHaveLength(1)
        expect(ranksOf(s).filter((r) => r === 1)).toHaveLength(1)
      }
    }
  })
})
