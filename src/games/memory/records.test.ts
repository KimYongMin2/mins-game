import { describe, expect, it } from 'vitest'
import type { MatchSummary } from './play/matchState'
import { EMPTY_RECORD, addGame, winRate } from './records'

const game = (outcome: MatchSummary['outcome'], mode: MatchSummary['mode'] = 'bot'): MatchSummary => ({
  mode,
  difficulty: 'hard',
  outcome,
  pairs: [7, 5],
  tries: 15,
})

describe('addGame', () => {
  it('난이도별 승패와 연승, 지거나 비기면 연승 끊김', () => {
    let r = EMPTY_RECORD
    for (const o of ['win', 'win', 'draw', 'win'] as const) r = addGame(r, game(o))
    expect(r.hard).toEqual({ wins: 3, losses: 0, draws: 1, streak: 1, bestStreak: 2 })
    expect(r.normal).toEqual(EMPTY_RECORD.normal)
    expect(winRate(r.hard)).toBe(1)
  })

  it('친구 대전은 따로 센다', () => {
    const r = addGame(addGame(EMPTY_RECORD, game('win', 'pvp')), game('lose', 'pvp'))
    expect(r.pvp).toEqual({ wins: 1, losses: 1, draws: 0 })
    expect(r.hard).toEqual(EMPTY_RECORD.hard)
  })
})
