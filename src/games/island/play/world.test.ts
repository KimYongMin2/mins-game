import { describe, expect, it } from 'vitest'
import { BotDriver } from '../bot/islandBot'
import { AMMO, FLOOD_ROUNDS, MOVE_MAX, TEAM_SIZE, W, WATER } from '../constants'
import { NO_KEYS, World, chargePower } from './world'

function playOut(seed: number, maxSteps = 60 * 60 * 25) {
  const w = new World(seed)
  const bots = [new BotDriver('hard', seed + 1), new BotDriver('hard', seed + 2)]
  let steps = 0
  while (w.winner === null && steps < maxSteps) {
    bots[w.team].step(w)
    w.step(NO_KEYS)
    w.fx.length = 0
    w.carves.length = 0
    steps++
  }
  return { w, steps }
}

describe('동물 섬 대작전 엔진', () => {
  it('같은 씨앗값이면 같은 섬, 동물은 모두 땅 위 물 밖에서 시작', () => {
    const a = new World(7)
    const b = new World(7)
    expect(a.mask).toEqual(b.mask)
    expect(a.animals.length).toBe(TEAM_SIZE * 2)
    for (const x of a.animals) {
      expect(x.alive).toBe(true)
      expect(x.y).toBeLessThan(WATER)
      expect(x.air).toBe(false)
    }
  })

  it('힘 막대는 0 → 1 → 0으로 오간다', () => {
    expect(chargePower(0)).toBe(0)
    expect(chargePower(75)).toBeCloseTo(1)
    expect(chargePower(150)).toBeCloseTo(0)
  })

  it('물풍선이 터지면 땅이 파이고 가까운 동물이 다친다', () => {
    const w = new World(3)
    const me = w.active
    const foe = w.animals.find((a) => a.team !== me.team)!
    // 상대 바로 위에서 떨어뜨림
    w.projs.push({ kind: 'balloon', x: foe.x, y: foe.y - 80, vx: 0, vy: 2, t: 20, owner: me.id, dead: false })
    w.phase = 'flying'
    for (let i = 0; i < 200; i++) w.step(NO_KEYS)
    expect(foe.hp).toBeLessThan(100)
    expect(w.carves.length).toBeGreaterThan(0)
  })

  it('낚싯대·두더지 삽을 쓰면 그 차례가 끝난다', () => {
    const w = new World(11)
    const turn = w.turnNo
    w.pick('drill')
    w.fire()
    for (let i = 0; i < 400 && w.turnNo === turn; i++) w.step(NO_KEYS)
    expect(w.turnNo).toBe(turn + 1)
    const turn2 = w.turnNo
    w.pick('rod')
    w.fire()
    for (let i = 0; i < 400 && w.turnNo === turn2; i++) w.step(NO_KEYS)
    expect(w.turnNo).toBe(turn2 + 1)
  })

  it('걸음 막대만큼만 걷고, 다 쓰면 못 걷는다', () => {
    const w = new World(4)
    const right = { ...NO_KEYS, right: true }
    const left = { ...NO_KEYS, left: true }
    for (let i = 0; i < 600; i++) w.step(i % 120 < 60 ? right : left)
    expect(w.move).toBe(0)
    const x = w.active.x
    for (let i = 0; i < 60; i++) w.step(right)
    expect(w.active.x).toBe(x)
    expect(MOVE_MAX).toBeGreaterThan(0)
  })

  it('무기 개수가 다 떨어지면 못 고른다', () => {
    const w = new World(6)
    const team = w.team
    w.pick('gull')
    w.fire()
    expect(w.ammoLeft('gull', team)).toBe(AMMO.gull - 1)
    w.ammo[team].pine = 0
    for (let i = 0; i < 2000 && w.team === team; i++) w.step(NO_KEYS)
    for (let i = 0; i < 4000 && w.team !== team; i++) w.step(NO_KEYS)
    w.pick('pine')
    expect(w.weapon).not.toBe('pine')
  })

  it('보급 상자에 닿으면 그 편이 무기를 얻는다', () => {
    const w = new World(8)
    const a = w.active
    w.crates.push({ id: 99, kind: 'drill', x: a.x, y: a.y - 200, vy: 0, air: true })
    const before = w.ammoLeft('drill', a.team)
    for (let i = 0; i < 400 && w.crates.length; i++) w.step(NO_KEYS)
    expect(w.crates.length).toBe(0)
    expect(w.ammoLeft('drill', a.team)).toBe(before + 1)
  })

  it('후반엔 차례가 끝날 때마다 바닷물이 차오른다', () => {
    const w = new World(5)
    for (let i = 0; i < 60 * 60 * 20 && w.turnNo <= FLOOD_ROUNDS * 2 + 1 && w.winner === null; i++) w.step(NO_KEYS)
    expect(w.water).toBeLessThan(WATER)
  })

  it('시간이 다 되면 다음 차례', () => {
    const w = new World(5)
    const team = w.team
    for (let i = 0; i < 45 * 60 + 200; i++) w.step(NO_KEYS)
    expect(w.team).not.toBe(team)
  })

  it('편이 넷이면 동물 열둘, 봇끼리 끝까지', () => {
    const w = new World(9, 4)
    expect(w.animals.length).toBe(TEAM_SIZE * 4)
    expect(new Set(w.animals.map((a) => a.team)).size).toBe(4)
    const bots = [0, 1, 2, 3].map((i) => new BotDriver('hard', i + 50))
    let steps = 0
    while (w.winner === null && steps++ < 60 * 60 * 40) {
      bots[w.team].step(w)
      w.step(NO_KEYS)
      w.fx.length = 0
      w.carves.length = 0
    }
    expect(w.winner).not.toBeNull()
  }, 60_000)

  it('봇끼리 하면 끝까지 가서 승자가 나온다', () => {
    for (const seed of [1, 2]) {
      const { w } = playOut(seed)
      expect(w.winner).not.toBeNull()
      expect(w.animals.every((a) => a.x > -200 && a.x < W + 200)).toBe(true)
    }
  }, 60_000)
})
