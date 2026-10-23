import { describe, expect, it } from 'vitest'
import { PIECE_R } from '../constants'
import { createRng } from '../../../shared/random'
import { clampToArena, edgeOf, halfFor, makeWalls, placeAt, randomInArena, randomSpot, shoot } from './geometry'

describe('맵', () => {
  it('남은 사람이 적을수록 작고, 둘이면 적당히 넓게', () => {
    expect(halfFor(6)).toBe(50)
    expect(halfFor(5)).toBeGreaterThan(halfFor(4))
    expect(halfFor(3)).toBeGreaterThan(halfFor(2))
    expect(halfFor(2)).toBe(30)
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

describe('엄폐물', () => {
  const wall = { x: 10, y: 0, w: 12, h: 3, angle: Math.PI / 2 } // x=10에 세로로 선 벽

  it('벽에 먼저 닿으면 거기서 멈추고 뒤에 있는 사람은 안 맞는다', () => {
    const r = shoot({ x: 0, y: 0 }, 0, [{ player: 1, pos: { x: 25, y: 0 } }], 50, [wall])
    expect(r.hit).toBeNull()
    expect(r.end.x).toBeCloseTo(8.5)
  })

  it('벽 옆으로 비껴가면 맞는다, 벽보다 앞에 있으면 맞는다', () => {
    expect(shoot({ x: 0, y: 10 }, 0, [{ player: 1, pos: { x: 25, y: 10 } }], 50, [wall]).hit).toBe(1)
    expect(shoot({ x: 0, y: 0 }, 0, [{ player: 1, pos: { x: 5, y: 0 } }], 50, [wall]).hit).toBe(1)
  })

  it('벽 안에 찍으면 바깥으로 밀려난다', () => {
    const p = placeAt({ x: 10.5, y: 1 }, 50, [wall])
    expect(p.x - 10).toBeGreaterThanOrEqual(1.5 + PIECE_R - 1e-9)
  })

  it('맵 크기에 맞춰 1~3개, 서로 떨어지고 맵 안에', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const half of [50, 40, 30]) {
        const walls = makeWalls(createRng(seed), half)
        expect(walls.length).toBe(half === 50 ? 3 : half === 40 ? 2 : 1)
        for (const w of walls) expect(Math.hypot(w.x, w.y) + w.w / 2).toBeLessThanOrEqual(half)
        const rng = createRng(seed)
        for (let k = 0; k < 20; k++) {
          const p = randomSpot(rng, half, walls)
          expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(half - PIECE_R + 1e-9)
        }
      }
    }
  })
})
