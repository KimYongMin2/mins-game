import { describe, expect, it } from 'vitest'
import { EDGE, FRICTION, MAX_SPEED } from '../constants'
import { type Stone, flipIndex, flipStones, initialStones, remaining, simulate } from './physics'
import { judgeShot } from './turn'

const stone = (side: 0 | 1, x: number, y: number): Stone => ({ side, x, y, on: true })

describe('물리', () => {
  it('마찰로 멈춘다: 이동 거리 ≈ v²/2a', () => {
    const { final } = simulate([stone(0, 0, 7)], 0, 6, 0)
    expect(final[0].x).toBeCloseTo(36 / (2 * FRICTION), 0)
  })

  it('약하게 정면으로 맞히면 친 돌은 거의 멈추고 맞은 돌이 받아 간다', () => {
    const { final, events } = simulate([stone(0, 3, 7), stone(1, 6, 7)], 0, 6, 0)
    expect(events.some((e) => e.kind === 'hit')).toBe(true)
    expect(final[1].x - 6).toBeGreaterThan(0.5)
    expect(final[0].x).toBeLessThan(5.3)
  })

  it('세게 맞히면 친 돌도 계속 날아가 같이 떨어질 수 있다', () => {
    const { final } = simulate([stone(0, 7, 11), stone(1, 7, 3)], 0, 0, -MAX_SPEED)
    expect(final[1].on).toBe(false)
    expect(final[0].on).toBe(false)
  })

  it('판 끝 밖으로 나가면 떨어진다', () => {
    const { final, events } = simulate([stone(0, 12, 7)], 0, MAX_SPEED, 0)
    expect(final[0].on).toBe(false)
    expect(events.at(-1)?.kind).toBe('fall')
    expect(EDGE.max).toBeLessThan(15)
  })

  it('처음 배치: 5개씩, 친구 시점으로 돌려도 같은 배치', () => {
    const s = initialStones()
    expect(remaining(s, 0)).toBe(5)
    expect(remaining(s, 1)).toBe(5)
    expect(flipStones(s)).toEqual(s)
    expect(flipStones(flipStones([...s.slice(0, 9), { ...s[9], x: 1.5, on: false }]))[9]).toMatchObject({ x: 1.5, on: false })
    expect(flipIndex(2, 10)).toBe(7)
  })
})

describe('판정', () => {
  const before = [stone(0, 7, 11), stone(0, 9, 11), stone(1, 7, 3)]
  it('상대 돌을 떨어뜨리고 내 돌이 남으면 한 번 더', () => {
    const after = [stone(0, 7, 5), stone(0, 9, 11), { ...stone(1, 7, 3), on: false }]
    // 상대가 0개가 되면 끝
    expect(judgeShot(before, after, 0, 0)).toEqual({ kind: 'over', winner: 0 })
    const b2 = [...before, stone(1, 3, 3)]
    const a2 = [...after, stone(1, 3, 3)]
    expect(judgeShot(b2, a2, 0, 0)).toEqual({ kind: 'again' })
    // 튕긴 돌도 떨어지면 한 번 더 없음
    expect(judgeShot(b2, [{ ...a2[0], on: false }, ...a2.slice(1)], 0, 0)).toEqual({ kind: 'next' })
  })

  it('둘 다 다 떨어지면 무승부, 내 돌만 다 떨어지면 패배', () => {
    const one = [stone(0, 7, 11), stone(1, 7, 3)]
    expect(judgeShot(one, one.map((s) => ({ ...s, on: false })), 0, 0)).toEqual({ kind: 'over', winner: 'draw' })
    expect(judgeShot(one, [{ ...one[0], on: false }, one[1]], 0, 0)).toEqual({ kind: 'over', winner: 1 })
  })
})
