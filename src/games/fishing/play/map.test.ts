import { describe, expect, it } from 'vitest'
import { BEDS, PIER, POND, SPAWN, castTarget, moveBy, shoreZ, walkable, waterAt } from './map'
import { FISH, rollCatch } from './fish'

describe('낚시터 맵', () => {
  it('바다·민물·땅', () => {
    expect(waterAt(0, -12)).toBe('sea')
    expect(waterAt(POND.x, POND.z)).toBe('fresh')
    expect(waterAt(SPAWN.x, SPAWN.z)).toBeNull()
    expect(walkable(SPAWN.x, SPAWN.z)).toBe(true)
    expect(walkable(0, -12)).toBe(false)
    // 부두 위는 바다 위지만 걸을 수 있음
    expect(walkable((PIER.minX + PIER.maxX) / 2, -14)).toBe(true)
  })

  it('물에는 못 들어가고 미끄러짐', () => {
    const z0 = shoreZ(0) + 0.3
    const p = moveBy(0, z0, 0.2, -1)
    expect(p.z).toBe(z0)
    expect(p.x).toBeCloseTo(0.2)
  })

  it('물가에선 던질 수 있고, 바라보는 쪽 물에 찌가 떨어짐', () => {
    const t = castTarget(0, shoreZ(0) + 1, Math.PI)
    expect(t?.zone).toBe('sea')
    expect(waterAt(t!.bob[0], t!.bob[1])).toBe('sea')
    expect(castTarget(SPAWN.x, SPAWN.z + 8, 0)).toBeNull()
    // 부두 끝: 바다
    expect(castTarget(-13.5, -16.5, Math.PI)?.zone).toBe('sea')
    // 연못가: 민물
    expect(castTarget(POND.x - POND.r - 1, POND.z, Math.PI / 2)?.zone).toBe('fresh')
  })

  it('썬베드에 누워서도 물에 닿음', () => {
    for (const b of BEDS) expect(castTarget(b.x, b.z, b.r)).not.toBeNull()
  })

  it('잡히는 물고기는 그 물가에 사는 것, 크기는 범위 안', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const seen = { sea: new Set<string>(), fresh: new Set<string>() }
    for (const zone of ['sea', 'fresh'] as const) {
      for (let i = 0; i < 20000; i++) {
        const c = rollCatch(rand, zone)
        const f = FISH.find((x) => x.id === c.fish)!
        expect(f.zone === zone || f.zone === 'both').toBe(true)
        if (f.rarity !== 'junk') expect(c.size).toBeGreaterThanOrEqual(f.min)
        if (f.rarity !== 'junk') expect(c.size).toBeLessThanOrEqual(f.max)
        seen[zone].add(c.fish)
      }
    }
    expect(seen.sea.has('coelacanth')).toBe(true)
    expect(seen.fresh.has('sturgeon')).toBe(true)
  })
})
