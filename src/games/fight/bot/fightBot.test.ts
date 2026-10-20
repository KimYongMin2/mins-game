import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import type { Fighter, Stance } from '../rules/turn'
import { chooseBotStance } from './fightBot'

const f = (stacks: number): Fighter => ({ life: 3, stacks })

function sample(difficulty: 'normal' | 'hard', self: Fighter, foe: Fighter, foeHistory: Stance[] = [], n = 2000) {
  const rng = createRng(42)
  const count: Record<Stance, number> = { ready: 0, guard: 0, attack: 0 }
  for (let i = 0; i < n; i++) count[chooseBotStance({ rng, difficulty, self, foe, foeHistory })]++
  return count
}

describe('chooseBotStance', () => {
  it('스택이 없으면 절대 타격하지 않는다', () => {
    expect(sample('normal', f(0), f(1)).attack).toBe(0)
    expect(sample('hard', f(0), f(2)).attack).toBe(0)
  })

  it('일반: 스택 2개면 자주 친다', () => {
    expect(sample('normal', f(2), f(0)).attack).toBeGreaterThan(1200)
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
