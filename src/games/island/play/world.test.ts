import { describe, expect, it } from 'vitest'
import { BotDriver } from '../bot/islandBot'
import { TEAM_SIZE, W, WATER } from '../constants'
import { NO_KEYS, World, chargePower } from './world'

function playOut(seed: number, maxSteps = 60 * 60 * 25) {
  const w = new World(seed)
  const bots = [new BotDriver('hard', seed + 1), new BotDriver('hard', seed + 2)]
  let steps = 0
  while (!w.winner && steps < maxSteps) {
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

  it('시간이 다 되면 다음 차례', () => {
    const w = new World(5)
    const team = w.team
    for (let i = 0; i < 45 * 60 + 200; i++) w.step(NO_KEYS)
    expect(w.team).not.toBe(team)
  })

  it('봇끼리 하면 끝까지 가서 승자가 나온다', () => {
    for (const seed of [1, 2]) {
      const { w } = playOut(seed)
      expect(w.winner).not.toBeNull()
      expect(w.animals.every((a) => a.x > -200 && a.x < W + 200)).toBe(true)
    }
  }, 60_000)
})
