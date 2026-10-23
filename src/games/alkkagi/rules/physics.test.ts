import { describe, expect, it } from 'vitest'
import { EDGE, FRICTION, MAX_SPEED, RADIUS } from '../constants'
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
    expect(final[1].x - 6).toBeGreaterThan(0.3)
    expect(final[0].x).toBeLessThan(5.3)
  })

  it('세게 빗겨 맞히면 친 돌도 옆으로 날아가 판 끝 근처면 같이 떨어진다', () => {
    // 가운데에서: 친 돌이 옆으로 몇 칸 날아감
    const mid = simulate([stone(0, 7, 11), stone(1, 7.4, 7)], 0, 0, -MAX_SPEED).final
    expect(7 - mid[0].x).toBeGreaterThan(2)
    // 왼쪽 끝 근처에서: 같이 떨어짐
    const edge = simulate([stone(0, 1.5, 11), stone(1, 1.9, 7)], 0, 0, -MAX_SPEED).final
    expect(edge[1].on).toBe(false)
    expect(edge[0].on).toBe(false)
  })

  it('맞은 돌은 닿은 순간 두 돌 가운데를 잇는 방향으로 간다 (빨라도 각도가 안 틀어짐)', () => {
    for (const speed of [4, 10, MAX_SPEED]) {
      for (const b of [0.2, 0.5, 0.75]) {
        const { final } = simulate([stone(0, 4.6, 7), stone(1, 6, 7 + b)], 0, speed, 0)
        const got = Math.atan2(final[1].y - 7 - b, final[1].x - 6)
        const want = Math.atan2(b, Math.sqrt((2 * RADIUS) ** 2 - b * b))
        expect(Math.abs(got - want)).toBeLessThan(0.01)
      }
    }
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
  it('떨어뜨려도 한 번 더 없이 번갈아', () => {
    const after = [stone(0, 7, 5), { ...stone(1, 7, 3), on: false }, stone(1, 3, 3)]
    expect(judgeShot(after, 0)).toEqual({ kind: 'next' })
  })

  it('상대가 다 떨어지면 승리, 둘 다 다 떨어지면 무승부, 내 돌만 다 떨어지면 패배', () => {
    const one = [stone(0, 7, 11), stone(1, 7, 3)]
    expect(judgeShot([one[0], { ...one[1], on: false }], 0)).toEqual({ kind: 'over', winner: 0 })
    expect(judgeShot(one.map((s) => ({ ...s, on: false })), 0)).toEqual({ kind: 'over', winner: 'draw' })
    expect(judgeShot([{ ...one[0], on: false }, one[1]], 0)).toEqual({ kind: 'over', winner: 1 })
  })
})
