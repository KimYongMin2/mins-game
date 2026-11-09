import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { COLS, CRATER_R, DAMAGE_R, MAX_DAMAGE, TANK_CY, TERRAIN_MAX, TERRAIN_MIN } from '../constants'
import { blastDamage, carve, explode, heightAt, makeTerrain, simulateShot, tankCenter, tankTilt } from './physics'

const flat = (h = 30) => Array.from({ length: COLS + 1 }, () => h)

describe('지형', () => {
  it('정해진 높이 안에서 언덕이 생기고, 시드가 같으면 같은 지형', () => {
    for (let s = 1; s <= 20; s++) {
      const t = makeTerrain(createRng(s))
      expect(t).toHaveLength(COLS + 1)
      expect(Math.min(...t)).toBeGreaterThanOrEqual(TERRAIN_MIN)
      expect(Math.max(...t)).toBeLessThanOrEqual(TERRAIN_MAX)
      expect(Math.max(...t) - Math.min(...t)).toBeGreaterThan(10)
    }
    expect(makeTerrain(createRng(7))).toEqual(makeTerrain(createRng(7)))
  })

  it('사이 높이는 이어서, 땅을 파면 둥글게 꺼진다', () => {
    const t = flat()
    t[11] = 40
    expect(heightAt(t, 10.5)).toBeCloseTo(35)
    const c = carve(flat(), { x: 100, y: 30 })
    expect(c[100]).toBeCloseTo(30 - CRATER_R)
    expect(c[100 + CRATER_R + 1]).toBe(30)
    expect(c[103]).toBeGreaterThan(c[100])
  })
})

describe('포탄', () => {
  it('바람이 없으면 45도와 135도가 좌우 대칭으로 같은 거리에 떨어진다', () => {
    const t = flat()
    const tanks = [{ x: 100, alive: true }]
    const r = simulateShot(t, tanks, 0, 45, 60, 0)
    const l = simulateShot(t, tanks, 0, 135, 60, 0)
    expect(r.impact!.x - 100).toBeCloseTo(100 - l.impact!.x, 5)
    expect(r.impact!.y).toBeCloseTo(30)
  })

  it('힘이 셀수록 멀리, 바람은 바람 쪽으로 민다', () => {
    const t = flat()
    const tanks = [{ x: 20, alive: true }]
    const weak = simulateShot(t, tanks, 0, 45, 40, 0).impact!.x
    const strong = simulateShot(t, tanks, 0, 45, 60, 0).impact!.x
    expect(strong).toBeGreaterThan(weak)
    expect(simulateShot(t, tanks, 0, 45, 40, 6).impact!.x).toBeGreaterThan(weak)
    expect(simulateShot(t, tanks, 0, 45, 40, -6).impact!.x).toBeLessThan(weak)
  })

  it('대포에 바로 맞으면 거기서 터지고, 화면 밖이면 빗나감', () => {
    const t = flat()
    const tanks = [
      { x: 20, alive: true },
      { x: 120, alive: true },
    ]
    // 100칸 앞 대포를 맞히는 힘을 찾는다
    let hit = null
    for (let p = 30; p <= 100 && !hit; p++) {
      const s = simulateShot(t, tanks, 0, 45, p, 0)
      if (s.direct === 1) hit = s
    }
    expect(hit).not.toBeNull()
    expect(simulateShot(t, tanks, 0, 160, 100, 0).impact).toBeNull()
    // 죽은 대포는 안 맞는다
    const dead = [tanks[0], { x: 120, alive: false }]
    expect(simulateShot(t, dead, 0, 45, 60, 0).direct).toBeNull()
  })
})

describe('폭발', () => {
  it('가운데 맞으면 최대 피해, 멀수록 줄고 반경 밖은 0', () => {
    const c = { x: 50, y: 32 }
    expect(blastDamage(c, c)).toBe(MAX_DAMAGE)
    expect(blastDamage({ x: 50 + DAMAGE_R / 2, y: 32 }, c)).toBe(Math.round(MAX_DAMAGE / 2))
    expect(blastDamage({ x: 50 + DAMAGE_R, y: 32 }, c)).toBe(0)
  })

  it('땅이 파이면 발밑이 꺼진 대포는 떨어져 더 다치고, 바닥까지 꺼지면 탈락', () => {
    const t = flat(30)
    const tanks = [{ x: 100, alive: true }]
    const b = explode(t, tanks, { x: 100, y: 30 })
    // 폭발 피해(가운데에서 TANK_CY 떨어짐) + 떨어짐 피해 (7칸 떨어짐 → 2칸 넘게)
    expect(b.damage[0]).toBeGreaterThan(blastDamage({ x: 100, y: 30 }, tankCenter(t, 100)))
    expect(b.fell).toEqual([])
    const shallow = flat(5)
    expect(explode(shallow, tanks, { x: 100, y: 5 }).fell).toEqual([0])
  })
})

describe('대포 기울기', () => {
  it('평지면 0, 오르막이면 그쪽으로 기울고 포탑도 기운 쪽으로 옮겨진다', () => {
    const flat50 = flat(50)
    expect(tankTilt(flat50, 100)).toBe(0)
    expect(tankCenter(flat50, 100)).toEqual({ x: 100, y: 50 + TANK_CY })
    const up = Array.from({ length: COLS + 1 }, (_, i) => 20 + i * 0.5) // 오른쪽이 높음
    const tilt = tankTilt(up, 100)
    expect(tilt).toBeCloseTo(Math.atan(0.5), 5)
    expect(tankCenter(up, 100).x).toBeLessThan(100)
  })
})
