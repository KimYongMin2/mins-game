import { describe, expect, it } from 'vitest'
import type { MatchSummary } from './play/matchState'
import { EMPTY_RECORD, addGame, winRate } from './records'

const game = (outcome: MatchSummary['outcome'], difficulty: 'normal' | 'hard' = 'normal'): MatchSummary => ({
  difficulty,
  outcome,
  turns: 8,
  life: [1, 0],
  strikes: 3,
})

describe('addGame', () => {
  it('승/패/무와 연승을 난이도별로 센다', () => {
    let r = EMPTY_RECORD
    for (const o of ['win', 'win', 'lose', 'win', 'draw', 'win', 'win', 'win'] as const) r = addGame(r, game(o))
    expect(r.normal).toEqual({ wins: 6, losses: 1, draws: 1, streak: 3, bestStreak: 3 })
    expect(r.hard.wins).toBe(0)
  })

  it('승률은 무승부 제외', () => {
    let r = EMPTY_RECORD
    for (const o of ['win', 'lose', 'draw', 'win'] as const) r = addGame(r, game(o, 'hard'))
    expect(winRate(r.hard)).toBeCloseTo(2 / 3)
    expect(winRate(r.normal)).toBeNull()
  })
})
