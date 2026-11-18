import { describe, expect, it } from 'vitest'
import { BEDS, BOATS, HOUSES, LADDERS, boatable, houseAt, landingSpot, moveBoat, nearLadder, onLadderTop, BRIDGE, JETTY, LAKE, LAKE_DOCK, PIER, PIER_END, SPAWN, blocked, castTarget, moveBy, shoreZ, walkable, waterAt } from './map'
import { FISH, rollCatch } from './fish'

describe('낚시터 맵', () => {
  it('바다·민물·땅', () => {
    expect(waterAt(0, -20)).toBe('sea')
    expect(waterAt(LAKE.x, LAKE.z)).toBe('fresh')
    expect(waterAt(SPAWN.x, SPAWN.z)).toBeNull()
    expect(walkable(SPAWN.x, SPAWN.z)).toBe(true)
    expect(walkable(0, -20)).toBe(false)
    // 부두·방파제·다리·호수 선착장 위는 물 위지만 걸을 수 있음
    expect(walkable((PIER.minX + PIER.maxX) / 2, -20)).toBe(true)
    expect(walkable(-30, -37)).toBe(true)
    expect(walkable((JETTY.minX + JETTY.maxX) / 2, -20)).toBe(true)
    expect(waterAt(35.6, -7.6)).toBe('fresh')
    expect(walkable(35.6, (BRIDGE.minZ + BRIDGE.maxZ) / 2)).toBe(true)
    expect(walkable(35.6, BRIDGE.minZ - 0.5)).toBe(false)
    expect(walkable(LAKE_DOCK.minX + 4, (LAKE_DOCK.minZ + LAKE_DOCK.maxZ) / 2)).toBe(true)
  })

  it('구조물은 막히고, 처음 자리·썬베드는 안 막힘', () => {
    // 집 벽은 막히고, 문으로 들어가면 안을 걸을 수 있음
    for (const h of HOUSES) {
      const wall = h.walls[0]
      expect(walkable((wall.minX + wall.maxX) / 2, (wall.minZ + wall.maxZ) / 2)).toBe(false)
      // 문 앞(북쪽 바깥)에서 남쪽으로 걸어 들어가기
      let p = { x: h.s.x, z: h.s.z - h.s.d! / 2 - 1.2 }
      expect(walkable(p.x, p.z)).toBe(true)
      for (let i = 0; i < 20; i++) p = moveBy(p.x, p.z, 0, 0.15)
      expect(houseAt(p.x, p.z)).toBe(HOUSES.indexOf(h))
    }
    expect(blocked(SPAWN.x, SPAWN.z)).toBe(false)
    for (const b of BEDS) expect(blocked(b.x, b.z)).toBe(false)
    // 구조물이 물가를 따라 걷는 길을 막지 않음 (모래사장 가로질러 걷기)
    let p = { x: -45, z: 11 }
    for (let i = 0; i < 400; i++) p = moveBy(p.x, p.z, 0.25, 0)
    expect(p.x).toBeGreaterThan(20)
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
    // 부두 끝·방파제: 바다, 찌는 판자 위가 아니라 물에
    const end = castTarget(-30, PIER_END.minZ + 0.5, Math.PI)
    expect(end?.zone).toBe('sea')
    expect(end!.bob[1]).toBeLessThan(PIER_END.minZ)
    expect(castTarget(JETTY.minX + 0.5, -20, -Math.PI / 2)?.zone).toBe('sea')
    // 호숫가·다리 위: 민물
    expect(castTarget(LAKE.x - LAKE.r - 1, LAKE.z + 3, Math.PI / 2)?.zone).toBe('fresh')
    expect(castTarget(35.6, BRIDGE.minZ + 0.4, Math.PI)?.zone).toBe('fresh')
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

  it('사다리: 아래에서 오르고 위에서만 다님', () => {
    for (const [i, l] of LADDERS.entries()) {
      expect(walkable(l.foot.x, l.foot.z)).toBe(true)
      expect(nearLadder(l.foot.x, l.foot.z)).toBe(i)
      expect(onLadderTop(i, l.top.x, l.top.z)).toBe(true)
    }
    // 등대 위에서 바다로 던질 수 있음
    const l = LADDERS[1]
    expect(castTarget(l.top.x - 1.3, l.area.kind === 'ring' ? l.area.z : 0, -Math.PI / 2)?.zone).toBe('sea')
  })

  it('배: 제자리는 물 위, 땅으로는 못 가고, 물가에서 내릴 곳이 있음', () => {
    for (const b of BOATS) expect(boatable(b.x, b.z, b.zone)).toBe(true)
    const b = BOATS[0]
    let p = { x: b.x, z: b.z }
    for (let i = 0; i < 200; i++) p = moveBoat(p.x, p.z, 0, 0.2, 'sea')
    expect(boatable(p.x, p.z, 'sea')).toBe(true)
    expect(p.z).toBeLessThan(shoreZ(p.x))
    expect(landingSpot(p.x, p.z)).not.toBeNull()
    expect(landingSpot(0, -30)).toBeNull()
    // 호수 배는 바다로 못 감
    expect(boatable(BOATS[3].x, BOATS[3].z, 'sea')).toBe(false)
  })
})
