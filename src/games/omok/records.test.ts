import { describe, expect, it } from 'vitest'
import type { MatchSummary } from './play/matchState'
import { EMPTY_RECORD, addGame } from './records'

const game = (outcome: MatchSummary['outcome'], mode: MatchSummary['mode'] = 'bot'): MatchSummary => ({
  mode,
  difficulty: 'hard',
  outcome,
  stone: 'black',
  moves: 41,
})

describe('addGame', () => {
  it('봇전: 난이도별 승패와 연승', () => {
    let r = EMPTY_RECORD
    for (const o of ['win', 'win', 'lose', 'win'] as const) r = addGame(r, game(o))
    expect(r.hard).toEqual({ wins: 3, losses: 1, draws: 0, streak: 1, bestStreak: 2 })
    expect(r.normal).toEqual(EMPTY_RECORD.normal)
  })

  it('친구 대전은 따로', () => {
    const r = addGame(EMPTY_RECORD, game('lose', 'pvp'))
    expect(r.pvp).toEqual({ wins: 0, losses: 1, draws: 0 })
    expect(r.hard).toEqual(EMPTY_RECORD.hard)
  })
})
