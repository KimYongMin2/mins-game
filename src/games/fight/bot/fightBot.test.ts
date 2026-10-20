import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import type { Fighter, Stance } from '../rules/turn'
import { chooseBotStance } from './fightBot'

const f = (stacks: number): Fighter => ({ life: 3, stacks })

function sample(difficulty: 'normal' | 'hard', self: Fighter, foe: Fighter, foeHistory: Stance[] = [], n = 2000) {
  const rng = createRng(42)
  const count: Record<Stance, number> = { ready: 0, guard: 0, attack: 0, smash: 0 }
  for (let i = 0; i < n; i++) count[chooseBotStance({ rng, difficulty, self, foe, foeHistory })]++
  return count
}

describe('chooseBotStance', () => {
  it('스택이 모자라면 절대 공격하지 않는다 (타격 1개, 강타 3개)', () => {
    expect(sample('normal', f(0), f(1)).attack).toBe(0)
    expect(sample('hard', f(0), f(2)).attack).toBe(0)
    for (const s of [0, 1, 2]) {
      expect(sample('normal', f(s), f(1)).smash).toBe(0)
      expect(sample('hard', f(s), f(3)).smash).toBe(0)
    }
  })

  it('일반: 스택 3개면 자주 강타', () => {
    expect(sample('normal', f(3), f(0)).smash).toBeGreaterThan(1000)
  })

  it('어려움: 상대가 강타를 노리면(스택 3) 나도 3개면 거의 강타로 맞선다', () => {
    expect(sample('hard', f(3), f(3)).smash).toBeGreaterThan(1400)
  })

  it('어려움: 상대가 칠 수 없으면(스택 0) 방어하지 않는다', () => {
    expect(sample('hard', f(1), f(0)).guard).toBe(0)
  })

  it('어려움: 상대가 준비를 반복하면 노려서 친다', () => {
    const plain = sample('hard', f(1), f(1)).attack
    const read = sample('hard', f(1), f(1), ['ready', 'ready']).attack
    expect(read).toBeGreaterThan(plain + 300)
  })

  it('어려움: 상대가 타격을 반복하면 방어를 늘린다', () => {
    expect(sample('hard', f(1), f(1), ['attack', 'attack']).guard).toBeGreaterThan(sample('hard', f(1), f(1)).guard + 300)
  })
})
