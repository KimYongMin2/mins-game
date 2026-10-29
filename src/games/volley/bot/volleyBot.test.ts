import { describe, expect, it } from 'vitest'
import { NET_X, STEP_HZ } from '../constants'
import { type Side, createSim, step } from '../play/sim'
import { type BotLevel, botInput, createBotMind } from './volleyBot'

function game(a: BotLevel, b: BotLevel, server: Side, salt: number) {
  let s = createSim(server)
  let m0 = createBotMind(salt)
  let m1 = createBotMind(salt + 1)
  let crosses = 0
  let left = s.ball.x < NET_X
  while (s.phase.kind !== 'done' && s.tick < STEP_HZ * 60 * 20) {
    const r0 = botInput(s, 0, a, m0)
    const r1 = botInput(s, 1, b, m1)
    m0 = r0.mind
    m1 = r1.mind
    s = step(s, [r0.input, r1.input])
    if (s.phase.kind === 'rally' && s.ball.x < NET_X !== left) crosses++
    left = s.ball.x < NET_X
  }
  return { s, crosses }
}

describe('봇', () => {
  it('어려움이 일반을 거의 다 이긴다, 공은 네트를 오간다', () => {
    let wins = 0
    for (let i = 0; i < 6; i++) {
      const { s, crosses } = game('hard', 'normal', (i % 2) as Side, i * 101)
      expect(s.phase.kind).toBe('done')
      if (s.phase.kind === 'done' && s.phase.winner === 0) wins++
      expect(crosses).toBeGreaterThan(s.score[0] + s.score[1])
    }
    expect(wins).toBeGreaterThanOrEqual(5)
  }, 60_000)

  it('일반끼리는 양쪽 다 이긴다 (한쪽으로 쏠리지 않음)', () => {
    const winners = new Set<number>()
    for (let i = 0; i < 8; i++) {
      const { s } = game('normal', 'normal', (i % 2) as Side, i * 977 + 3)
      if (s.phase.kind === 'done') winners.add(s.phase.winner)
    }
    expect(winners.size).toBe(2)
  }, 60_000)
})
