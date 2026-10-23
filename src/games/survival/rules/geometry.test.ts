import { describe, expect, it } from 'vitest'
import { PIECE_R } from '../constants'
import { createRng } from '../../../shared/random'
import { clampToArena, edgeOf, halfOf, randomInArena, shoot } from './geometry'

describe('맵', () => {
  it('라운드마다 줄고 5라운드 뒤로는 그대로', () => {
    expect(halfOf(1)).toBeGreaterThan(halfOf(2))
    expect(halfOf(4)).toBeGreaterThan(halfOf(5))
    expect(halfOf(6)).toBe(halfOf(5))
    expect(halfOf(20)).toBe(halfOf(5))
  })

  it('말은 둥근 맵 안쪽으로', () => {
    const p = clampToArena({ x: 100, y: -100 }, 30)
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(30 - PIECE_R)
    expect(p.x).toBeCloseTo(-p.y)
    expect(clampToArena({ x: 3, y: 4 }, 30)).toEqual({ x: 3, y: 4 })
  })

  it('무작위 자리도 맵 안', () => {
    const rng = createRng(3)
    for (let i = 0; i < 200; i++) {
      const p = randomInArena(rng, 20)
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(20 - PIECE_R + 1e-9)
    }
  })

  it('맵 끝 (원과 만나는 곳)', () => {
    const e = edgeOf({ x: 0, y: 0 }, 0, 50)
    expect(e.x).toBeCloseTo(50)
    expect(e.y).toBeCloseTo(0)
    const d = edgeOf({ x: 10, y: 0 }, Math.PI / 2, 50)
    expect(d.x).toBeCloseTo(10)
    expect(d.y).toBeCloseTo(Math.sqrt(50 * 50 - 100))
    const back = edgeOf({ x: 30, y: 0 }, Math.PI, 50)
    expect(back.x).toBeCloseTo(-50)
  })
})

describe('총알', () => {
  it('일자 위에 있으면 맞고, 처음 맞은 한 명에서 멈춘다', () => {
    const targets = [
      { player: 1, pos: { x: 30, y: 0 } },
      { player: 2, pos: { x: 15, y: 2 } },
      { player: 3, pos: { x: 20, y: 10 } },
    ]
    const r = shoot({ x: 0, y: 0 }, 0, targets, 50)
    expect(r.hit).toBe(2)
    expect(r.end.x).toBeLessThan(15)
  })

  it('반지름 밖이면 안 맞고 맵 끝까지', () => {
    const r = shoot({ x: 0, y: 0 }, 0, [{ player: 1, pos: { x: 20, y: PIECE_R + 0.5 } }], 50)
    expect(r.hit).toBeNull()
    expect(r.end.x).toBeCloseTo(50)
  })

  it('뒤쪽은 안 맞는다', () => {
    expect(shoot({ x: 0, y: 0 }, 0, [{ player: 1, pos: { x: -10, y: 0 } }], 50).hit).toBeNull()
  })

  it('비스듬히 쏴도 맞는다', () => {
    expect(shoot({ x: -20, y: -20 }, Math.PI / 4, [{ player: 1, pos: { x: 10, y: 11 } }], 50).hit).toBe(1)
  })
})
